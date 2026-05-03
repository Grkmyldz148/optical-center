// Node-only entry point. Pulls in `@resvg/resvg-js` (native binding) and
// composes it with the browser-safe pipeline so consumers can go straight
// from "SVG string" to "transformed viewBox" without wiring rasterization
// themselves.

export { rasterizeSvg } from './rasterize.js';
export type { RasterizeOptions } from './rasterize.js';

export { transformViewBoxFromSvg } from './transform-viewbox-from-svg.js';
export type { TransformViewBoxFromSvgOptions } from './transform-viewbox-from-svg.js';

export { sanitizeSvg } from './sanitize.js';
export type { SanitizeOptions } from './sanitize.js';

// Re-export the browser-safe API for convenience: a single import line
// from `optical-center/node` covers the whole pipeline.
export {
  ALGORITHM_VERSION,
  ALPHA_THRESHOLD,
  CORRECTION_SCALE,
  DEFAULT_TIMEOUT_MS,
  MAX_INPUT_BYTES,
  MAX_RASTER_SIZE,
  RASTER_SIZE,
  applyOffsetToViewBox,
  computeOffsetV2,
  formatViewBox,
  getOpticalCenter,
  getRasterBbox,
  parseViewBoxFromSvg,
  parseViewBoxString,
  transformViewBox,
} from '../index.js';
export type {
  Bbox,
  ComputeOptionsV2,
  OpticalCenterResult,
  OpticalOffset,
  OpticalOffsetPercent,
  ParsedSvgViewBox,
  RasterImage,
  ViewBoxBreadcrumb,
  ViewBoxNumeric,
  ViewBoxSource,
  ViewBoxTransformOptions,
  ViewBoxTransformResult,
} from '../index.js';
