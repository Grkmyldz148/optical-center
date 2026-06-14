# Optical Center — Landing Design System

Foundations only. No sections, components, or content yet.

## Principles

1. **Flat-ish.** No shadows, no gradients, no depth tricks. 1px hairlines and a small `--radius-sm: 4px` to take the edge off — corners, not Cricut cuts.
2. **Sade.** Generous negative space. Restraint over decoration.
3. **Off-neutrals + tek accent.** Bg/fg lean subtly warm to harmonize with the orange accent. No pure `#FFF`/`#000`. The only chromatic color is the brand accent.
4. **Soft structure.** `--color-line` is an alpha-mix of `--color-fg`, not its mirror. Hairlines read as quiet structure, not borders on a tax form.

## Color — **all colors flow through helmlab**

**Policy**: every chromatic value used in CSS comes from [`helmlab`](https://helmlab.space/). No hand-written hex values in stylesheets. Inputs live in `tokens.config.mjs`; outputs are generated into `src/styles/tokens.color.css` by `scripts/build-tokens.mjs`. The generated file is committed and clearly marked — never edit it by hand.

Regenerate with `npm run tokens:build`. It also runs automatically as `predev` and `prebuild`.

### Tokens

Color tokens split into two layers:

**Brand layer** — written by `scripts/build-tokens.mjs` from helmlab. Hex literals live here only.

| Token                  | Source                                                    | Notes                                            |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| `--color-accent`       | `BRAND.accent` (`#E8734A`)                                | Brand accent. Used as surface, not as body text. |
| `--color-on-accent`    | helmlab picks `#FFF` or `#000` via `contrastRatio()`      | Foreground when accent is the background.        |
| `--color-accent-text`  | helmlab `ensureContrast(accent, bg, 4.5)` — per mode       | Accent as foreground text; AA-safe.              |
| `--color-bg`           | `NEUTRALS.{light,dark}.bg` — off-white / off-black         | Page background.                                 |
| `--color-fg`           | `NEUTRALS.{light,dark}.fg` — off-black / off-white         | Foreground (text, lines, icons).                 |

**Structural layer** — defined in `tokens.css` via CSS `color-mix(in oklab, …)`. These derive from `--color-fg`, so they shift automatically per mode and never introduce new chroma.

| Token                  | Derivation                              | Notes                                              |
| ---------------------- | --------------------------------------- | -------------------------------------------------- |
| `--color-line`         | `fg @ 12%`                              | Default 1px dividers and borders.                  |
| `--color-line-strong`  | `fg @ 24%`                              | Emphasized borders (segmented controls, eyebrows). |
| `--color-surface`      | `fg @ 3%`                               | Subtle elevated surfaces (cards, code blocks).     |
| `--color-surface-hi`   | `fg @ 6%`                               | Slightly raised surfaces (tab headers).            |
| `--color-muted-fg`     | `fg @ 64%`                              | Labels, captions, eyebrows.                        |
| `--color-soft-fg`      | `fg @ 80%`                              | Body sub-text / lead paragraphs.                   |

Current helmlab-generated values:

- Light mode: `--color-bg` `#f8f7f4`, `--color-fg` `#16130f`, `--color-accent-text` `#be4e24` (ratio 4.55:1)
- Dark mode: `--color-bg` `#0e0c0a`, `--color-fg` `#eae8e3`, `--color-accent-text` `#e8734a` (ratio 6.49:1)
- `--color-on-accent` = `#000000` (6.98:1 vs brand accent)

### Adding a new color

1. Add the input to `tokens.config.mjs` (a brand hex, never a derived value).
2. Update `scripts/build-tokens.mjs` to derive any variants via helmlab — `palette`, `semanticScale`, `ensureContrast`, `adaptToMode`, etc.
3. Run `npm run tokens:build`.
4. Reference the resulting CSS variable in styles.

### Forbidden

- Hex literals in `.css`, `.astro`, `.ts`, or any source file outside `tokens.config.mjs` and the generated `tokens.color.css`.
- `rgb(...)`, `hsl(...)`, `oklch(...)` literals for brand colors.
- Editing `tokens.color.css` directly.
- A second accent. If a second chromatic color is genuinely needed, add it to `tokens.config.mjs` and derive via helmlab.

`color-mix(in oklab, var(--color-fg) <n>%, transparent)` is **allowed** — it's an alpha derivation of an already helmlab-blessed color, not a new brand value. Prefer the named structural tokens (`--color-line`, `--color-surface`, …) over ad-hoc mixes in component CSS.

### Why helmlab

It guarantees perceptually uniform palettes, WCAG-safe contrast adjustment, and reproducible derivations. Hand-eyeballed shades drift and break in dark mode; helmlab doesn't.

## Theme

- Default: matches `prefers-color-scheme`.
- Explicit override: set `data-theme="light"` or `data-theme="dark"` on `<html>`.
- Persisted in `localStorage` under key `theme`.
- Bootstrap script runs synchronously in `<head>` to prevent FOUC.

## Typography

| Role    | Family                       | Why                                                                                          |
| ------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| Display | **Geist** (variable, 300–900)| Vercel sans, optically tuned. One face spans display + body; weight does the contrast work.  |
| Body    | **Geist** (variable, 300–900)| Same family — keeps the type system honest. Default `--fw-regular: 400`.                     |
| Mono    | **Geist Mono** (300–700)     | Reserved for code blocks, terminal lines, and tabular UI labels.                             |

- `font-optical-sizing: auto` on `<html>`.
- Headings use Geist at `--fw-medium`/`--fw-semibold` with `--ls-display: -0.025em`. Geist's italic axis is not loaded — emphasize via weight and `--color-accent-text`, not italic.
- Mono is opt-in: `code`, `kbd`, `samp`, `pre`, plus explicit `font-family: var(--font-mono)` for eyebrows, install lines, and the segmented control.
- Loaded from Google Fonts; preconnect hints in `<head>`.

## Type scale

`xs · sm · base · md · lg · xl · 2xl · 3xl · 4xl` → `0.75 · 0.875 · 1 · 1.125 · 1.5 · 2.25 · 3.5 · 5 · 7` rem.

Restrained: most UI uses `sm`/`base`. Display jumps straight to `3xl`/`4xl` for impact.

## Spacing

4px base. Tokens: `1 · 2 · 3 · 4 · 6 · 8 · 12 · 16 · 24 · 32` → `0.25–8rem`.

## Page shell — the alignment rule

Every top-level section uses the same horizontal shell so left and right edges line up across the page. Two tokens drive it:

| Token             | Value                              | Use                                                    |
| ----------------- | ---------------------------------- | ------------------------------------------------------ |
| `--page-max-w`    | `1280px`                           | Maximum content width.                                 |
| `--page-px`       | `clamp(1rem, 4vw, 2rem)`           | Horizontal page padding. Scales with viewport.         |

**Pattern**: the section element itself is **full-bleed** (so backdrops like the grid pattern span the viewport); an inner wrapper applies the constraint:

```html
<section class="hero">
  <div class="hero__inner">…</div>
</section>
```

```css
.hero { /* full bleed, holds the backdrop */ }
.hero__inner {
  max-width: var(--page-max-w);
  margin-inline: auto;
  padding-inline: var(--page-px);
}
```

The header follows the same pattern (`.site-header__inner`). When a new section is added, reuse this convention — do not hard-code different max-widths or paddings. This is the rule that keeps the brand mark and the headline starting at the same x-coordinate.

## Lines

`--line-w: 1px`. Hairlines only — but drawn with `--color-line` (`fg @ 12%`), not solid `--color-fg`. Use full-bleed dividers and asymmetric grids over boxes. When a border genuinely needs to *announce itself* — focus rings, active states — use `--color-accent` or `--color-line-strong`, never solid fg.

## Motion

Foundations stage: none. Motion will be added intentionally with each section, prioritizing one well-orchestrated load over scattered micro-interactions.

## Sound — declarative via ACS

**Policy**: UI sound is part of the design system. All cues are authored in `public/sounds/site.acs` using [`acs-audio`](https://audiocss.dev) ("Audio Cascading Style Sheets") — same selectors and cascade as CSS, properties target sound. No hand-rolled `play()` calls or event handlers in components.

The runtime is loaded once via `import "acs-audio"` in `Base.astro` and auto-binds `<link rel="audiostyle" href="/sounds/site.acs" />`. It stays silent until the first user interaction (per browser autoplay policy).

### What plays

| Selector                            | Preset                | Why                                                                                       |
| ----------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `.site-header .nav a`               | `tap-tactile`         | Soft confirmation when changing section.                                                  |
| `.site-header .brand`               | `tick` @ 0.5 vol      | Subtler — home/reset feel.                                                                |
| `.theme-toggle`                     | `tap-tactile`         | Same base; pitch shifts per new mode.                                                     |
| `:root[data-theme="light"] .theme-toggle` | + pitch `+2st`  | Higher pitch when landing in light (ACS evaluates after JS handler updates `data-theme`). |
| `:root[data-theme="dark"]  .theme-toggle` | + pitch `-2st`  | Lower pitch when landing in dark.                                                         |
| `.hero__seg [data-value="auto"]`    | `toggle-on` @ 0.7     | Hero demo segment: snap into optical center.                                              |
| `.hero__seg [data-value="off"]`     | `toggle-off` @ 0.7    | Hero demo segment: back to geometric center.                                              |
| `.hero__canvas[data-optical-state="auto"]` | `toggle-on` @ 0.7 | Same pair, applied to the canvas click.                                                   |
| `.hero__canvas[data-optical-state="off"]`  | `toggle-off` @ 0.7| —                                                                                         |
| `.hero__terminal`                   | `pop` @ 0.7           | Confirms the `npm install …` clipboard write on click.                                    |

Master volume: `0.55`, room: `small-room`. Restraint > novelty.

### Silence

- `@media (prefers-reduced-sound: reduce)` → `master-volume: 0`. Future-proof and a no-op today (the query is still a proposal, always false).
- We deliberately **do not** mute on `prefers-reduced-motion`. Motion sensitivity ≠ sound sensitivity, and ACS resolves the unknown `prefers-reduced-sound` query by falling back to `prefers-reduced-motion` — so a motion-keyed mute rule silenced the entire site for anyone with "Reduce Motion" on. Audio is decoupled from motion; a user-facing mute can be layered later via `window.ACS.setEnabled(false)`.

### Adding a new cue

1. Identify the existing class/attribute selector that already exists in the visual layer (don't add markup just for sound).
2. Add a rule in `public/sounds/site.acs` with one of the 49 built-in presets (`tap`, `pop`, `bell`, `notify`, `modal-open`, …). Custom `@sound` blocks only if no preset fits.
3. Respect the master-volume budget — combined cues should never feel busy. If a section adds 3+ sounds, audit the existing ones.

### Forbidden

- Calling `new Audio(...)` or Web Audio APIs directly outside `.acs` files.
- Inline `onclick` handlers that play sound.
- Raising `master-volume` above `0.7` without a strong reason.
- Re-coupling audio to `prefers-reduced-motion` (it silenced the whole site; use `prefers-reduced-sound`).

## What's NOT in the system

- Box shadows (depth comes from `--color-surface*` tonal shifts, not blur)
- Gradients
- Secondary chromatic neutrals — there is exactly one fg color per mode; greys come from `color-mix` against it
- Fixed grey tokens (`--color-grey-300` etc.) — derive from fg or don't use them
- Multiple accent colors
- Italic emphasis (Geist italic isn't loaded; emphasize via weight + accent)

If a future requirement seems to need one of these, push back first.

## File map

```
apps/site/
  tokens.config.mjs              — brand inputs (single source of truth)
  scripts/
    build-tokens.mjs             — runs helmlab, writes tokens.color.css
  src/
    styles/
      tokens.color.css           — GENERATED. helmlab output. do not edit.
      tokens.css                 — non-color tokens (type, spacing); @imports color.css
      base.css                   — reset + global typography
    components/
      Header.astro               — sticky header, brand, nav, theme toggle
    layouts/
      Base.astro                 — <html> shell, font + ACS loading, theme bootstrap
    pages/
      index.astro                — empty, wraps <Base />
  public/
    favicon.svg
    sounds/
      site.acs                   — UI sound design (ACS)
  DESIGN.md                      — this file
```
