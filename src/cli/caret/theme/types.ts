/**
 * Caret Theme — type definitions
 *
 * The Theme is the single source of truth for visual decisions across
 * all Caret components. These types define its shape; the default theme
 * lives in default.ts and is composed from the token modules in
 * ../tokens/.
 *
 * Users override the theme via PartialTheme — every key is deep-optional.
 */

// === Color types ===

export type AnsiColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright'

export type SemanticColor = {
  /** ANSI 16 named color — respects user terminal theme */
  ansi: AnsiColor
  /** Truecolor sRGB hex — Caret-controlled fallback */
  truecolor: string
}

export type FgAttribute = {
  bold: boolean
  dim: boolean
  italic: boolean
}

export type ColorPalette = {
  /** Brand accent — Caret's recognizable signature */
  accent: {
    default: string
    muted: string
    emphasized: string
  }
  /** Semantic state colors — emit ANSI named, truecolor optional */
  semantic: {
    success: SemanticColor
    warning: SemanticColor
    danger: SemanticColor
    info: SemanticColor
  }
  /** Foreground hierarchy — attribute-based, respects user theme */
  fg: {
    default: FgAttribute
    muted: FgAttribute
    subtle: FgAttribute
    bold: FgAttribute
  }
}

// === Motion types ===

export type MotionTokens = {
  duration: {
    instant: number
    quick: number
    default: number
    max: number
  }
  easing: {
    /** Manifesto default — linear */
    linear: string
    standard: string
    emphasized: string
  }
  /** Spinner braille frame tempo (ms per frame) */
  spinnerFrameMs: number
  /** List reveal stagger — offset per item (ms) */
  staggerMs: number
}

// === Symbol types ===

export type SymbolSet = {
  anchor: string
  prefix: { focused: string; idle: string }
  marker: { selected: string; unselected: string }
  state: {
    success: string
    failure: string
    warning: string
    info: string
    cancelled: string
  }
  structure: { gutter: string }
  progress: {
    arrow: string
    filled: string
    empty: string
    head: string
  }
  borders: {
    topLeft: string
    topRight: string
    bottomLeft: string
    bottomRight: string
    horizontal: string
    vertical: string
    tLeft: string
    tRight: string
    tTop: string
    tBottom: string
    cross: string
  }
  bullet: string
  /** Dotted leader character (U+00B7) */
  leader: string
  /** Horizontal ruler under section headings */
  ruler: string
  /** Input cursor block */
  cursor: string
  ellipsis: string
  tree: {
    branch: string
    lastBranch: string
    vertical: string
    space: string
  }
  diff: {
    added: string
    removed: string
    unchanged: string
  }
  spinner: { braille: readonly string[] }
}

// === Spacing types ===

export type SpacingScale = {
  none: number
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  /** Top-level page indent (manifesto: 4) */
  page: number
  /** Component indent after the `^` anchor */
  indent: number
  /** Inline gap — "the Caret number is 2" */
  gap: number
  /** Blank lines before a section heading */
  sectionBefore: number
  /** Blank lines after a section heading */
  sectionAfter: number
  /** @deprecated use sectionBefore / sectionAfter */
  section: number
}

// === Typography types ===

export type TypographyScale = {
  /** Display brand title — bold, used with tracking() */
  display: FgAttribute
  /** Section heading — bold, used with tracking() */
  heading: FgAttribute
  /** Component label / form field name — bold */
  label: FgAttribute
  /** Default body text */
  body: FgAttribute
  /** Strong emphasis within body */
  strong: FgAttribute
  /** Secondary / meta — dim */
  muted: FgAttribute
  /** Tertiary / hint / placeholder — dim + italic */
  subtle: FgAttribute
  /** Inline code */
  code: FgAttribute
  // Legacy aliases — kept for backward compatibility
  /** @deprecated use `muted` */
  quiet: FgAttribute
  emphasis: FgAttribute
  /** @deprecated use `muted` */
  description: FgAttribute
  /** @deprecated use `subtle` */
  hintFooter: FgAttribute
}

// === Theme ===

export type Theme = {
  colors: ColorPalette
  motion: MotionTokens
  symbols: SymbolSet
  spacing: SpacingScale
  typography: TypographyScale
}

/** Deep-partial Theme — every key is optional at every level. */
export type PartialTheme = DeepPartial<Theme>

type DeepPartial<T> = T extends ReadonlyArray<infer _U>
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T
