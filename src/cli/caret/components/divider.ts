/**
 * Caret divider component
 *
 * A thin horizontal rule using the Caret ruler glyph. Optionally with
 * a centered or left-aligned label. Labels are rendered in tracked
 * CAPS per specs/look.md § Typography — the same visual language as
 * banner / section headings.
 *
 *   divider()
 *   divider({ label: 'Section' })           // ── S E C T I O N ──
 *   divider({ label: 'Section', align: 'left' })
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { capability } from '../lib/capability.js'
import { paintAccent, paintBold, paintDim, visibleLength } from '../lib/paint.js'
import { tracking } from '../lib/typography.js'

export type DividerOptions = {
  label?: string
  align?: 'left' | 'center' | 'right'
  /** Override total width. Default: terminal columns. */
  width?: number
  theme?: PartialTheme
}

export function divider(options: DividerOptions = {}): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const accent = paintAccent(theme)
  const bold = paintBold()
  const dim = paintDim()
  const cap = capability()

  const width = Math.max(8, Math.min(options.width ?? cap.columns, cap.columns))
  const ch = theme.symbols.ruler

  if (options.label === undefined) {
    process.stdout.write(dim(ch.repeat(width)) + '\n')
    return
  }

  const tracked = tracking(options.label)
  const trackedLen = visibleLength(tracked)
  const labelW = trackedLen + 2 // padding around label

  if (labelW + 6 >= width) {
    // Not enough room — just print the label with short rules
    process.stdout.write(`${dim(ch.repeat(2))} ${accent(bold(tracked))} ${dim(ch.repeat(2))}\n`)
    return
  }

  const align = options.align ?? 'center'
  let leftLen: number
  let rightLen: number

  if (align === 'left') {
    leftLen = 3
    rightLen = width - leftLen - labelW
  } else if (align === 'right') {
    rightLen = 3
    leftLen = width - rightLen - labelW
  } else {
    const remaining = width - labelW
    leftLen = Math.floor(remaining / 2)
    rightLen = remaining - leftLen
  }

  const line = `${dim(ch.repeat(leftLen))} ${accent(bold(tracked))} ${dim(ch.repeat(rightLen))}`
  process.stdout.write(line + '\n')
}
