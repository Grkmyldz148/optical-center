/**
 * Caret keyValue component
 *
 * Renders key-value rows joined by a dotted leader — the Caret editorial
 * signature for label/value alignment (specs/look.md § Symbols).
 *
 *   keyValue({
 *     rows: [
 *       { key: 'Environment', value: 'production' },
 *       { key: 'Region',      value: 'us-east-1' },
 *     ],
 *   })
 *
 * Output:
 *   Environment  ·················  production
 *   Region       ·················  us-east-1
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { capability } from '../lib/capability.js'
import { paintAccent, paintDim, visibleLength } from '../lib/paint.js'
import { leaderAt } from '../lib/typography.js'

export type KeyValueRow = {
  key: string
  value: string | number | boolean
}

export type KeyValueOptions = {
  rows: ReadonlyArray<KeyValueRow>
  /**
   * @deprecated Leaders are always left-anchored. This option has no effect
   * and will be removed in a future revision.
   */
  alignKeysRight?: boolean
  /** Color the key with accent. Default: false (dim). */
  highlightKeys?: boolean
  /** Override the total row width. Default: min(terminal, 60). */
  width?: number
  theme?: PartialTheme
}

export function keyValue(options: KeyValueOptions): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const accent = paintAccent(theme)
  const dim = paintDim()
  const cap = capability()

  // Compute label column: max key width + a small padding
  let maxKeyWidth = 0
  for (const row of options.rows) {
    const w = visibleLength(row.key)
    if (w > maxKeyWidth) maxKeyWidth = w
  }
  const labelCol = maxKeyWidth + theme.spacing.gap

  // Compute total row width
  const totalWidth = Math.min(options.width ?? 60, cap.columns)

  const lines: string[] = []
  for (const row of options.rows) {
    const coloredKey = options.highlightKeys ? accent(row.key) : dim(row.key)
    const value = String(row.value)
    lines.push(
      leaderAt(coloredKey, value, labelCol, totalWidth, {
        dot: theme.symbols.leader,
      }),
    )
  }

  process.stdout.write(lines.join('\n') + '\n')
}
