/**
 * Caret global theme.
 *
 * Set once at app boot to re-skin every Caret component in the process.
 * Per-call overrides via component options still take precedence.
 *
 *   import { setTheme } from '@caret/registry/theme'
 *
 *   setTheme({
 *     colors: { accent: { default: '#FF6B6B' } }
 *   })
 *
 * Components consume the global theme via the useTheme() hook, which
 * also reads from a local <ThemeProvider> if one is present.
 */

import type { Theme, PartialTheme } from './types.js'
import { defaultTheme } from './default.js'
import { mergeTheme } from './merge.js'

let globalTheme: Theme = defaultTheme

/** Set the global Caret theme. Merges with the default theme. */
export function setTheme(theme: PartialTheme): void {
  globalTheme = mergeTheme(defaultTheme, theme)
}

/** Read the current global Caret theme. */
export function getTheme(): Theme {
  return globalTheme
}

/** Reset the global theme back to Caret's default. */
export function resetTheme(): void {
  globalTheme = defaultTheme
}
