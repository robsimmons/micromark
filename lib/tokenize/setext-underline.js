/**
 * @typedef {import('../types.js').Construct} Construct
 * @typedef {import('../types.js').Resolve} Resolve
 * @typedef {import('../types.js').Tokenize} Tokenize
 * @typedef {import('../types.js').State} State
 * @typedef {import('../types.js').Code} Code
 */

import assert from 'assert'
import {codes} from '../character/codes.js'
import {markdownLineEnding} from '../character/markdown-line-ending.js'
import {types} from '../constant/types.js'
import {shallow} from '../util/shallow.js'
import {factorySpace} from './factory-space.js'

/** @type {Construct} */
export const setextUnderline = {
  name: 'setextUnderline',
  tokenize: tokenizeSetextUnderline,
  resolveTo: resolveToSetextUnderline
}

/** @type {Resolve} */
function resolveToSetextUnderline(events, context) {
  let index = events.length
  /** @type {number|undefined} */
  let content
  /** @type {number|undefined} */
  let text
  /** @type {number|undefined} */
  let definition

  // Find the opening of the content.
  // It’ll always exist: we don’t tokenize if it isn’t there.
  while (index--) {
    if (events[index][0] === 'enter') {
      if (events[index][1].type === types.content) {
        content = index
        break
      }

      if (events[index][1].type === types.paragraph) {
        text = index
      }
    }
    // Exit
    else {
      if (events[index][1].type === types.content) {
        // Remove the content end (if needed we’ll add it later)
        events.splice(index, 1)
      }

      if (!definition && events[index][1].type === types.definition) {
        definition = index
      }
    }
  }

  assert(text !== undefined, 'expected a `text` index to be found')
  assert(content !== undefined, 'expected a `text` index to be found')

  const heading = {
    type: types.setextHeading,
    start: shallow(events[text][1].start),
    end: shallow(events[events.length - 1][1].end)
  }

  // Change the paragraph to setext heading text.
  events[text][1].type = types.setextHeadingText

  // If we have definitions in the content, we’ll keep on having content,
  // but we need move it.
  if (definition) {
    events.splice(text, 0, ['enter', heading, context])
    events.splice(definition + 1, 0, ['exit', events[content][1], context])
    events[content][1].end = shallow(events[definition][1].end)
  } else {
    events[content][1] = heading
  }

  // Add the heading exit at the end.
  events.push(['exit', heading, context])

  return events
}

/** @type {Tokenize} */
function tokenizeSetextUnderline(effects, ok, nok) {
  const self = this
  let index = self.events.length
  /** @type {NonNullable<Code>} */
  let marker
  /** @type {boolean} */
  let paragraph

  // Find an opening.
  while (index--) {
    // Skip enter/exit of line ending, line prefix, and content.
    // We can now either have a definition or a paragraph.
    if (
      self.events[index][1].type !== types.lineEnding &&
      self.events[index][1].type !== types.linePrefix &&
      self.events[index][1].type !== types.content
    ) {
      paragraph = self.events[index][1].type === types.paragraph
      break
    }
  }

  return start

  /** @type {State} */
  function start(code) {
    assert(
      code === codes.dash || code === codes.equalsTo,
      'expected `=` or `-`'
    )

    if (!self.lazy && (self.interrupt || paragraph)) {
      effects.enter(types.setextHeadingLine)
      effects.enter(types.setextHeadingLineSequence)
      marker = code
      return closingSequence(code)
    }

    return nok(code)
  }

  /** @type {State} */
  function closingSequence(code) {
    if (code === marker) {
      effects.consume(code)
      return closingSequence
    }

    effects.exit(types.setextHeadingLineSequence)
    return factorySpace(effects, closingSequenceEnd, types.lineSuffix)(code)
  }

  /** @type {State} */
  function closingSequenceEnd(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types.setextHeadingLine)
      return ok(code)
    }

    return nok(code)
  }
}