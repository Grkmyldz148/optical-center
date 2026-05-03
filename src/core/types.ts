/**
 * Shared types used across the optical-center pipeline.
 *
 * Exposed via the public entry to give callers (Babel plugin, Vite plugin,
 * CLI) a single canonical shape for raster buffers and viewBox metadata.
 */

/** RGBA raster buffer — the canonical shape consumed by getOpticalCenter. */
export interface RasterImage {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** A parsed `viewBox` ("x y w h" → numeric tuple). */
export interface ViewBoxNumeric {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Axis-aligned bounding box in either raster or viewBox coordinates. */
export interface Bbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * HTML attributes added to the `<svg>` element after a successful transform.
 * Empty-string `data-optical-center` renders as a boolean attribute.
 */
export interface ViewBoxBreadcrumb {
  readonly 'data-optical-center': '';
  readonly 'data-optical-original-viewbox'?: string;
  readonly 'data-optical-offset'?: string;
}
