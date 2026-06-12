/**
 * Optical Center Offset Computation
 *
 * Main API: takes pixel data and returns the offset needed to
 * shift an element from its geometric center to its optical center.
 *
 * Pipeline (v2 — biologically inspired):
 *
 *   pixels → weight map → DoG filter → power compression
 *          → edge centroid (40%)
 *          → hull centroid (30%)
 *          → symmetry-axis center (30%)
 *          → vertical bias (shape-dependent)
 *          → offset
 *
 * The v1 pipeline (computeOffset) is preserved for backward compatibility
 * and A/B comparison in Phase 2 studies.
 */

import { buildWeightMap, computeWeightedCentroid, type PixelData } from './analyzer.js';
import { convexHull, extractBoundaryPoints, hullCentroid } from './convex-hull.js';
import {
  analyzeAsymmetry,
  applyShapeCorrection,
  applyVerticalBias,
  blendCentroids,
  DEFAULT_PERCEPTUAL_CONFIG,
  type PerceptualConfig,
} from './perceptual.js';
import {
  preprocessWeightMap,
  DEFAULT_PREPROCESSING_CONFIG,
  type PreprocessingConfig,
} from './preprocessing.js';
import { analyzeSymmetry, computeSymmetryCorrection } from './symmetry.js';

export interface OpticalOffset {
  /** Horizontal offset in pixels (positive = shift right) */
  dx: number;
  /** Vertical offset in pixels (positive = shift down) */
  dy: number;
  /** Horizontal offset as percentage of element width */
  dxPercent: number;
  /** Vertical offset as percentage of element height */
  dyPercent: number;
  /** Debug info */
  debug: {
    geometricCenter: { x: number; y: number };
    massCentroid: { x: number; y: number };
    hullCentroid: { x: number; y: number };
    opticalCenter: { x: number; y: number };
    asymmetry: { asymX: number; asymY: number };
    totalWeight: number;
    /** v2 only: additional debug data */
    edgeCentroid?: { x: number; y: number };
    symmetryAxisCenter?: { x: number; y: number };
    pipelineVersion?: 'v1' | 'v2';
  };
}

export interface ComputeOptions {
  /** Perceptual correction config */
  perceptual?: Partial<PerceptualConfig>;
  /** Sampling step for convex hull boundary extraction (default: 2) */
  hullStep?: number;
  /**
   * Global scaling factor applied to final dx/dy offset.
   * Default: 0.5
   */
  correctionScale?: number;
}

export interface ComputeOptionsV2 extends ComputeOptions {
  /** Preprocessing config (DoG, compression) */
  preprocessing?: Partial<PreprocessingConfig>;
  /** Weight for edge centroid in blend. Default: 0.40 */
  edgeWeight?: number;
  /** Weight for hull centroid in blend. Default: 0.30 */
  hullWeight?: number;
  /** Weight for symmetry-axis center in blend. Default: 0.30 */
  symmetryWeight?: number;
}

// ---------------------------------------------------------------------------
// V1 Pipeline (preserved for backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Compute the optical center offset from raw RGBA image data.
 * This is the original v1 pipeline: mass + hull blend → shape correction → vertical bias.
 *
 * @param imageData - Raw RGBA pixel data (e.g. from canvas.getImageData())
 * @param options - Configuration options
 * @returns OpticalOffset with dx/dy in pixels and percentages
 */
export function computeOffset(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  options: ComputeOptions = {}
): OpticalOffset {
  const config: PerceptualConfig = {
    ...DEFAULT_PERCEPTUAL_CONFIG,
    ...options.perceptual,
  };
  const hullStep = options.hullStep ?? 2;
  const scale = options.correctionScale ?? 0.5;

  const { width, height } = imageData;

  // Step 1: Build visual weight map
  const pixelData = buildWeightMap(imageData);

  // Step 2: Compute weighted mass centroid
  const mass = computeWeightedCentroid(pixelData);

  // Short-circuit for empty images (no visible pixels)
  if (mass.totalWeight === 0) {
    const geometricCenter = { x: width / 2, y: height / 2 };
    return {
      dx: 0,
      dy: 0,
      dxPercent: 0,
      dyPercent: 0,
      debug: {
        geometricCenter,
        massCentroid: geometricCenter,
        hullCentroid: geometricCenter,
        opticalCenter: geometricCenter,
        asymmetry: { asymX: 0, asymY: 0 },
        totalWeight: 0,
        pipelineVersion: 'v1',
      },
    };
  }

  // Step 3: Compute convex hull centroid
  const boundaryPoints = extractBoundaryPoints(
    pixelData.weights,
    width,
    height,
    0.01,
    hullStep
  );
  const hull = convexHull(boundaryPoints);
  const hullCenter = hullCentroid(hull);

  // Step 4: Blend mass and hull centroids
  let optical = blendCentroids(
    { x: mass.cx, y: mass.cy },
    hullCenter,
    config.hullWeight
  );

  // Step 5: Analyze asymmetry and apply shape corrections
  const asymmetry = analyzeAsymmetry(pixelData.weights, width, height);

  if (config.shapeCorrection) {
    optical = applyShapeCorrection(
      optical.x,
      optical.y,
      width,
      height,
      asymmetry
    );
  }

  // Step 6: Apply vertical perceptual bias
  optical.y = applyVerticalBias(optical.y, height, config.verticalBias);

  // Step 7: Compute offset from geometric center, scaled by correctionScale
  const geometricCenter = { x: width / 2, y: height / 2 };
  const dx = (geometricCenter.x - optical.x) * scale;
  const dy = (geometricCenter.y - optical.y) * scale;

  return {
    dx,
    dy,
    dxPercent: width > 0 ? (dx / width) * 100 : 0,
    dyPercent: height > 0 ? (dy / height) * 100 : 0,
    debug: {
      geometricCenter,
      massCentroid: { x: mass.cx, y: mass.cy },
      hullCentroid: hullCenter,
      opticalCenter: optical,
      asymmetry,
      totalWeight: mass.totalWeight,
      pipelineVersion: 'v1',
    },
  };
}

/**
 * Compute offset from a PixelData (pre-built weight map). V1 pipeline.
 */
export function computeOffsetFromWeightMap(
  pixelData: PixelData,
  options: ComputeOptions = {}
): OpticalOffset {
  const config: PerceptualConfig = {
    ...DEFAULT_PERCEPTUAL_CONFIG,
    ...options.perceptual,
  };
  const hullStep = options.hullStep ?? 2;
  const scale = options.correctionScale ?? 0.5;
  const { width, height } = pixelData;

  const mass = computeWeightedCentroid(pixelData);

  const boundaryPoints = extractBoundaryPoints(
    pixelData.weights,
    width,
    height,
    0.01,
    hullStep
  );
  const hull = convexHull(boundaryPoints);
  const hullCenter = hullCentroid(hull);

  let optical = blendCentroids(
    { x: mass.cx, y: mass.cy },
    hullCenter,
    config.hullWeight
  );

  const asymmetry = analyzeAsymmetry(pixelData.weights, width, height);

  if (config.shapeCorrection) {
    optical = applyShapeCorrection(
      optical.x,
      optical.y,
      width,
      height,
      asymmetry
    );
  }

  optical.y = applyVerticalBias(optical.y, height, config.verticalBias);

  const geometricCenter = { x: width / 2, y: height / 2 };
  const dx = (geometricCenter.x - optical.x) * scale;
  const dy = (geometricCenter.y - optical.y) * scale;

  return {
    dx,
    dy,
    dxPercent: width > 0 ? (dx / width) * 100 : 0,
    dyPercent: height > 0 ? (dy / height) * 100 : 0,
    debug: {
      geometricCenter,
      massCentroid: { x: mass.cx, y: mass.cy },
      hullCentroid: hullCenter,
      opticalCenter: optical,
      asymmetry,
      totalWeight: mass.totalWeight,
      pipelineVersion: 'v1',
    },
  };
}

// ---------------------------------------------------------------------------
// V2 Pipeline (biologically inspired)
// ---------------------------------------------------------------------------

/**
 * Compute the optical center offset using the biologically-inspired v2 pipeline.
 *
 * Pipeline:
 * 1. Build weight map from RGBA pixels
 * 2. DoG filter (retinal lateral inhibition) — enhances edges, suppresses uniform
 * 3. Power compression (V1 nonlinearity) — de-emphasizes dense interior
 * 4. Compute three centroids from the preprocessed map:
 *    - Edge centroid (Sobel) — where visual boundaries concentrate (40%)
 *    - Hull centroid (convex hull) — bounding shape center (30%)
 *    - Symmetry-axis center — intersection of symmetry axes (30%)
 * 5. Blend the three centroids
 * 6. Apply symmetry-based correction for asymmetric shapes
 * 7. Apply vertical perceptual bias
 * 8. Compute offset from geometric center
 *
 * Biological justification:
 * - Proffitt et al. (1983): perceived center dominated by contour, not interior
 * - Marr & Hildreth (1980): DoG approximates retinal edge detection
 * - Naka & Rushton (1966): compressive nonlinearity in ganglion cells
 * - LOC symmetry detection at ~220ms (Sasaki et al. 2005)
 *
 * @param imageData - Raw RGBA pixel data
 * @param options   - Pipeline configuration
 * @returns OpticalOffset with dx/dy in pixels and percentages
 */
export function computeOffsetV2(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  options: ComputeOptionsV2 = {}
): OpticalOffset {
  const { width, height } = imageData;
  const hullStep = options.hullStep ?? 2;
  const edgeW = options.edgeWeight ?? 0.40;
  const hullW = options.hullWeight ?? 0.30;
  const symW = options.symmetryWeight ?? 0.30;

  const preprocessConfig: PreprocessingConfig = {
    ...DEFAULT_PREPROCESSING_CONFIG,
    ...options.preprocessing,
  };

  const perceptualConfig: PerceptualConfig = {
    ...DEFAULT_PERCEPTUAL_CONFIG,
    ...options.perceptual,
  };

  // Step 1: Build raw weight map
  const pixelData = buildWeightMap(imageData);

  // Short-circuit for empty images
  const rawMass = computeWeightedCentroid(pixelData);
  if (rawMass.totalWeight === 0) {
    const geometricCenter = { x: width / 2, y: height / 2 };
    return {
      dx: 0,
      dy: 0,
      dxPercent: 0,
      dyPercent: 0,
      debug: {
        geometricCenter,
        massCentroid: geometricCenter,
        hullCentroid: geometricCenter,
        opticalCenter: geometricCenter,
        asymmetry: { asymX: 0, asymY: 0 },
        totalWeight: 0,
        pipelineVersion: 'v2',
      },
    };
  }

  // Step 2-3: Preprocess (DoG + power compression)
  // DoG simulates retinal lateral inhibition: enhances edges, suppresses uniform
  // Power compression simulates V1 compressive nonlinearity
  const processedWeights = preprocessWeightMap(
    pixelData.weights,
    width,
    height,
    preprocessConfig
  );

  // Step 4a: Edge centroid — directly from preprocessed (DoG+compressed) weights
  //
  // IMPORTANT: We do NOT run Sobel on the DoG output. The DoG IS the edge
  // detector (Marr & Hildreth, 1980). Running Sobel on DoG would compute
  // the gradient of the edge response (second derivative) — finding edges
  // of edges, which is not what Proffitt et al.'s "contour centroid" means.
  //
  // Instead, the weighted centroid of the DoG output directly gives us the
  // center of edge strength — where visual boundaries concentrate spatially.
  const edgeMass = computeWeightedCentroid({
    weights: processedWeights,
    width,
    height,
  });
  const edgeCentroid = { x: edgeMass.cx, y: edgeMass.cy };

  // Step 4b: Hull centroid — from RAW weight map (not preprocessed)
  //
  // The convex hull captures the shape's structural envelope — the bounding
  // shape that quick glances perceive. This should operate on the original
  // shape boundary, not the DoG edge response (which loses interior structure).
  const boundaryPoints = extractBoundaryPoints(
    pixelData.weights,
    width,
    height,
    0.01,
    hullStep
  );
  const hull = convexHull(boundaryPoints);
  const hullCenter = hullCentroid(hull);

  // Step 4c: Symmetry-axis center — from RAW weight map
  //
  // Symmetry detection measures the shape's structural balance. Using the
  // raw weight map ensures we capture the full shape (fill + contour),
  // not just the edge-enhanced response.
  const symmetry = analyzeSymmetry(pixelData.weights, width, height);
  const massCentroid = computeWeightedCentroid(pixelData);

  // The symmetry axis center: project the mass centroid onto the dominant
  // symmetry axis passing through the geometric center
  const geoCx = width / 2;
  const geoCy = height / 2;
  const axisAngle = symmetry.dominantAxis;
  const cosA = Math.cos(axisAngle);
  const sinA = Math.sin(axisAngle);

  // Project mass centroid onto the symmetry axis through geometric center
  const dmx = massCentroid.cx - geoCx;
  const dmy = massCentroid.cy - geoCy;
  const proj = dmx * cosA + dmy * sinA;

  // Blend factor: higher symmetry = pull more toward axis
  const symStrength = Math.max(symmetry.bilateralX, symmetry.bilateralY);
  const symmetryAxisCenter = {
    x: geoCx + proj * cosA * symStrength,
    y: geoCy + proj * sinA * symStrength,
  };

  // Step 5: Blend the three centroids
  let optical = {
    x: edgeCentroid.x * edgeW + hullCenter.x * hullW + symmetryAxisCenter.x * symW,
    y: edgeCentroid.y * edgeW + hullCenter.y * hullW + symmetryAxisCenter.y * symW,
  };

  // Step 6: Symmetry-based correction for asymmetric shapes
  // Asymmetry is measured on the raw weight map (shape structure, not edges)
  const asymmetry = analyzeAsymmetry(pixelData.weights, width, height);
  const symCorr = computeSymmetryCorrection(symmetry, width, height);
  optical.x += symCorr.dx * Math.sign(asymmetry.asymX);
  optical.y += symCorr.dy * Math.sign(asymmetry.asymY);

  // Step 7: Vertical perceptual bias
  optical.y = applyVerticalBias(optical.y, height, perceptualConfig.verticalBias);

  // Step 8: Compute offset from geometric center
  const geometricCenter = { x: width / 2, y: height / 2 };
  const dx = geometricCenter.x - optical.x;
  const dy = geometricCenter.y - optical.y;

  return {
    dx,
    dy,
    dxPercent: width > 0 ? (dx / width) * 100 : 0,
    dyPercent: height > 0 ? (dy / height) * 100 : 0,
    debug: {
      geometricCenter,
      massCentroid: { x: massCentroid.cx, y: massCentroid.cy },
      hullCentroid: hullCenter,
      opticalCenter: optical,
      asymmetry,
      totalWeight: rawMass.totalWeight,
      edgeCentroid,
      symmetryAxisCenter,
      pipelineVersion: 'v2',
    },
  };
}
