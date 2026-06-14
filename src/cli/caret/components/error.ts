/**
 * Caret error component
 *
 * Non-interactive — writes a structured error block directly to stderr.
 * Does not use Ink (no React, no mount/unmount overhead). Uses chalk for
 * ANSI color emission, which respects NO_COLOR and downgrades through
 * truecolor → 256 → ANSI 16 → none automatically.
 *
 * See specs/error.md for the full specification.
 */

import chalk from 'chalk'
import { capability } from '../lib/capability.js'
import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { paintSemantic } from '../lib/paint.js'

export type ErrorOptions = {
  body?: string
  hint?: string
  see?: string
  /** Exit after rendering. true = code 1, number = custom code. */
  exit?: boolean | number
  /** Per-call theme override. Merged onto the active global theme. */
  theme?: PartialTheme
}

export function error(title: string, options: ErrorOptions = {}): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const cap = capability()

  const accentHex = theme.colors.accent.default

  // Semantic state: ANSI-named by default (manifesto Rule #2 — user terminal
  // theme harmony). Accent is the one allowed truecolor — it's our signature.
  const danger = paintSemantic(theme, 'danger')
  const accent = cap.truecolor ? chalk.hex(accentHex) : chalk.blue

  const sym = theme.symbols
  const failureSymbol = cap.unicode ? sym.state.failure : 'X'
  const warningSymbol = cap.unicode ? sym.state.warning : '!'
  const gutterChar = cap.unicode ? sym.structure.gutter : '|'

  const lines: string[] = []

  // Header: ✗ error: <title>
  const header = `${danger(failureSymbol)} ${danger.bold('error:')} ${title}`
  lines.push(header)

  const hasBlock =
    options.body !== undefined ||
    options.hint !== undefined ||
    options.see !== undefined

  if (hasBlock) {
    const gutter = danger(gutterChar)

    // Body section
    if (options.body !== undefined) {
      lines.push(gutter)
      const wrapped = wrap(options.body, Math.max(20, cap.columns - 2))
      for (const line of wrapped) {
        lines.push(`${gutter} ${line}`)
      }
    }

    // Hint section
    if (options.hint !== undefined) {
      lines.push(gutter)
      const hintWord = accent('hint:')
      const indent = '       ' // length of "hint:" + space
      const wrapped = wrap(options.hint, Math.max(20, cap.columns - indent.length - 2))
      lines.push(`${gutter} ${hintWord} ${wrapped[0] ?? ''}`)
      for (let i = 1; i < wrapped.length; i++) {
        lines.push(`${gutter} ${indent}${wrapped[i]}`)
      }
    }

    // See section
    if (options.see !== undefined) {
      const seeWord = chalk.dim('see: ')
      lines.push(`${gutter} ${seeWord}${accent.underline(options.see)}`)
    }
  }

  process.stderr.write(lines.join('\n') + '\n\n')

  if (options.exit !== undefined && options.exit !== false) {
    const code = typeof options.exit === 'number' ? options.exit : 1
    process.exit(code)
  }
}

function wrap(text: string, width: number): string[] {
  if (width <= 0) return [text]
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    const words = para.split(' ')
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length > width && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
    if (para === '') lines.push('')
  }
  return lines.length > 0 ? lines : ['']
}
