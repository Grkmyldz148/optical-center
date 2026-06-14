/**
 * Caret runtime capability detection.
 *
 * Determines what the current terminal can render so components can
 * gracefully degrade. Result is cached per-process; call refreshCapability()
 * if you need to re-detect after a terminal resize or env change.
 */

export type Capability = {
  /** Is stdout connected to a real terminal? */
  isTTY: boolean
  /** Is stdin connected to a real terminal? (separate; piped input is common) */
  isStdinTTY: boolean
  /** True color (24-bit RGB) supported? */
  truecolor: boolean
  /** 256-color palette supported? */
  color256: boolean
  /** Is color of any kind supported and not disabled? */
  hasColor: boolean
  /** NO_COLOR env var set, or terminal has no color support */
  noColor: boolean
  /** Reduced motion requested via CARET_REDUCED_MOTION */
  reducedMotion: boolean
  /** Caret-level notification override (CARET_NO_NOTIFY) */
  noNotify: boolean
  /** Terminal columns (defaults to 80 if unavailable) */
  columns: number
  /** Terminal rows (defaults to 24 if unavailable) */
  rows: number
  /** Is this a "dumb" terminal that can't do cursor positioning? */
  dumb: boolean
  /** Can the terminal render Unicode characters reliably? */
  unicode: boolean
  /** Is the terminal narrow enough to require degraded layout? (<40 cols) */
  narrow: boolean
}

let cached: Capability | null = null

export function capability(): Capability {
  if (cached) return cached
  cached = detect()
  return cached
}

export function refreshCapability(): Capability {
  cached = detect()
  return cached
}

function detect(): Capability {
  const isTTY = Boolean(process.stdout.isTTY)
  const isStdinTTY = Boolean(process.stdin.isTTY)

  const term = process.env['TERM'] ?? ''
  const colorTerm = process.env['COLORTERM'] ?? ''

  const noColorEnv = process.env['NO_COLOR']
  const noColor = noColorEnv != null && noColorEnv !== ''

  const reducedMotion =
    process.env['CARET_REDUCED_MOTION'] === '1' ||
    process.env['CARET_REDUCED_MOTION'] === 'true'

  const noNotify =
    process.env['CARET_NO_NOTIFY'] === '1' ||
    process.env['CARET_NO_NOTIFY'] === 'true'

  const dumb = term === 'dumb' || term === ''

  const truecolor =
    !noColor && !dumb && (colorTerm === 'truecolor' || colorTerm === '24bit')

  const color256 = !noColor && !dumb && /256(color)?/i.test(term)

  const hasColor = !noColor && !dumb && isTTY

  const columns = process.stdout.columns ?? 80
  const rows = process.stdout.rows ?? 24
  const narrow = columns < 40

  // Crude unicode detection — modern terminals on macOS, Windows Terminal,
  // and any UTF-8 locale can render the Caret symbol set.
  const lang = (process.env['LANG'] ?? '').toUpperCase()
  const lcAll = (process.env['LC_ALL'] ?? '').toUpperCase()
  const unicode =
    !dumb &&
    (lang.includes('UTF') ||
      lcAll.includes('UTF') ||
      process.platform === 'darwin' ||
      process.platform === 'win32')

  return {
    isTTY,
    isStdinTTY,
    truecolor,
    color256,
    hasColor,
    noColor,
    reducedMotion,
    noNotify,
    columns,
    rows,
    dumb,
    unicode,
    narrow,
  }
}
