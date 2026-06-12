/**
 * The single recipe that turns icon geometry into a measurement SVG.
 *
 * Every surface that needs an optical offset for an icon body — the Vite
 * interceptor today, the CLI and other adapters later — assembles its
 * measurement SVG through this one function. That matters for two reasons:
 *
 *   1. Correctness: the synthesized box must match what the *renderer*
 *      shows. Iconify's default icon dimension is 16 (not the width), and
 *      `left`/`top` default to 0; pinning those here keeps "what we
 *      measured" equal to "what the browser paints".
 *   2. Cache sharing: byte-identical output for the same `{ body, box }`
 *      means identical cache keys, so a body that appears in two
 *      collections — or in both a `.json` set and a `.svg` file — is
 *      rasterized exactly once across the whole toolchain.
 */

/** Iconify's default icon dimension when width/height are unspecified. */
export const DEFAULT_ICON_DIMENSION = 16;

/** A fully-resolved icon geometry, ready to assemble into an SVG. */
export interface IconGeom {
  readonly body: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Collection-level fallbacks for icons that omit their own geometry. */
export interface GeomDefaults {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The default geometry an icon inherits when nothing else is specified. */
export const ROOT_GEOM_DEFAULTS: GeomDefaults = {
  left: 0,
  top: 0,
  width: DEFAULT_ICON_DIMENSION,
  height: DEFAULT_ICON_DIMENSION,
};

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Read the collection-level geometry defaults off an Iconify set root.
 * Any field absent or non-numeric falls back to the renderer default.
 */
export function readGeomDefaults(set: Record<string, unknown>): GeomDefaults {
  return {
    left: finiteNumber(set['left'], ROOT_GEOM_DEFAULTS.left),
    top: finiteNumber(set['top'], ROOT_GEOM_DEFAULTS.top),
    width: finiteNumber(set['width'], ROOT_GEOM_DEFAULTS.width),
    height: finiteNumber(set['height'], ROOT_GEOM_DEFAULTS.height),
  };
}

/**
 * Resolve one icon record into a full geometry against the given defaults.
 * Returns `null` when the record carries no usable body string.
 */
export function resolveGeom(
  icon: Record<string, unknown>,
  defaults: GeomDefaults = ROOT_GEOM_DEFAULTS,
): IconGeom | null {
  const body = icon['body'];
  if (typeof body !== 'string') return null;
  return {
    body,
    left: finiteNumber(icon['left'], defaults.left),
    top: finiteNumber(icon['top'], defaults.top),
    width: finiteNumber(icon['width'], defaults.width),
    height: finiteNumber(icon['height'], defaults.height),
  };
}

/**
 * Assemble the measurement SVG for an icon geometry. Deterministic and
 * minimal — the body is treated as an opaque string and never re-parsed.
 */
export function assembleIconSvg(geom: IconGeom): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${geom.left} ${geom.top} ${geom.width} ${geom.height}">` +
    `${geom.body}</svg>`
  );
}
