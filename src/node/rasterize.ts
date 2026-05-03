/**
 * Node-only SVG rasterization. Wraps `@resvg/resvg-js` so consumers don't
 * have to think about platform bindings or font loading defaults.
 *
 * Why not in the default entry?
 *   `@resvg/resvg-js` ships native bindings; pulling it into the browser
 *   bundle (Storybook preview, edge runtime) would break those targets.
 *   Keeping it under `optical-center/node` lets browser users consume the
 *   pure-TS pipeline (`getOpticalCenter`, `transformViewBox`) without ever
 *   touching the native dep.
 */

import { Resvg } from '@resvg/resvg-js';

import { MAX_INPUT_BYTES, MAX_RASTER_SIZE, RASTER_SIZE } from '../core/constants.js';
import type { RasterImage } from '../core/types.js';

export interface RasterizeOptions {
  /**
   * Target dimension (the longer of width/height) in raster pixels.
   * Default `120` — the size the V2 model was validated at. Clamped to
   * [16, MAX_RASTER_SIZE] to bound resvg memory.
   */
  readonly size?: number;
  /**
   * Whether resvg may scan the host's system fonts. Default `false` so
   * builds remain deterministic across machines and CI doesn't accidentally
   * embed a developer-laptop font into a snapshot.
   *
   * Opt in only when rasterizing icons that contain real `<text>` runs.
   */
  readonly loadSystemFonts?: boolean;
}

/**
 * Rasterize an SVG string to an RGBA pixel buffer suitable for the
 * optical-center pipeline.
 *
 * Throws when the SVG exceeds `MAX_INPUT_BYTES` or when resvg can't parse
 * the input (the underlying error is rethrown verbatim — the caller decides
 * whether to bail out, warn, or surface the file path).
 */
export function rasterizeSvg(
  svg: string,
  options?: RasterizeOptions,
): RasterImage {
  if (svg.length > MAX_INPUT_BYTES) {
    throw new Error(
      `SVG input exceeds MAX_INPUT_BYTES (${svg.length} > ${MAX_INPUT_BYTES})`,
    );
  }

  const size = clamp(options?.size ?? RASTER_SIZE, 16, MAX_RASTER_SIZE);
  const loadSystemFonts = options?.loadSystemFonts ?? false;

  // resvg's underlying parser rejects SVGs without the namespace declaration
  // ("does not have a root node"). JSX-serialized SVG and authored snippets
  // routinely omit it, so we patch it in at the boundary rather than asking
  // every caller to remember.
  const normalized = ensureSvgNamespace(svg);

  const resvg = new Resvg(normalized, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts },
  });

  const rendered = resvg.render();

  return {
    data: new Uint8ClampedArray(rendered.pixels),
    width: rendered.width,
    height: rendered.height,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_OPENING = /<svg\b([^>]*)>/i;

function ensureSvgNamespace(svg: string): string {
  const match = svg.match(SVG_OPENING);
  if (!match) return svg;
  const attrs = match[1] ?? '';
  if (/\bxmlns\s*=/.test(attrs)) return svg;
  const next = `<svg xmlns="${SVG_NS}"${attrs}>`;
  return svg.replace(match[0], next);
}
