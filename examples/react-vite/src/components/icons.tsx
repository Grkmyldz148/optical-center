/**
 * Icon components — lucide-react / heroicons-style DX, CSS-only
 * implementation.
 *
 * Each named export renders a `<span>` with a CSS class. The actual
 * SVG mounting and optical centering happens entirely in CSS (see
 * `src/styles/icons.css`): the class declares `mask-image:
 * url('lucide-static/icons/play.svg')` and adds `optical-center: auto`.
 * The PostCSS plugin rewrites the URL to a corrected data URI at
 * build time. No JS at the icon mount point, no runtime, no React
 * hook — just the same JSX call signature you'd use with
 * lucide-react.
 *
 * Adding a new icon is two lines: a class entry here, a CSS rule
 * pair in icons.css. TypeScript autocompletes the icon name.
 *
 * Usage:
 *   import { Play, Heart, ArrowRight } from './components/icons';
 *   <Play />
 *   <Heart />
 *   <ArrowRight optical={false} />   // opt out per-usage if you want
 */

import type { CSSProperties } from 'react';

export interface IconProps {
  /**
   * Set to `false` to skip optical centering for this instance — e.g.
   * inside a button where you want the geometric center to align with
   * other icons.
   */
  readonly optical?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly title?: string;
}

/**
 * Builder: each named icon export wraps `make()` with its CSS class.
 * The wrapper is a plain function component returning a `<span>` —
 * React.memo or forwardRef would be premature here. The span is the
 * mount point; CSS does everything else.
 */
function make(iconClass: string) {
  return function Icon({
    optical = true,
    className,
    style,
    title,
  }: IconProps) {
    const classes = ['icon', iconClass];
    if (optical) classes.push('optical');
    if (className) classes.push(className);
    return (
      <span
        className={classes.join(' ')}
        style={style}
        role={title ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
      />
    );
  };
}

/**
 * Same builder, but for icons that need their original colors (rendered
 * via background-image instead of mask-image). The optical centering
 * directive applies identically.
 */
function makeBg(iconClass: string) {
  return function Icon({
    optical = true,
    className,
    style,
    title,
  }: IconProps) {
    const classes = ['bg-icon', iconClass];
    if (optical) classes.push('optical');
    if (className) classes.push(className);
    return (
      <span
        className={classes.join(' ')}
        style={style}
        role={title ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
      />
    );
  };
}

// lucide-static (npm)
export const Play        = make('icon-lucide-play');
export const ArrowRight  = make('icon-lucide-arrow-right');
export const Heart       = make('icon-lucide-heart');
export const Send        = make('icon-lucide-send');

// heroicons (npm)
export const Bell             = make('icon-heroicons-bell');
export const MagnifyingGlass  = make('icon-heroicons-magnifying-glass');

// fontawesome-free (npm) — non-square viewBoxes
export const FaPlay       = make('icon-fa-play');
export const FaStar       = make('icon-fa-star');
export const FaPaperPlane = make('icon-fa-paper-plane');

// background-image (full-color)
export const FaFlag = makeBg('bg-icon-fa-flag');
