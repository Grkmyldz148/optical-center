/**
 * Caret banner component
 *
 * Renders a top-of-output heading: anchor + tracked CAPS title, an
 * optional dim subtitle below, and a thin horizontal rule. No full
 * boxes — per specs/look.md § Borders & surfaces, rounded box frames
 * are reserved for modals and dialogs.
 *
 *   banner({ title: 'My CLI', subtitle: 'v2.0.0 — production' })
 *
 * Output:
 *   ^ M Y   C L I
 *     v2.0.0 — production
 *   ──────────────────────
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { capability } from '../lib/capability.js'
import { paintAccent, paintBold, paintDim, visibleLength } from '../lib/paint.js'
import { tracking, trackingLength } from '../lib/typography.js'

export type BannerOptions = {
  title: string
  subtitle?: string
  /** Override rule width. Default: auto-fit content, capped at terminal width. */
  width?: number
  theme?: PartialTheme
}

export function banner(options: BannerOptions): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const accent = paintAccent(theme)
  const bold = paintBold()
  const dim = paintDim()
  const cap = capability()

  const lines: string[] = []

  const trackedTitle = tracking(options.title)
  // ^ Title (tracked CAPS)
  lines.push(`${accent(theme.symbols.anchor)} ${bold(trackedTitle)}`)

  if (options.subtitle !== undefined) {
    lines.push(`  ${dim(options.subtitle)}`)
  }

  // Thin horizontal rule — width fits the longest visible row
  const titleRowW = 2 + trackingLength(options.title) // "^ " + tracked
  const subtitleRowW =
    options.subtitle !== undefined ? 2 + visibleLength(options.subtitle) : 0
  const contentW = Math.max(titleRowW, subtitleRowW, 20)
  const ruleWidth = Math.min(options.width ?? contentW, cap.columns)
  lines.push(dim(theme.symbols.ruler.repeat(ruleWidth)))

  process.stdout.write(lines.join('\n') + '\n')
}
