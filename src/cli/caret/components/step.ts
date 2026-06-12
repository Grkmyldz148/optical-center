/**
 * Caret step component
 *
 * Renders a multi-phase status indicator — useful for showing progress
 * through a known sequence of steps. Each step has a status that picks
 * its symbol and color.
 *
 *   step({
 *     steps: [
 *       { label: 'Validate inputs',     status: 'done' },
 *       { label: 'Compile assets',      status: 'done' },
 *       { label: 'Deploy to production', status: 'active' },
 *       { label: 'Run smoke tests',     status: 'pending' },
 *       { label: 'Send notification',   status: 'pending' },
 *     ],
 *   })
 */

import { getTheme } from '../theme/global.js'
import { mergeTheme } from '../theme/merge.js'
import type { PartialTheme } from '../theme/types.js'
import { paintAccent, paintDim, paintSemantic } from '../lib/paint.js'

export type StepStatus = 'pending' | 'active' | 'done' | 'failed' | 'skipped'

export type Step = {
  label: string
  status?: StepStatus
}

export type StepOptions = {
  steps: ReadonlyArray<Step>
  theme?: PartialTheme
}

export function step(options: StepOptions): void {
  const theme = mergeTheme(getTheme(), options.theme)
  const accent = paintAccent(theme)
  const dim = paintDim()
  const success = paintSemantic(theme, 'success')
  const danger = paintSemantic(theme, 'danger')

  const lines: string[] = []

  for (const s of options.steps) {
    const status: StepStatus = s.status ?? 'pending'
    let symbol: string
    let labelRender: string

    switch (status) {
      case 'done': {
        symbol = success(theme.symbols.state.success)
        labelRender = s.label
        break
      }
      case 'active': {
        symbol = accent(theme.symbols.marker.selected)
        labelRender = s.label
        break
      }
      case 'failed': {
        symbol = danger(theme.symbols.state.failure)
        labelRender = danger(s.label)
        break
      }
      case 'skipped': {
        symbol = dim(theme.symbols.state.cancelled)
        labelRender = dim(s.label)
        break
      }
      case 'pending':
      default: {
        symbol = dim(theme.symbols.marker.unselected)
        labelRender = dim(s.label)
        break
      }
    }

    lines.push(`${symbol} ${labelRender}`)
  }

  process.stdout.write(lines.join('\n') + '\n')
}
