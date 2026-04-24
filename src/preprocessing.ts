/**
 * Preprocessing Pipeline
 *
 * Biologically-inspired preprocessing stages that transform the raw weight
 * map before centroid computation:
 *
 * 1. Gaussian blur — reusable convolution used by both DoG and saliency pyramid
 * 2. Difference of Gaussians (DoG) — simulates retinal lateral inhibition
 *    (ON-center / OFF-surround receptive fields). Enhances edges and
 *    suppresses uniform regions.
 * 3. Power-law (compressive) nonlinearity — models the compressive response
 *    of V1 neurons: w' = w^p where p < 1. Dense, high-weight regions get
 *    compressed while low-weight edges gain relative emphasis.
 *
 * References:
 * - Marr & Hildreth (1980) "Theory of Edge Detection" — DoG approximates LoG
 * - Naka & Rushton (1966) — compressive nonlinearity in retinal ganglion cells
 * - Heeger (1992) — normalization model of V1 responses
 */

// ---------------------------------------------------------------------------
// Gaussian Blur (separable, arbitrary sigma)
// ---------------------------------------------------------------------------

/**
 * Generate a 1D Gaussian kernel.
 *
 * @param sigma  - Standard deviation of the Gaussian.
 * @param radius - Half-width of the kernel. If omitted, uses ceil(3*sigma).
 * @returns A normalized kernel of length (2*radius + 1).
 */
export function makeGaussianKernel(
  sigma: number,
  radius?: number
): Float32Array {
  const r = radius ?? Math.ceil(sigma * 3);
  const size = 2 * r + 1;
  const kernel = new Float32Array(size);
  const twoSigmaSq = 2 * sigma * sigma;
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - r;
    kernel[i] = Math.exp(-(x * x) / twoSigmaSq);
    sum += kernel[i];
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Apply a separable Gaussian blur to a 2D weight map.
 *
 * Uses horizontal then vertical pass with boundary clamping.
 *
 * @param data   - Row-major Float32Array (length = width * height).
 * @param width  - Width of the data.
 * @param height - Height of the data.
 * @param sigma  - Standard deviation of the Gaussian.
 * @returns A new blurred Float32Array of the same dimensions.
 */
export function gaussianBlur(
  data: Float32Array,
  width: number,
  height: number,
  sigma: number
): Float32Array {
  if (sigma <= 0) return new Float32Array(data);

  const kernel = makeGaussianKernel(sigma);
  const r = (kernel.length - 1) / 2;

  // Horizontal pass
  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const sx = Math.max(0, Math.min(width - 1, x + k));
        sum += data[y * width + sx] * kernel[k + r];
      }
      temp[y * width + x] = sum;
    }
  }

  // Vertical pass
  const result = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k));
        sum += temp[sy * width + x] * kernel[k + r];
      }
      result[y * width + x] = sum;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Difference of Gaussians (DoG)
// ---------------------------------------------------------------------------

/**
 * Apply a Difference of Gaussians (DoG) filter to a weight map.
 *
 * DoG = Gaussian(sigma1) - Gaussian(sigma2)  where sigma1 < sigma2
 *
 * This approximates the Laplacian of Gaussian (LoG) and models retinal
 * lateral inhibition: ON-center/OFF-surround receptive fields.
 *
 * The result enhances edges and fine detail while suppressing uniform regions.
 * Negative values are clamped to 0 (half-wave rectification, modeling the
 * non-negative firing rate of neurons).
 *
 * Typical ratio: sigma2/sigma1 = 1.6 (Marr & Hildreth, 1980)
 *
 * @param weights - Row-major weight map (length = width * height).
 * @param width   - Width of the weight map.
 * @param height  - Height of the weight map.
 * @param sigma1  - Inner (narrow) Gaussian sigma. Default: 1.0
 * @param sigma2  - Outer (wide) Gaussian sigma. Default: 1.6
 * @returns A new Float32Array with DoG-filtered values, clamped >= 0.
 */
export function applyDoG(
  weights: Float32Array,
  width: number,
  height: number,
  sigma1: number = 1.0,
  sigma2: number = 1.6
): Float32Array {
  const narrow = gaussianBlur(weights, width, height, sigma1);
  const wide = gaussianBlur(weights, width, height, sigma2);

  const result = new Float32Array(width * height);
  for (let i = 0; i < result.length; i++) {
    // DoG = narrow - wide (ON-center minus OFF-surround)
    // Half-wave rectification: clamp negatives to 0
    result[i] = Math.max(0, narrow[i] - wide[i]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Power-Law Compression
// ---------------------------------------------------------------------------

/**
 * Apply a compressive power-law nonlinearity to a weight map.
 *
 * Models the compressive response of V1 cortical neurons:
 *   w' = w^p   where 0 < p < 1
 *
 * With p < 1:
 * - High-weight (dense) regions get compressed
 * - Low-weight (edge) regions gain relative emphasis
 * - This shifts the centroid toward boundaries and away from filled mass
 *
 * This is the key correction that Proffitt et al. (1983) predicted:
 * perceived center is dominated by contour, not interior luminance.
 *
 * @param weights  - Row-major weight map (length = width * height).
 * @param exponent - Power law exponent. Default: 0.7 (moderate compression).
 *                   Range: 0.5 (strong compression) to 1.0 (linear/no compression).
 * @returns A new Float32Array with compressed weights.
 */
export function applyPowerCompression(
  weights: Float32Array,
  exponent: number = 0.7
): Float32Array {
  const result = new Float32Array(weights.length);
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > 0) {
      result[i] = Math.pow(weights[i], exponent);
    }
    // weights <= 0 stay 0
  }
  return result;
}

// ---------------------------------------------------------------------------
// Combined Preprocessing Pipeline
// ---------------------------------------------------------------------------

export interface PreprocessingConfig {
  /** Whether to apply DoG filter. Default: true */
  doG: boolean;
  /** Inner Gaussian sigma for DoG. Default: 1.0 */
  doGSigma1: number;
  /** Outer Gaussian sigma for DoG. Default: 1.6 */
  doGSigma2: number;
  /** Whether to apply power compression. Default: true */
  compression: boolean;
  /** Power law exponent (0 < p < 1 = compression). Default: 0.7 */
  compressionExponent: number;
}

export const DEFAULT_PREPROCESSING_CONFIG: PreprocessingConfig = {
  doG: true,
  doGSigma1: 1.0,
  doGSigma2: 1.6,
  compression: true,
  compressionExponent: 0.7,
};

/**
 * Apply the full biologically-inspired preprocessing pipeline to a weight map.
 *
 * Pipeline order:
 * 1. DoG filter (retinal lateral inhibition) — enhances edges
 * 2. Power compression (V1 compressive nonlinearity) — de-emphasizes dense regions
 *
 * The input weight map is NOT modified; a new array is returned.
 *
 * @param weights - Row-major weight map from buildWeightMap().
 * @param width   - Width of the weight map.
 * @param height  - Height of the weight map.
 * @param config  - Preprocessing configuration.
 * @returns A new preprocessed weight map.
 */
export function preprocessWeightMap(
  weights: Float32Array,
  width: number,
  height: number,
  config: PreprocessingConfig = DEFAULT_PREPROCESSING_CONFIG
): Float32Array {
  let result = weights;

  // Step 1: DoG filter (retinal lateral inhibition)
  if (config.doG) {
    result = applyDoG(result, width, height, config.doGSigma1, config.doGSigma2);
  }

  // Step 2: Power-law compression (V1 compressive nonlinearity)
  if (config.compression) {
    result = applyPowerCompression(result, config.compressionExponent);
  }

  return result;
}
