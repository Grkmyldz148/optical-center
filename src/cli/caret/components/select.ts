/**
 * Caret select component
 *
 * Interactive single-choice picker. Renders a question, an arrow-key
 * focusable list of choices, and a dim key-hint footer; re-renders in
 * place on every keypress and collapses to a single summary line once
 * a choice is made (or cancelled).
 *
 *   const cmd = await select({
 *     message: 'What do you want to do?',
 *     choices: [
 *       { label: 'transform', value: 'transform', hint: 'Rewrite viewBox…' },
 *       { label: 'info',      value: 'info',      hint: 'Report metrics…' },
 *     ],
 *   })
 *   // → the chosen value, or null when cancelled (esc / ctrl-c)
 *
 * Requires a TTY on stdin and stdout — callers gate via capability().
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { readKeys } from '../lib/keypress.js'
import { paintAccent, paintBold, paintDim } from '../lib/paint.js'

export type SelectChoice<T> = {
  label: string
  value: T
  /** Dim annotation after the label — one short clause. */
  hint?: string
}

export type SelectOptions<T> = {
  message: string
  choices: ReadonlyArray<SelectChoice<T>>
  /** Index focused on open. Default 0. */
  initial?: number
  theme?: PartialTheme
}

export async function select<T>(options: SelectOptions<T>): Promise<T | null> {
  const theme = mergeTheme(getTheme(), options.theme)
  const accent = paintAccent(theme)
  const bold = paintBold()
  const dim = paintDim()
  const out = process.stdout

  const labelWidth = Math.max(...options.choices.map((c) => c.label.length))
  let focused = Math.min(Math.max(options.initial ?? 0, 0), options.choices.length - 1)
  let renderedLines = 0

  const frame = (): string => {
    const lines: string[] = []
    lines.push(`${accent(theme.symbols.anchor)} ${bold(options.message)}`)
    for (let i = 0; i < options.choices.length; i++) {
      const choice = options.choices[i]!
      const isFocused = i === focused
      const prefix = isFocused
        ? accent(theme.symbols.prefix.focused)
        : dim(theme.symbols.prefix.idle)
      const label = isFocused
        ? bold(choice.label.padEnd(labelWidth))
        : choice.label.padEnd(labelWidth)
      const hint = choice.hint !== undefined ? dim(`  ${choice.hint}`) : ''
      lines.push(`  ${prefix} ${label}${hint}`)
    }
    lines.push(dim('  ↑↓ navigate · enter select · esc cancel'))
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

  out.write('\x1b[?25l') // hide cursor
  let result: T | null = null
  try {
    paint()
    await readKeys((key) => {
      switch (key.name) {
        case 'up':
          focused = (focused - 1 + options.choices.length) % options.choices.length
          paint()
          return 'continue'
        case 'down':
        case 'tab':
          focused = (focused + 1) % options.choices.length
          paint()
          return 'continue'
        case 'home':
          focused = 0
          paint()
          return 'continue'
        case 'end':
          focused = options.choices.length - 1
          paint()
          return 'continue'
        case 'return': {
          const choice = options.choices[focused]!
          result = choice.value
          collapse(
            `${accent(theme.symbols.marker.selected)} ${options.message} ${dim('—')} ${bold(choice.label)}`,
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
    out.write('\x1b[?25h') // restore cursor
  }
  return result
}
