/**
 * Caret typography helpers
 *
 * Two utilities that encode the two Caret signature conventions
 * documented in specs/look.md:
 *
 *   1. tracking()       — letter-spaced CAPS for titles
 *   2. dottedLeader()   — label · · · · · · value alignment
 *
 * Both are ASCII-aware: they compute width from visible length,
 * ignoring ANSI color escapes so callers can pre-color their
 * inputs. Neither touches color — use paint helpers separately.
 */

import { visibleLength } from './paint.js'

// ─────────────────────────────────────────────────────────────
// tracking()
// ─────────────────────────────────────────────────────────────

/**
 * Letter-spaced UPPERCASE — the Caret signature for section titles.
 *
 * Inserts a single space between each character of the input, after
 * uppercasing. Word boundaries collapse naturally: "Caret CLI" becomes
 * "C A R E T   C L I" (two spaces between words, because the original
 * space becomes one of the inter-letter spaces).
 *
 * Use for: display titles, section headings, subsection labels, prompt
 * labels, confirm markers. Never for body, values, paths, or errors.
 * See specs/look.md § Typography for the full rule.
 *
 * @example
 *   tracking('Caret')            // → 'C A R E T'
 *   tracking('Deploying')        // → 'D E P L O Y I N G'
 *   tracking('Confirm deploy?')  // → 'C O N F I R M   D E P L O Y ?'
 */
export function tracking(text: string): string {
  if (text.length === 0) return ''
  return text.toUpperCase().split('').join(' ')
}

/**
 * Visual length of a tracked string — useful when laying out rows
 * that mix tracked titles with untracked content.
 *
 * For a string of length N, tracking() produces a string of length
 * 2N - 1 (N characters with N - 1 spaces between them).
 */
export function trackingLength(text: string): number {
  if (text.length === 0) return 0
  return text.length * 2 - 1
}

// ─────────────────────────────────────────────────────────────
// dottedLeader()
// ─────────────────────────────────────────────────────────────

/**
 * Options for dottedLeader.
 */
export interface DottedLeaderOptions {
  /**
   * Total visible width of the resulting row in characters.
   * The leader fills whatever space is left after label and value.
   */
  width: number
  /**
   * The dot character used in the leader. Defaults to middle dot
   * (U+00B7) per the manifesto.
   */
  dot?: string
  /**
   * Minimum number of dots, enforced even when label and value
   * already exceed the target width. Defaults to 3.
   */
  minDots?: number
  /**
   * Padding space on each side of the dot run. Defaults to 1
   * (yielding "label · · · value"). Set to 0 for a flush leader.
   */
  pad?: number
}

/**
 * Render a label / value row joined by a dotted leader.
 *
 * The leader is a run of the dot character, flanked by single-space
 * padding, filling the gap between the label and the value so the
 * row is exactly `width` characters wide.
 *
 * Uses visibleLength internally, so inputs may already contain ANSI
 * color escapes — only visible characters are counted.
 *
 * When the label and value together already meet or exceed the
 * target width, the leader collapses to `minDots` dots (so the row
 * is still recognizable as a leader row even when overflowing).
 *
 * @example
 *   dottedLeader('Region', 'us-east-1', { width: 30 })
 *   // → 'Region · · · · · · · · us-east-1'
 *
 *   dottedLeader('Name', 'John', { width: 20, dot: '.' })
 *   // → 'Name ............ John'
 */
export function dottedLeader(
  label: string,
  value: string,
  options: DottedLeaderOptions,
): string {
  const dot = options.dot ?? '·'
  const minDots = options.minDots ?? 3
  const pad = options.pad ?? 1

  const labelLen = visibleLength(label)
  const valueLen = visibleLength(value)

  // Budget: total width − label − value − (2 × pad spaces)
  const available = options.width - labelLen - valueLen - pad * 2
  const dotCount = Math.max(minDots, available)

  const padStr = ' '.repeat(pad)
  return label + padStr + dot.repeat(dotCount) + padStr + value
}

/**
 * Render a dotted-leader row where the leader is *left-anchored*
 * to a specific label column width, not to the overall row width.
 *
 * Useful for aligning multiple rows: each row's dots start at the
 * same column regardless of label length.
 *
 * @example
 *   const rows = [
 *     leaderAt('Region',      'us-east-1', 16, 40),
 *     leaderAt('Environment', 'prod',      16, 40),
 *   ]
 *   // →
 *   // 'Region       · · · · · · · · · · · us-east-1'
 *   // 'Environment  · · · · · · · · · · · · · · prod'
 */
export function leaderAt(
  label: string,
  value: string,
  labelCol: number,
  width: number,
  options: Omit<DottedLeaderOptions, 'width'> = {},
): string {
  const dot = options.dot ?? '·'
  const minDots = options.minDots ?? 3
  const pad = options.pad ?? 1

  const labelLen = visibleLength(label)
  const valueLen = visibleLength(value)

  // Label is padded to labelCol with spaces; leader starts there.
  const labelSpacing = Math.max(1, labelCol - labelLen)
  const available = width - labelCol - valueLen - pad
  const dotCount = Math.max(minDots, available)

  return label + ' '.repeat(labelSpacing) + dot.repeat(dotCount) + ' '.repeat(pad) + value
}
