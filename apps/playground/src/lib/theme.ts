/**
 * Every colour in the playground is produced by HelmLab.
 *
 * The pipeline:
 *
 *   1. Pick five anchor hexes (brand + four status hues).
 *   2. Run each through `hl.semanticScale(anchor)` to get a
 *      Tailwind-style 50–950 ladder. GenSpace's depressed-cubic
 *      transfer gives uniform perceptual steps end-to-end.
 *   3. Pick stops for each semantic role (bg, surface-1, accent,
 *      etc.) — the choices below favour the lower half of every
 *      scale because the playground ships a light theme.
 *   4. For each fg/bg pair where readability matters, call
 *      `hl.ensureContrast(fg, bg, ratio)` so WCAG AA is met by
 *      *construction*, not by trial-and-error.
 *   5. Derive the dark-canvas variant of the accent via
 *      `hl.adaptToMode(hex, 'light', 'dark')` — HelmLab does a
 *      perceptually correct soft L-inversion that keeps the hue
 *      identifiable on an ink surface.
 *   6. `applyTheme()` flushes the resulting hexes to CSS custom
 *      properties on `<html>` before React mounts; the CSS files
 *      in `src/styles/` reference those tokens by name only.
 *
 * Why this is *not* just `semanticScale` + arbitrary stop picks:
 * a single `semanticScale` call returns a beautiful 11-step ramp,
 * but it doesn't know which step you'll use for body text, which
 * for a faint border, or whether the chosen accent has enough
 * contrast on your background. `ensureContrast` and `adaptToMode`
 * are the bits of the API that turn a scale into a usable design
 * system. Both are documented as the canonical UI-tooling entry
 * points in the package README.
 */

import { Helmlab, type Hex, type SemanticScale } from 'helmlab';

const hl = new Helmlab();

/**
 * Brand & status anchors.
 *
 * `neutral` is a *true* mid-gray (`#737373`, equal R/G/B). HelmLab
 * preserves hue across `semanticScale`, so any blue or warm cast
 * in the anchor reproduces at every stop — picking a chromatic
 * "neutral" like Tailwind's zinc (#71717a) tints the entire UI
 * lavender. A pure grey anchor gives pure grey surfaces.
 */
const ANCHORS = {
  /** HelmLab brand blue — the canonical demo colour from helmlab.space. */
  accent: '#3b82f6',
  /** True grey anchor. Equal RGB — no chromatic tint at any stop. */
  neutral: '#737373',
  /** Amber. */
  warn: '#f59e0b',
  /** Red. */
  danger: '#ef4444',
  /** Emerald. */
  ok: '#10b981',
} as const;

/** Generated palettes — exported for any TSX that needs raw stops. */
export const palette: Record<keyof typeof ANCHORS, SemanticScale> = {
  accent: hl.semanticScale(ANCHORS.accent),
  neutral: hl.semanticScale(ANCHORS.neutral),
  warn: hl.semanticScale(ANCHORS.warn),
  danger: hl.semanticScale(ANCHORS.danger),
  ok: hl.semanticScale(ANCHORS.ok),
};

/**
 * Page background — every contrast-sensitive pair below is
 * validated against this hex.
 */
const BG: Hex = palette.neutral['50'];

/**
 * Compute a foreground hex that meets `ratio` against `bg`.
 *
 * `ensureContrast` binary-searches GenSpace L while preserving hue
 * and chroma, so the returned colour stays recognisably the same
 * tone — just lifted/darkened until it clears the threshold. Used
 * here to harden every "muted" / "subtle" / "accent text" token so
 * we never quietly ship a 3:1 grey on white.
 */
function withContrast(fg: Hex, bg: Hex, ratio: number): Hex {
  return hl.ensureContrast(fg, bg, ratio);
}

/**
 * Accent variant for the dark canvas. `adaptToMode` does a soft
 * L-inversion in GenSpace — same hue, complementary lightness.
 * On a #111-ish canvas the raw #3b82f6 would crush; this gives
 * us a sky-leaning variant that reads clean on ink.
 */
const ACCENT_ON_INK: Hex = hl.adaptToMode(
  palette.accent['500'],
  'light',
  'dark',
);

/**
 * Final semantic token map. Every value resolves to a
 * HelmLab-produced hex.
 *
 * Stop choices follow a three-band rule for the light theme:
 *
 *   surfaces  → 50–200   (paper, sidebar, control bg, active)
 *   lines     → 200–400  (hairline → strong → focus ring)
 *   text      → 500–950  (subtle → muted → body)
 *
 * Accent text uses `ensureContrast(accent[500], bg, 4.5)` rather
 * than guessing a deep stop — this guarantees AA on body copy at
 * any anchor.
 */
const TOKENS: Record<string, string> = {
  // ─── App shell ──────────────────────────────────────────────
  '--bg': BG,
  '--surface-1': palette.neutral['100'],
  '--surface-2': palette.neutral['200'],
  '--surface-3': palette.neutral['300'],

  // ─── Lines ──────────────────────────────────────────────────
  // Hairline 200, visible 300, strong 400.
  '--line': palette.neutral['200'],
  '--line-strong': palette.neutral['300'],
  '--line-stronger': palette.neutral['400'],

  // ─── Foreground (contrast-validated) ────────────────────────
  '--fg': palette.neutral['950'],
  '--fg-muted': withContrast(palette.neutral['600'], BG, 4.5),
  '--fg-subtle': withContrast(palette.neutral['500'], BG, 3.0),

  // ─── Accent ─────────────────────────────────────────────────
  // 500 is for fills/decorations; *-text passes WCAG AA body on bg.
  '--accent': palette.accent['500'],
  '--accent-strong': palette.accent['600'],
  '--accent-deep': palette.accent['700'],
  '--accent-text': withContrast(palette.accent['500'], BG, 4.5),
  '--accent-soft': palette.accent['100'],
  '--accent-line': palette.accent['300'],

  // ─── Status (contrast-validated for text uses) ──────────────
  '--warn': palette.warn['500'],
  '--warn-text': withContrast(palette.warn['500'], BG, 4.5),
  '--warn-soft': palette.warn['100'],
  '--danger': palette.danger['500'],
  '--danger-text': withContrast(palette.danger['500'], BG, 4.5),
  '--danger-soft': palette.danger['100'],
  '--ok': palette.ok['500'],
  '--ok-text': withContrast(palette.ok['500'], BG, 4.5),
  '--ok-soft': palette.ok['100'],

  // ─── Stage canvas (paper + ink) ─────────────────────────────
  '--canvas-light': palette.neutral['50'],
  '--canvas-light-fg': palette.neutral['950'],
  '--canvas-light-grid': palette.neutral['200'],

  '--canvas-dark': palette.neutral['950'],
  '--canvas-dark-fg': palette.neutral['50'],
  '--canvas-dark-grid': palette.neutral['800'],

  // ─── Component-specific ─────────────────────────────────────
  '--scrollbar-thumb': palette.neutral['300'],
  '--scrollbar-thumb-hover': palette.neutral['400'],
  '--crosshair-light': palette.neutral['400'],
  '--crosshair-dark': palette.neutral['600'],
  // HUD floats over both light + dark canvases. The light canvas is
  // neutral[50] so the HUD picks a one-stop-lighter "white" that
  // still reads as a card. (HelmLab's neutral scale starts at 50 —
  // there's no 0 stop — so we go pure white here. Borders + shadow
  // carry the visual separation from the canvas.)
  '--hud-bg': '#ffffff',
  '--hud-border': palette.neutral['300'],
  '--stress-cell-bg-dark': palette.neutral['900'],
  '--stress-cell-border-dark': palette.neutral['700'],
  '--stress-cell-bg-light': palette.accent['50'],
  '--stress-cell-border-light': palette.accent['200'],
  '--brand-mark-bg': palette.accent['500'],
  '--brand-mark-dot': palette.neutral['50'],

  // Dark-canvas accent — adapted via adaptToMode so the hue stays
  // legible against the ink surface.
  '--accent-on-ink': ACCENT_ON_INK,
};

/**
 * Apply the generated tokens to the live document. Idempotent —
 * calling it again just overwrites the same custom properties.
 * Invoked once at boot from `main.tsx` before React renders.
 */
export function applyTheme(): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(TOKENS)) {
    root.style.setProperty(name, value);
  }
}
