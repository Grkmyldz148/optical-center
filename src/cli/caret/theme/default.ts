/**
 * Caret default theme
 *
 * The single source of truth for Caret's default visual identity.
 * Every value here is a token. Modify this file to globally re-skin
 * Caret without touching any component. Or override per-call via
 * PartialTheme passed to setTheme() or component options.
 *
 * The structure mirrors the Theme type in ./types.ts.
 *
 * COLOR AUTHORING:
 * Color values are sRGB hex. They are intended to be regenerated from
 * Helmlab GenSpace inputs documented in the comments. The build pipeline
 * `pnpm tokens:generate` (not yet implemented) will produce these values
 * from the Helmlab source.
 */

import type { Theme } from './types.js'

export const defaultTheme: Theme = {
  // ──────────────────────────────────────────────────────────────────
  // COLORS
  // ──────────────────────────────────────────────────────────────────
  colors: {
    // Brand accent — fixed truecolor, matches the landing page orange
    // (apps/site tokens.color.css: --color-accent / --color-accent-text)
    // Helmlab inputs (PROPOSED):  { hue: 45, chroma: 0.16 }
    accent: {
      default: '#E8734A',
      muted: '#BE4E24',
      emphasized: '#FF9D73',
    },

    // Semantic states — ANSI named (theme-respectful) + truecolor fallback
    // Helmlab inputs (PROPOSED):
    //   success: { hue: 155, chroma: 0.16 }
    //   warning: { hue: 85,  chroma: 0.17 }
    //   danger:  { hue: 25,  chroma: 0.21 }
    //   info:    { hue: 235, chroma: 0.12 }
    semantic: {
      success: { ansi: 'green', truecolor: '#3FBF6F' },
      warning: { ansi: 'yellow', truecolor: '#E5A823' },
      danger: { ansi: 'red', truecolor: '#E5482D' },
      info: { ansi: 'blue', truecolor: '#5A9CD8' },
    },

    // Foreground hierarchy — attribute-based, respects user terminal theme
    fg: {
      default: { bold: false, dim: false, italic: false },
      muted: { bold: false, dim: true, italic: false },
      subtle: { bold: false, dim: true, italic: true },
      bold: { bold: true, dim: false, italic: false },
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // MOTION
  // ──────────────────────────────────────────────────────────────────
  motion: {
    duration: {
      instant: 80, // sub-perceptual transitions
      quick: 150, // most micro-interactions
      default: 200, // standard transition
      max: 300, // hard cap — do not exceed
    },
    easing: {
      // Manifesto default — linear until a case specifically benefits from easing
      linear: 'linear',
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
    },
    spinnerFrameMs: 80,
    staggerMs: 40, // list reveal offset per item
  },

  // ──────────────────────────────────────────────────────────────────
  // SYMBOLS
  // ──────────────────────────────────────────────────────────────────
  symbols: {
    anchor: '^',
    prefix: { focused: '▸', idle: '·' },
    marker: { selected: '●', unselected: '○' },
    state: {
      success: '✓',
      failure: '✗',
      warning: '⚠',
      info: 'ℹ',
      cancelled: '—',
    },
    structure: { gutter: '│' },
    progress: { arrow: '→', filled: '━', empty: '─', head: '╸' },
    borders: {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
      tLeft: '├',
      tRight: '┤',
      tTop: '┬',
      tBottom: '┴',
      cross: '┼',
    },
    bullet: '•',
    leader: '·',
    ruler: '─',
    cursor: '▎',
    ellipsis: '…',
    tree: {
      branch: '├──',
      lastBranch: '└──',
      vertical: '│  ',
      space: '   ',
    },
    diff: {
      added: '+',
      removed: '-',
      unchanged: ' ',
    },
    spinner: {
      braille: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // SPACING
  // ──────────────────────────────────────────────────────────────────
  spacing: {
    none: 0,
    xs: 1,
    sm: 2,
    md: 4,
    lg: 6,
    xl: 8,
    page: 4, // top-level page indent — the magazine margin
    indent: 2, // component indent after the `^` anchor
    gap: 2, // the Caret inline gap
    sectionBefore: 2, // blank lines before a section heading
    sectionAfter: 1, // blank lines after a section heading
    section: 1, // @deprecated — use sectionBefore / sectionAfter
  },

  // ──────────────────────────────────────────────────────────────────
  // TYPOGRAPHY
  // ──────────────────────────────────────────────────────────────────
  typography: {
    // Canonical manifesto roles
    display: { bold: true, dim: false, italic: false }, // used with tracking()
    heading: { bold: true, dim: false, italic: false }, // used with tracking()
    label: { bold: true, dim: false, italic: false },
    body: { bold: false, dim: false, italic: false },
    strong: { bold: true, dim: false, italic: false },
    muted: { bold: false, dim: true, italic: false },
    subtle: { bold: false, dim: true, italic: true },
    code: { bold: false, dim: false, italic: false },
    // Legacy aliases — backward compatibility
    quiet: { bold: false, dim: true, italic: false },
    emphasis: { bold: false, dim: false, italic: true },
    description: { bold: false, dim: true, italic: false },
    hintFooter: { bold: false, dim: true, italic: true },
  },
}
