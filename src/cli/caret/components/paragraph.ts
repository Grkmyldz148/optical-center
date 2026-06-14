/**
 * Caret paragraph component
 *
 * Wraps long-form text to fit the terminal width, with optional indent.
 * Static — writes to stdout once.
 *
 *   paragraph('Lorem ipsum dolor sit amet, consectetur adipiscing elit…')
 *   paragraph(text, { width: 80, indent: 2 })
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { capability } from '../lib/capability.js'
import { visibleLength } from '../lib/paint.js'

export type ParagraphOptions = {
  /** Maximum line width. Default: min(terminal columns, 80). */
  width?: number
  /** Number of leading spaces on each line. Default: 0. */
  indent?: number
  theme?: PartialTheme
}

export function paragraph(text: string, options: ParagraphOptions = {}): void {
  const _theme = mergeTheme(getTheme(), options.theme)
  const cap = capability()

  const indent = options.indent ?? 0
  const indentStr = ' '.repeat(indent)
  const maxWidth = Math.min(options.width ?? 80, cap.columns) - indent

  const wrapped = wrap(text, Math.max(20, maxWidth))
  const lines = wrapped.map((line) => indentStr + line)
  process.stdout.write(lines.join('\n') + '\n')
}

function wrap(text: string, width: number): string[] {
  const paragraphs = text.split('\n')
  const out: string[] = []

  for (const para of paragraphs) {
    if (para === '') {
      out.push('')
      continue
    }
    const words = para.split(' ')
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (visibleLength(candidate) > width && current) {
        out.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) out.push(current)
  }

  return out
}
