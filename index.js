import curry from 'lodash/fp/curry'
import curryN from 'lodash/fp/curryN'
import attempt from 'lodash/fp/attempt'
import isError from 'lodash/fp/isError'
import isFunction from 'lodash/fp/isFunction'
import isArray from 'lodash/fp/isArray'
import _once from 'lodash/fp/once'
import propSet from 'lodash/fp/set'
import reduce from 'lodash/fp/reduce'
import memoize from 'lodash/fp/memoize'
import mapValues from 'lodash/fp/mapValues'

function isThenable (f) {
    return f && isFunction(f.then)
}
// will be lost this scope
function evalWithNoCatch(fn, args) {
    const _r = attempt(fn, args)
    if (isError(_r)) {
        console.error(_r)
    }
    return _r
}

// eval trackFn before fn
export const before = curryN(2, (trackFn, fn, target) => (...args) => {
  trackFn = trackFn.bind(target)
  isFunction(trackFn) && evalWithNoCatch(trackFn, args)
  return fn.apply(target, args)
})

// eval trackFn after fn
export const after = curryN(2, (trackFn, fn, target) => function (...args) {
  const r = fn.apply(target || this, args)

  trackFn = trackFn.bind(target)

  if (isThenable(r)) {
    return r.then(rr => {
      evalWithNoCatch(trackFn, args)
      return rr
    })
  }
  evalWithNoCatch(trackFn, args)
  return r
})

// track by decorator
/* class SomeComponent {
 *     @track(before(() => console.log('hello, trackpoint')))
 *     onClick = () => {
 *         ...
 *     }
 * }*/
export const track = function (partical) {
  return function (target, key, descriptor) {
    if (!isFunction (partical)) {
      throw new Error('trackFn is not a function ' + partical)
    }
    const value = function (...args) {
      return partical.call(this, descriptor.value, this).apply(this, args)
    }
    return propSet('value', value, descriptor)
  }
}

// composeWith convergeFn by ops[array]
export const composeWith = curry((convergeFn, ops) => {
  if (isFunction (ops)) {
    ops = [ops]
  }

  // type check
  if (!isFunction(convergeFn) ||!isArray(ops) ) {
    return console.error('args type incorrect, expect convergeFn is function and ops is array')
  }

  const compose = function (ops) {
    const self = this
    return reduce(function (acc, i) {
      if (!acc) {
        return acc || i
      }
      return i.call(self, acc)
    }, null, ops)
  }


  return curryN(1, (fn, target) => function (...args) {
    const memoizeFn = memoize(fn)
    const _r = convergeFn(
      compose(ops)
        .apply(target, [memoizeFn])
        .apply(target, args)).apply(target, args)
    return memoizeFn.apply(target, args)
  })
})
export const createCounter = () => {
  let scopeCounter = 0
  return fn => function (...args) {
    fn.apply(this, args)
    scopeCounter = scopeCounter + 1
    return scopeCounter
  }
}
export const time = (fn) => (...args) => {
    const begin = +Date.now()
    const result = fn.apply(this, args)
    // result will be cached by memoize, so return new promise
    if (isThenable(result)) {
        return result.then(() => +Date.now() - begin)
    }
    return +Date.now() - begin
}

export const evolve = curry(evols => fn => function (...args) {
  const self = this
  const memoizeFn = memoize(fn)
  return mapValues(function (value) {
    return value(memoizeFn).apply(self, args)
  }, evols)
})

export const identity = curry(fn => function (...args) {
  return fn.apply(this, args)
})

// do work nothing
export const nop = () => {}

export const once = _once

export default {
  before,
  after,
  track,
  nop,
  once,
  composeWith,
  time,
  evolve,
  identity,
  createCounter
}
