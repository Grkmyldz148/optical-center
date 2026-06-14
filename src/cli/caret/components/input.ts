/**
 * Caret input component
 *
 * Interactive single-line text field. Renders a question and an editable
 * value line (placeholder shown dim until the first keystroke), validates
 * on enter, and collapses to a summary line once submitted or cancelled.
 *
 *   const path = await input({
 *     message: 'Input folder',
 *     placeholder: './icons',
 *     required: true,
 *     validate: (v) => existsSync(v) ? null : 'path does not exist',
 *   })
 *   // → the entered string, or null when cancelled (esc / ctrl-c)
 *
 * Editing is append/backspace only — no mid-line cursor movement. That
 * covers the path-entry use case without a full readline reimplementation.
 *
 * Requires a TTY on stdin and stdout — callers gate via capability().
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { readKeys } from '../lib/keypress.js'
import { paintAccent, paintBold, paintDim, paintSemantic } from '../lib/paint.js'

export type InputOptions = {
  message: string
  /** Dim example text shown while the field is empty. */
  placeholder?: string
  /** Pre-filled value the user can edit. */
  initial?: string
  /** Reject empty submissions with a standard error. Default false. */
  required?: boolean
  /** Return an error message to reject a submission, null to accept. */
  validate?: (value: string) => string | null
  theme?: PartialTheme
}

export async function input(options: InputOptions): Promise<string | null> {
  const theme = mergeTheme(getTheme(), options.theme)
  const accent = paintAccent(theme)
  const bold = paintBold()
  const dim = paintDim()
  const danger = paintSemantic(theme, 'danger')
  const out = process.stdout

  let value = options.initial ?? ''
  let error: string | null = null
  let renderedLines = 0

  const frame = (): string => {
    const lines: string[] = []
    lines.push(`${accent(theme.symbols.anchor)} ${bold(options.message)}`)
    const block = '\x1b[7m \x1b[27m' // reverse-video cell as the caret
    const body =
      value === '' && options.placeholder !== undefined
        ? `${block}${dim(options.placeholder)}`
        : `${value}${block}`
    lines.push(`  ${accent(theme.symbols.cursor)} ${body}`)
    if (error !== null) {
      lines.push(`    ${danger(theme.symbols.state.failure)} ${dim(error)}`)
    } else {
      lines.push(dim('  enter submit · esc cancel'))
    }
    return lines.join('\n') + '\n'
  }

  const paint = (): void => {
    if (renderedLines > 0) out.write(`\x1b[${renderedLines}A\x1b[J`)
    const body = frame()
    renderedLines = body.split('\n').length - 1
    out.write(body)
  }

  const collapse = (summary: string): void => {
    out.write(`\x1b[${renderedLines}A\x1b[J`)
    out.write(summary + '\n')
  }

  out.write('\x1b[?25l') // hide cursor — the reverse-video cell stands in
  let result: string | null = null
  try {
    paint()
    await readKeys((key) => {
      switch (key.name) {
        case 'char':
          value += key.ch
          error = null
          paint()
          return 'continue'
        case 'backspace':
          value = value.slice(0, -1)
          error = null
          paint()
          return 'continue'
        case 'return': {
          const trimmed = value.trim()
          if (options.required === true && trimmed === '') {
            error = 'a value is required'
            paint()
            return 'continue'
          }
          if (trimmed !== '' && options.validate !== undefined) {
            error = options.validate(trimmed)
            if (error !== null) {
              paint()
              return 'continue'
            }
          }
          result = trimmed
          const shown = trimmed === '' ? dim('(skipped)') : bold(trimmed)
          collapse(
            `${accent(theme.symbols.marker.selected)} ${options.message} ${dim('—')} ${shown}`,
          )
          return 'done'
        }
        case 'escape':
        case 'ctrl-c':
          collapse(
            dim(`${theme.symbols.state.cancelled} ${options.message} (cancelled)`),
          )
          return 'done'
        default:
          return 'continue'
      }
    })
  } finally {
    out.write('\x1b[?25h')
  }
  return result
}
