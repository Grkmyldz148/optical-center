/**
 * Browser-safe public API.
 *
 * Re-exports the model (the actual algorithm) and the build-time core
 * (viewBox math, parsing, types, version, warnings). Native helpers
 * (`rasterizeSvg`, `transformViewBoxFromSvg`) live under
 * `optical-center/node`; the cache layer under `optical-center/cli`
 * surfaces or via direct subpath import — neither is loaded by anything
 * a browser bundler would walk into.
 */

export * from './model/index.js';
export * from './core/index.js';
