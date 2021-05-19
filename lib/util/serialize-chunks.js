/**
 * @typedef {import('../types.js').Chunk} Chunk
 */

import assert from 'assert'
import {codes} from '../character/codes.js'
import {values} from '../character/values.js'
import {fromCharCode} from '../constant/from-char-code.js'

/**
 * Get the string value of a slice of chunks.
 *
 * @param {Chunk[]} chunks
 * @returns {string}
 */
export function serializeChunks(chunks) {
  /** @type {string[]} */
  const result = []
  let index = -1
  /** @type {string} */
  let value
  /** @type {boolean|undefined} */
  let atTab

  while (++index < chunks.length) {
    const chunk = chunks[index]

    if (typeof chunk === 'string') {
      value = chunk
    } else
      switch (chunk) {
        case codes.carriageReturn: {
          value = values.cr

          break
        }

        case codes.lineFeed: {
          value = values.lf

          break
        }

        case codes.carriageReturnLineFeed: {
          value = values.cr + values.lf

          break
        }

        case codes.horizontalTab: {
          value = values.ht

          break
        }

        case codes.virtualSpace: {
          if (atTab) continue
          value = values.space

          break
        }

        default: {
          assert(typeof chunk === 'number', 'expected number')
          // Currently only replacement character.
          value = fromCharCode(chunk)
        }
      }

    atTab = chunk === codes.horizontalTab
    result.push(value)
  }

  return result.join('')
}