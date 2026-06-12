/**
 * Caret list component
 *
 * Renders a vertical list of items with one of four marker variants.
 * Static — writes to stdout once and returns synchronously.
 *
 *   list({ items: ['First', 'Second', 'Third'] })
 *
 *   list({
 *     items: [
 *       { label: 'Authentication', description: 'Sign in with email' },
 *       { label: 'Database',       description: 'PostgreSQL on Neon' },
 *     ],
 *     variant: 'arrow',
 *   })
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { paintAccent, paintDim } from '../lib/paint.js'

export type ListItem = string | { label: string; description?: string }

export type ListVariant = 'bullet' | 'numbered' | 'arrow' | 'dash'

export type ListOptions = {
  items: ReadonlyArray<ListItem>
  variant?: ListVariant
  theme?: PartialTheme
}

export function list(options: ListOptions): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const accent = paintAccent(theme)
  const dim = paintDim()
  const variant = options.variant ?? 'bullet'

  const lines: string[] = []
  for (let i = 0; i < options.items.length; i++) {
    const item = options.items[i]!
    const obj = typeof item === 'string' ? { label: item, description: undefined } : item

    let marker: string
    if (variant === 'numbered') {
      marker = `${i + 1}.`
    } else if (variant === 'arrow') {
      marker = theme.symbols.progress.arrow
    } else if (variant === 'dash') {
      marker = '-'
    } else {
      marker = theme.symbols.bullet
    }

    // Manifesto gap: 2 spaces between marker and text (not 1 — cramped in monospace)
    let line = `${accent(marker)}  ${obj.label}`
    if (obj.description !== undefined) {
      line += dim(` — ${obj.description}`)
    }
    lines.push(line)
  }

  process.stdout.write(lines.join('\n') + '\n')
}
