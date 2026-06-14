/**
 * Curated playground icon set.
 *
 * `icons.json` is an Iconify-shaped collection, so the official
 * `optical-center/vite` plugin body-wraps every icon at build/dev time —
 * exactly the same path the stress view uses. There is no precompute
 * script and no committed offset file: the corrected geometry arrives
 * baked into the imported JSON.
 *
 * From the plugin's output we derive, at module load, everything the views
 * need — pure string work, zero model:
 *
 *   corrected body  <g transform="translate(dx dy)">SOURCE</g>
 *   source body     SOURCE                     (wrapper stripped)
 *   optical viewBox  [left - dx, top - dy, w, h]
 *                    (a body translate t is equivalent to shifting the
 *                     viewBox window origin by -t — so x' = x - dx)
 */

import iconSet from './icons.json';

export type ViewBox = readonly [number, number, number, number];

export interface PlaygroundIcon {
  /** Stable identifier — the key in `icons.json`'s `icons` map. */
  readonly id: string;
  /** Human-readable label shown in the picker. */
  readonly name: string;
  /** Source viewBox as it lives in the SVG body. */
  readonly viewBox: ViewBox;
  /** Corrected viewBox, reconstructed from the plugin's body-wrap. */
  readonly opticalViewBox: ViewBox;
  /** Inner SVG body — source markup, wrapper stripped. */
  readonly body: string;
  /** Default paint mode — useful for the picker's preview swatch. */
  readonly paintMode: 'stroke' | 'fill';
}

interface IconRecord {
  readonly name?: string;
  readonly paintMode?: 'stroke' | 'fill';
  readonly body: string;
  readonly width?: number;
  readonly height?: number;
  readonly left?: number;
  readonly top?: number;
}

interface IconCollection {
  readonly width?: number;
  readonly height?: number;
  readonly left?: number;
  readonly top?: number;
  readonly icons: Record<string, IconRecord>;
}

const SET = iconSet as unknown as IconCollection;

/** Pull the optical translate back out of the plugin's body-wrap. */
const WRAP =
  /^<g transform="translate\(\s*(-?[\d.eE]+)\s+(-?[\d.eE]+)\s*\)">([\s\S]*)<\/g>$/;

function splitOpticalWrap(body: string): {
  dx: number;
  dy: number;
  source: string;
} {
  const match = body.match(WRAP);
  if (!match) return { dx: 0, dy: 0, source: body };
  return {
    dx: Number(match[1]),
    dy: Number(match[2]),
    source: match[3] ?? body,
  };
}

function num(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export const ICONS: readonly PlaygroundIcon[] = Object.entries(SET.icons).map(
  ([id, record]) => {
    const left = num(record.left, num(SET.left, 0));
    const top = num(record.top, num(SET.top, 0));
    const width = num(record.width, num(SET.width, 24));
    const height = num(record.height, num(SET.height, 24));
    const { dx, dy, source } = splitOpticalWrap(record.body);
    return {
      id,
      name: record.name ?? id,
      paintMode: record.paintMode ?? 'fill',
      viewBox: [left, top, width, height] as const,
      // A body translate of (dx, dy) renders identically to shifting the
      // viewBox window origin by (-dx, -dy).
      opticalViewBox: [left - dx, top - dy, width, height] as const,
      body: source,
    };
  },
);

export type IconId = (typeof ICONS)[number]['id'];

export function getIcon(id: string): PlaygroundIcon {
  const hit = ICONS.find((i) => i.id === id);
  if (!hit) throw new Error(`Unknown icon id: ${id}`);
  return hit;
}

/**
 * Materialize an icon as a complete `<svg>` string. The optional
 * `viewBox` argument lets callers pick which window to emit — the
 * original or the optical-corrected one.
 */
export function toSvgString(
  icon: PlaygroundIcon,
  viewBox: ViewBox = icon.viewBox,
): string {
  const [x, y, w, h] = viewBox;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">${icon.body}</svg>`;
}

/**
 * Convert a pair of (original, optical) viewBoxes into the
 * percent-of-icon translate that the Babel JSX-attribute scenario
 * would emit. Useful for the readout that prints what the offset
 * "would have been" had we shipped translate instead of a viewBox
 * rewrite.
 */
export function offsetPercent(icon: PlaygroundIcon): {
  dxPercent: number;
  dyPercent: number;
} {
  const [ox, oy, ow, oh] = icon.viewBox;
  const [px, py] = icon.opticalViewBox;
  return {
    dxPercent: ((ox - px) / ow) * 100,
    dyPercent: ((oy - py) / oh) * 100,
  };
}
