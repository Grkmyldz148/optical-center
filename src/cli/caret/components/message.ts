/**
 * Caret message helpers — info, success, warning
 *
 * Single-line semantic messages for the lighter-weight cousins of error().
 * `error()` is for failures with structured detail. These three are for
 * one-line announcements.
 *
 *   info('Cache cleared')
 *   success('Build complete')
 *   warning('Deprecated config syntax — see migration guide')
 *
 * Output:
 *   ℹ info: Cache cleared
 *   ✓ success: Build complete
 *   ⚠ warning: Deprecated config syntax — see migration guide
 *
 * info() and success() write to stdout. warning() writes to stderr.
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { paintDim, paintSemantic } from '../lib/paint.js'

export type MessageOptions = {
  theme?: PartialTheme
}

export function info(text: string, options: MessageOptions = {}): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const color = paintSemantic(theme, 'info')
  const line = `${color(theme.symbols.state.info)} ${color.bold('info:')} ${text}`
  process.stdout.write(line + '\n')
}

export function success(text: string, options: MessageOptions = {}): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const color = paintSemantic(theme, 'success')
  const line = `${color(theme.symbols.state.success)} ${color.bold('success:')} ${text}`
  process.stdout.write(line + '\n')
}

export function warning(text: string, options: MessageOptions = {}): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const color = paintSemantic(theme, 'warning')
  const line = `${color(theme.symbols.state.warning)} ${color.bold('warning:')} ${text}`
  process.stderr.write(line + '\n')
}

/**
 * Low-priority diagnostic message. Always dim. Use for verbose or
 * debug output that should be quiet by default but still visible.
 * Writes to stderr.
 */
export function debug(text: string, options: MessageOptions = {}): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const dim = paintDim()
  process.stderr.write(dim(`${theme.symbols.prefix.idle} debug: ${text}`) + '\n')
}
