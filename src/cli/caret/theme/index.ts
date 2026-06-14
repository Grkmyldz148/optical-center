/**
 * Caret theme — public API (non-React subset).
 *
 * The upstream registry re-exports ThemeProvider/useTheme/context.tsx
 * here. We only ship the non-React paint helpers in this CLI, so the
 * React-bound exports are intentionally dropped.
 */

export { defaultTheme } from './default.js';
export { mergeTheme } from './merge.js';
export { setTheme, getTheme, resetTheme } from './global.js';

export type {
  Theme,
  PartialTheme,
  ColorPalette,
  SemanticColor,
  AnsiColor,
  FgAttribute,
  MotionTokens,
  SymbolSet,
  SpacingScale,
  TypographyScale,
} from './types.js';
