/**
 * Caret paint helpers
 *
 * Thin wrappers around chalk that select the right color emission based
 * on terminal capability and theme. Used by non-interactive components
 * (list, table, banner, etc.) to apply theme colors without each
 * component re-implementing the capability dance.
 */

import chalk, { type ChalkInstance } from 'chalk'
import type { Theme } from '../theme/types.js'
import { capability } from './capability.js'

/** Accent — Caret's brand color, fixed truecolor with ANSI fallback. */
export function paintAccent(theme: Theme): ChalkInstance {
  const cap = capability()
  if (!cap.hasColor) return chalk.reset
  if (cap.truecolor) return chalk.hex(theme.colors.accent.default)
  // Nearest ANSI named color to the orange accent
  return chalk.yellow
}

/** Semantic color — emits ANSI named for theme respect. */
export function paintSemantic(
  theme: Theme,
  name: 'success' | 'warning' | 'danger' | 'info',
): ChalkInstance {
  const cap = capability()
  if (!cap.hasColor) return chalk.reset
  const ansi = theme.colors.semantic[name].ansi
  // chalk has all named ANSI colors as methods
  return (chalk as unknown as Record<string, ChalkInstance>)[ansi] ?? chalk.reset
}

/** Dim — secondary text via ANSI dim attribute. */
export function paintDim(): ChalkInstance {
  const cap = capability()
  if (!cap.hasColor) return chalk.reset
  return chalk.dim
}

/** Bold — strong/heading text. */
export function paintBold(): ChalkInstance {
  const cap = capability()
  if (!cap.hasColor) return chalk.reset
  return chalk.bold
}

/** Pad a string to a target visual width. ASCII-aware only. */
export function pad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const len = visibleLength(text)
  if (len >= width) return text
  const diff = width - len
  if (align === 'right') return ' '.repeat(diff) + text
  if (align === 'center') {
    const left = Math.floor(diff / 2)
    const right = diff - left
    return ' '.repeat(left) + text + ' '.repeat(right)
  }
  return text + ' '.repeat(diff)
}

/** Length of a string after stripping ANSI escape sequences. */
export function visibleLength(text: string): number {
  // Strip ANSI escape sequences for length computation.
  return text.replace(/\x1b\[[0-9;]*m/g, '').length
}

/** Truncate text to fit width, appending ellipsis if needed. */
export function truncate(text: string, width: number, ellipsis = '…'): string {
  if (visibleLength(text) <= width) return text
  const ellipsisLen = visibleLength(ellipsis)
  if (width <= ellipsisLen) return ellipsis.slice(0, width)
  return text.slice(0, width - ellipsisLen) + ellipsis
}
