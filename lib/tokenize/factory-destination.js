/**
 * @typedef {import('../types.js').Effects} Effects
 * @typedef {import('../types.js').Okay} Okay
 * @typedef {import('../types.js').NotOkay} NotOkay
 * @typedef {import('../types.js').State} State
 */

import {asciiControl} from '../character/ascii-control.js'
import {codes} from '../character/codes.js'
import {markdownLineEndingOrSpace} from '../character/markdown-line-ending-or-space.js'
import {markdownLineEnding} from '../character/markdown-line-ending.js'
import {constants} from '../constant/constants.js'
import {types} from '../constant/types.js'

/**
 * @param {Effects} effects
 * @param {Okay} ok
 * @param {NotOkay} nok
 * @param {string} type
 * @param {string} literalType
 * @param {string} literalMarkerType
 * @param {string} rawType
 * @param {string} stringType
 * @param {number} [max=Infinity]
 * @returns {State}
 */
// eslint-disable-next-line max-params
export function factoryDestination(
  effects,
  ok,
  nok,
  type,
  literalType,
  literalMarkerType,
  rawType,
  stringType,
  max
) {
  const limit = max || Number.POSITIVE_INFINITY
  let balance = 0

  return start

  /** @type {State} */
  function start(code) {
    if (code === codes.lessThan) {
      effects.enter(type)
      effects.enter(literalType)
      effects.enter(literalMarkerType)
      effects.consume(code)
      effects.exit(literalMarkerType)
      return destinationEnclosedBefore
    }

    if (
      code === codes.eof ||
      code === codes.rightParenthesis ||
      asciiControl(code)
    ) {
      return nok(code)
    }

    effects.enter(type)
    effects.enter(rawType)
    effects.enter(stringType)
    effects.enter(types.chunkString, {contentType: constants.contentTypeString})
    return destinationRaw(code)
  }

  /** @type {State} */
  function destinationEnclosedBefore(code) {
    if (code === codes.greaterThan) {
      effects.enter(literalMarkerType)
      effects.consume(code)
      effects.exit(literalMarkerType)
      effects.exit(literalType)
      effects.exit(type)
      return ok
    }

    effects.enter(stringType)
    effects.enter(types.chunkString, {contentType: constants.contentTypeString})
    return destinationEnclosed(code)
  }

  /** @type {State} */
  function destinationEnclosed(code) {
    if (code === codes.greaterThan) {
      effects.exit(types.chunkString)
      effects.exit(stringType)
      return destinationEnclosedBefore(code)
    }

    if (
      code === codes.eof ||
      code === codes.lessThan ||
      markdownLineEnding(code)
    ) {
      return nok(code)
    }

    effects.consume(code)
    return code === codes.backslash
      ? destinationEnclosedEscape
      : destinationEnclosed
  }

  /** @type {State} */
  function destinationEnclosedEscape(code) {
    if (
      code === codes.lessThan ||
      code === codes.greaterThan ||
      code === codes.backslash
    ) {
      effects.consume(code)
      return destinationEnclosed
    }

    return destinationEnclosed(code)
  }

  /** @type {State} */
  function destinationRaw(code) {
    if (code === codes.leftParenthesis) {
      if (++balance > limit) return nok(code)
      effects.consume(code)
      return destinationRaw
    }

    if (code === codes.rightParenthesis) {
      if (!balance--) {
        effects.exit(types.chunkString)
        effects.exit(stringType)
        effects.exit(rawType)
        effects.exit(type)
        return ok(code)
      }

      effects.consume(code)
      return destinationRaw
    }

    if (code === codes.eof || markdownLineEndingOrSpace(code)) {
      if (balance) return nok(code)
      effects.exit(types.chunkString)
      effects.exit(stringType)
      effects.exit(rawType)
      effects.exit(type)
      return ok(code)
    }

    if (asciiControl(code)) return nok(code)
    effects.consume(code)
    return code === codes.backslash ? destinationRawEscape : destinationRaw
  }

  /** @type {State} */
  function destinationRawEscape(code) {
    if (
      code === codes.leftParenthesis ||
      code === codes.rightParenthesis ||
      code === codes.backslash
    ) {
      effects.consume(code)
      return destinationRaw
    }

    return destinationRaw(code)
  }
}