exports.tokenize = tokenizeCodeFenced
exports.resolve = resolveCodeFenced

var assert = require('assert')
var core = require('../../core')
var codes = require('../../character/codes')
var markdownLineEnding = require('../../character/markdown-line-ending')
var markdownEnding = require('../../character/markdown-ending')
var markdownSpace = require('../../character/markdown-space')
var constants = require('../../constant/constants')
var types = require('../../constant/types')
var tokenizeEvent = require('../../util/tokenize-event')

function resolveCodeFenced(events) {
  var result = []
  var index = -1
  var length = events.length
  var infoEnter
  var metaEnter
  var type
  var event

  while (++index < length) {
    event = events[index]
    type = event[1].type

    if (event[0] === 'enter') {
      if (type === types.codeFencedFenceInfo) {
        infoEnter = index
      } else if (type === types.codeFencedFenceMeta) {
        metaEnter = index
      }
    }

    if (event[0] === 'exit' && type === types.codeFencedFence) {
      break
    }
  }

  if (!infoEnter) {
    return events
  }

  result = result.concat(
    events.slice(0, infoEnter + 1),
    tokenizeEvent(events[infoEnter], core.plainText)
  )

  if (metaEnter) {
    result = result.concat(
      events.slice(infoEnter + 1, metaEnter + 1),
      tokenizeEvent(events[metaEnter], core.plainText),
      events.slice(metaEnter + 1)
    )
  } else {
    result = result.concat(events.slice(infoEnter + 1))
  }

  return result
}

function tokenizeCodeFenced(effects, ok, nok) {
  var queue = this.queue
  var closingFence = {tokenize: tokenizeClosingFence}
  var previous = queue[queue.length - 1]
  var sizeOpen = 0
  var prefixSize
  var marker
  var initialPrefixSize =
    previous && previous[1].type === types.linePrefix
      ? previous[1].end.column - previous[1].start.column
      : 0

  return start

  function start(code) {
    if (code !== codes.graveAccent && code !== codes.tilde) {
      return nok(code)
    }

    effects.enter(types.codeFenced)
    effects.enter(types.codeFencedFence)
    effects.enter(types.codeFencedFenceSequence)
    marker = code
    return sequenceOpen
  }

  function sequenceOpen(code) {
    if (code === marker) {
      effects.consume(code)
      sizeOpen++
      return sequenceOpen
    }

    if (sizeOpen < constants.codeFencedSequenceSizeMin) {
      return nok(code)
    }

    effects.exit(types.codeFencedFenceSequence)

    if (markdownSpace(code)) {
      effects.enter(types.whitespace)
      effects.consume(code)
      return sequenceAfter
    }

    return infoOpen(code)
  }

  function sequenceAfter(code) {
    if (markdownSpace(code)) {
      effects.consume(code)
      return sequenceAfter
    }

    effects.exit(types.whitespace)
    return infoOpen(code)
  }

  function infoOpen(code) {
    if (markdownEnding(code)) {
      return openAfter(code)
    }

    effects.enter(types.codeFencedFenceInfo)
    return info(code)
  }

  function info(code) {
    if (marker === codes.graveAccent && code === marker) {
      return nok(code)
    }

    if (markdownEnding(code)) {
      effects.exit(types.codeFencedFenceInfo)
      return openAfter(code)
    }

    if (markdownSpace(code)) {
      effects.exit(types.codeFencedFenceInfo)
      effects.enter(types.whitespace)
      return infoAfter(code)
    }

    effects.consume(code)
    return info
  }

  function infoAfter(code) {
    if (markdownSpace(code)) {
      effects.consume(code)
      return infoAfter
    }

    effects.exit(types.whitespace)

    if (markdownEnding(code)) {
      return openAfter(code)
    }

    effects.enter(types.codeFencedFenceMeta)
    return meta(code)
  }

  function meta(code) {
    if (marker === codes.graveAccent && code === marker) {
      return nok(code)
    }

    if (markdownEnding(code)) {
      effects.exit(types.codeFencedFenceMeta)
      return openAfter(code)
    }

    effects.consume(code)
    return meta
  }

  function openAfter(code) {
    effects.exit(types.codeFencedFence)

    if (markdownLineEnding(code)) {
      effects.enter(types.lineEnding)
      effects.consume(code)
      effects.exit(types.lineEnding)
      return next
    }

    assert(code === codes.eof, 'expected EOF')
    return after(code)
  }

  function lineStart(code) {
    if (markdownEnding(code)) {
      return lineEnd(code)
    }

    if (initialPrefixSize && markdownSpace(code)) {
      effects.enter(types.linePrefix)
      prefixSize = 0
      return linePrefix(code)
    }

    effects.enter(types.codeFlowData)
    return lineData(code)
  }

  function linePrefix(code) {
    if (prefixSize !== initialPrefixSize && markdownSpace(code)) {
      effects.consume(code)
      prefixSize++
      return linePrefix
    }

    effects.exit(types.linePrefix)
    prefixSize = undefined

    if (markdownEnding(code)) {
      return lineEnd(code)
    }

    effects.enter(types.codeFlowData)
    return lineData(code)
  }

  function lineData(code) {
    if (markdownEnding(code)) {
      effects.exit(types.codeFlowData)
      return lineEnd(code)
    }

    effects.consume(code)
    return lineData
  }

  function lineEnd(code) {
    if (code === codes.eof) {
      return after(code)
    }

    assert(markdownLineEnding(code), 'expected EOF or EOL')
    effects.enter(types.lineEnding)
    effects.consume(code)
    effects.exit(types.lineEnding)
    return next
  }

  function next() {
    return effects.createConstructAttempt(closingFence, after, lineStart)
  }

  function after(code) {
    effects.exit(types.codeFenced)
    return ok(code)
  }

  function tokenizeClosingFence(effects, ok, nok) {
    var size

    return closingStart

    function closingStart(code) {
      if (markdownSpace(code)) {
        effects.enter(types.linePrefix)
        prefixSize = 0
        return closingPrefix(code)
      }

      return closingPrefixAfter(code)
    }

    function closingPrefix(code) {
      if (markdownSpace(code)) {
        prefixSize++

        // Closing prefix cannot start when indented.
        if (prefixSize >= constants.tabSize) {
          prefixSize = undefined
          return nok(code)
        }

        effects.consume(code)
        return closingPrefix
      }

      prefixSize = undefined
      effects.exit(types.linePrefix)
      return closingPrefixAfter(code)
    }

    function closingPrefixAfter(code) {
      if (code === marker) {
        effects.enter(types.codeFencedFence)
        effects.enter(types.codeFencedFenceSequence)
        size = 0
        return closingSequence(code)
      }

      return nok(code)
    }

    function closingSequence(code) {
      if (code === marker) {
        effects.consume(code)
        size++
        return closingSequence
      }

      if (size < sizeOpen) {
        return nok(code)
      }

      effects.exit(types.codeFencedFenceSequence)

      if (markdownSpace(code)) {
        effects.enter(types.whitespace)
        return closingSequenceAfter(code)
      }

      return closingSequenceEnd(code)
    }

    function closingSequenceAfter(code) {
      if (markdownSpace(code)) {
        effects.consume(code)
        return closingSequenceAfter
      }

      effects.exit(types.whitespace)
      return closingSequenceEnd(code)
    }

    function closingSequenceEnd(code) {
      if (markdownEnding(code)) {
        effects.exit(types.codeFencedFence)
        return ok(code)
      }

      return nok(code)
    }
  }
}