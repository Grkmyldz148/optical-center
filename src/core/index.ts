/**
 * Build-time primitives — browser-safe, zero native bindings.
 *
 * Anything that turns the model's output into something a build tool can
 * use lives here: viewBox parsing, SVG string surgery, shared types and
 * constants, version metadata, the warning code registry.
 *
 * May import from `../model`. Must NOT import from `../cache`, `../node`,
 * `../babel`, `../vite`, or `../cli` — those depend on this folder, not
 * the other way around.
 */

export { applyTransformToSvg } from './apply-to-svg.js';
export type { SvgTransformPatch } from './apply-to-svg.js';

export {
  ALPHA_THRESHOLD,
  DEFAULT_TIMEOUT_MS,
  MAX_INPUT_BYTES,
  MAX_RASTER_SIZE,
  RASTER_SIZE,
} from './constants.js';

export {
  formatViewBox,
  parseViewBoxFromSvg,
  parseViewBoxString,
} from './parse-viewbox.js';
export type { ParsedSvgViewBox, ViewBoxSource } from './parse-viewbox.js';

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

export type {
  Bbox,
  RasterImage,
  ViewBoxBreadcrumb,
  ViewBoxNumeric,
} from './types.js';

export { ALGORITHM_VERSION } from './version.js';

export { WARNINGS, buildWarning } from './warnings.js';
export type {
  BuildWarningOptions,
  WarningCode,
  WarningDefinition,
  WarningRecord,
  WarningSeverity,
} from './warnings.js';
