/**
 * Caret table component
 *
 * Renders typed columns and rows with auto-computed widths. Header is
 * accented + bold. Optional rounded borders for a more structured look.
 *
 *   table({
 *     columns: [
 *       { header: 'NAME',   accessor: (r) => r.name },
 *       { header: 'STATUS', accessor: (r) => r.status },
 *       { header: 'AGE',    accessor: (r) => r.age, align: 'right' },
 *     ],
 *     rows: [
 *       { name: 'my-app',       status: 'running',  age: '3d' },
 *       { name: 'my-other-app', status: 'starting', age: '5h' },
 *       { name: 'billing-svc',  status: 'failed',   age: '1m' },
 *     ],
 *   })
 *
 * Output (no borders):
 *   NAME          STATUS    AGE
 *   my-app        running    3d
 *   my-other-app  starting   5h
 *   billing-svc   failed     1m
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { paintAccent, paintBold, paintDim, pad, visibleLength, truncate } from '../lib/paint.js'

export type TableAlign = 'left' | 'right' | 'center'

export type TableColumn<T> = {
  header: string
  accessor: (row: T) => string | number | boolean
  align?: TableAlign
  /** Fixed width override. Auto-fits otherwise. */
  width?: number
  /** Truncate to width with ellipsis if content is too long. Default: false. */
  truncate?: boolean
}

export type TableOptions<T> = {
  columns: ReadonlyArray<TableColumn<T>>
  rows: ReadonlyArray<T>
  /** Show the header row. Default: true. */
  showHeader?: boolean
  /**
   * Show a thin horizontal rule `─` under the header row.
   *
   * Per specs/look.md § Borders & surfaces, this is the *only* line
   * allowed in a Caret table. Previously this option rendered full
   * rounded-box borders; that's been removed — the rule-only form is
   * the editorial pattern.
   *
   * Default: false.
   */
  borders?: boolean
  /** Spacing between columns. Default: 2 (the Caret gap). */
  gap?: number
  theme?: PartialTheme
}

export function table<T>(options: TableOptions<T>): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const accent = paintAccent(theme)
  const bold = paintBold()
  const dim = paintDim()

  const showHeader = options.showHeader !== false
  const showHeaderRule = options.borders === true
  const gap = options.gap ?? theme.spacing.gap

  // Stringify all cells
  const cells: string[][] = options.rows.map((row) =>
    options.columns.map((col) => String(col.accessor(row))),
  )
  const headers: string[] = options.columns.map((col) => col.header)

  // Compute column widths
  const widths: number[] = options.columns.map((col, ci) => {
    if (col.width !== undefined) return col.width
    let max = visibleLength(headers[ci]!)
    for (const row of cells) {
      const w = visibleLength(row[ci] ?? '')
      if (w > max) max = w
    }
    return max
  })

  const formatCell = (text: string, width: number, align: TableAlign = 'left', shouldTruncate = false): string => {
    let content = text
    if (shouldTruncate && visibleLength(content) > width) {
      content = truncate(content, width, theme.symbols.ellipsis)
    }
    return pad(content, width, align)
  }

  const lines: string[] = []
  const gapStr = ' '.repeat(gap)

  if (showHeader) {
    const headerLine = options.columns
      .map((col, ci) => accent(bold(formatCell(headers[ci]!, widths[ci]!, col.align, col.truncate))))
      .join(gapStr)
    lines.push(headerLine)

    if (showHeaderRule) {
      // Single thin rule under the header — the only line Caret tables allow
      const ruleWidth = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1)
      lines.push(dim(theme.symbols.ruler.repeat(ruleWidth)))
    }
  }

  for (const row of cells) {
    const rowLine = options.columns
      .map((col, ci) => formatCell(row[ci] ?? '', widths[ci]!, col.align, col.truncate))
      .join(gapStr)
    lines.push(rowLine)
  }

  process.stdout.write(lines.join('\n') + '\n')
}
