/**
 * Browser-runtime entry point for component libraries that emit
 * `<svg>` elements at render time (lucide-react, @heroicons/react,
 * @iconify/react, react-icons, FontAwesome React, etc.).
 *
 * The build-time Babel plugin can't see those — by the time the user's
 * source is `<Star />` the SVG is constructed inside the component, not
 * in the AST. This module fills that gap with a small, framework-
 * agnostic primitive that:
 *
 *   1. Takes a rendered <svg> element.
 *   2. Serializes its outerHTML.
 *   3. Rasterizes it via Image + canvas (browser-native, no resvg).
 *   4. Reads pixels with ctx.getImageData().
 *   5. Calls getOpticalCenter() — the same model the build-time path uses.
 *   6. Rewrites the element's viewBox in-place.
 *
 * No React, Vue, or Solid imports here — frameworks build their own
 * thin hook on top (see examples/react-vite/src/use-optical-center.ts).
 */

import { applyOffsetToViewBox } from '../core/transform-viewbox.js';
import { formatViewBox, parseViewBoxFromSvg } from '../core/parse-viewbox.js';
import { getOpticalCenter } from '../model/final-model.js';

export interface ApplyOpticalCenterOptions {
  /** Raster size used to compute the offset. Default `120`. */
  readonly rasterSize?: number;
  /** Skip work if the element already has `data-optical-center`. Default `true`. */
  readonly idempotent?: boolean;
  /**
   * Override the rasterizer — useful for SSR (where Image/canvas don't
   * exist) or for unit tests. Returns RGBA pixels + width/height.
   */
  readonly rasterize?: (svg: string, size: number) => Promise<RasterImage>;
}

interface RasterImage {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

const BREADCRUMB_ATTR = 'data-optical-center';
const DEFAULT_RASTER_SIZE = 120;

/**
 * Apply optical-center correction to a live `<svg>` element.
 *
 * Async because the browser rasterization path needs an `Image.onload`
 * round-trip. The element's `viewBox` and breadcrumb attribute are
 * mutated in place; the returned promise resolves to the computed
 * offset (in % of element width/height) for callers that want to log
 * or display it.
 */
export async function applyOpticalCenter(
  svg: SVGSVGElement,
  options: ApplyOpticalCenterOptions = {},
): Promise<{ readonly dxPercent: number; readonly dyPercent: number } | null> {
  if (
    options.idempotent !== false &&
    svg.hasAttribute(BREADCRUMB_ATTR)
  ) {
    return null;
  }

  const size = options.rasterSize ?? DEFAULT_RASTER_SIZE;
  const rasterize = options.rasterize ?? rasterizeInBrowser;

  const markup = svg.outerHTML;
  const raster = await rasterize(markup, size);
  const offset = getOpticalCenter(raster);

  const { viewBox } = parseViewBoxFromSvg(markup);
  const next = applyOffsetToViewBox(viewBox, offset);
  svg.setAttribute('viewBox', formatViewBox(next));
  svg.setAttribute(BREADCRUMB_ATTR, '');

  return { dxPercent: offset.dxPercent, dyPercent: offset.dyPercent };
}

async function rasterizeInBrowser(
  svgMarkup: string,
  size: number,
): Promise<RasterImage> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(
      'optical-center/runtime: applyOpticalCenter requires a browser environment. ' +
        'Pass a custom `rasterize` option to use this from Node/SSR.',
    );
  }

  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('optical-center/runtime: 2d canvas unavailable');
    // Preserve aspect by scaling the longer side to `size`.
    const aspect = image.width / image.height || 1;
    const w = aspect >= 1 ? size : Math.round(size * aspect);
    const h = aspect >= 1 ? Math.round(size / aspect) : size;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);
    return {
      data: new Uint8ClampedArray(pixels.data),
      width: w,
      height: h,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('optical-center/runtime: failed to load SVG image'));
    img.src = src;
  });
}
