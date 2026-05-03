/**
 * The original optical-centering model — the algorithmic core of the
 * project. Everything in this folder is platform-agnostic: it consumes a
 * raw RGBA buffer and returns numerical offsets, with no I/O, no DOM, no
 * file system, no native bindings.
 *
 * Dependency direction is one-way: the rest of the package (core, cache,
 * node, babel, vite, cli) may import from here; this folder imports
 * nothing back.
 */

export { CORRECTION_SCALE, getOpticalCenter } from './final-model.js';
export type { OpticalCenterResult } from './final-model.js';

export { computeOffset, computeOffsetFromWeightMap, computeOffsetV2 } from './compute-offset.js';
export type { ComputeOptions, ComputeOptionsV2, OpticalOffset } from './compute-offset.js';

export {
  buildWeightMap,
  buildWeightMapFromBuffer,
  computeWeightedCentroid,
  rgbToLuminance,
} from './analyzer.js';
export type { AnalyzerOptions, PixelData } from './analyzer.js';

export { convexHull, extractBoundaryPoints, hullCentroid } from './convex-hull.js';
export type { Point } from './convex-hull.js';

export {
  DEFAULT_PERCEPTUAL_CONFIG,
  analyzeAsymmetry,
  applyShapeCorrection,
  applyVerticalBias,
  blendCentroids,
} from './perceptual.js';
export type { PerceptualConfig } from './perceptual.js';

export {
  DEFAULT_PREPROCESSING_CONFIG,
  applyDoG,
  applyPowerCompression,
  gaussianBlur,
  makeGaussianKernel,
  preprocessWeightMap,
} from './preprocessing.js';
export type { PreprocessingConfig } from './preprocessing.js';

export {
  analyzeSymmetry,
  computeBilateralSymmetry,
  computeRadialSymmetry,
  computeSymmetryAxis,
  computeSymmetryCorrection,
} from './symmetry.js';
export type {
  SymmetryAxisResult,
  SymmetryCorrection,
  SymmetryResult,
} from './symmetry.js';
