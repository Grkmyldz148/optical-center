// Public API — browser-safe core. Node-only helpers (rasterizeSvg,
// transformViewBoxFromSvg) live under the `optical-center/node` subpath
// so this entry stays free of native bindings.

export { CORRECTION_SCALE, getOpticalCenter } from './final-model.js';
export type { OpticalCenterResult } from './final-model.js';

export { computeOffsetV2 } from './compute-offset.js';
export type { ComputeOptionsV2, OpticalOffset } from './compute-offset.js';

export {
  applyOffsetToViewBox,
  getRasterBbox,
  transformViewBox,
} from './transform-viewbox.js';
export type {
  OpticalOffsetPercent,
  ViewBoxTransformOptions,
  ViewBoxTransformResult,
} from './transform-viewbox.js';

export {
  formatViewBox,
  parseViewBoxFromSvg,
  parseViewBoxString,
} from './parse-viewbox.js';
export type { ParsedSvgViewBox, ViewBoxSource } from './parse-viewbox.js';

export type {
  Bbox,
  RasterImage,
  ViewBoxBreadcrumb,
  ViewBoxNumeric,
} from './types.js';

export {
  ALPHA_THRESHOLD,
  DEFAULT_TIMEOUT_MS,
  MAX_INPUT_BYTES,
  MAX_RASTER_SIZE,
  RASTER_SIZE,
} from './constants.js';

export { ALGORITHM_VERSION } from './version.js';
