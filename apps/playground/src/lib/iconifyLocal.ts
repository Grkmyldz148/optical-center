/**
 * Iconify set loader — now powered entirely by the official
 * `optical-center/vite` plugin. No custom middleware, no HTTP endpoints,
 * no offsets sidecar.
 *
 * Each family is a real module import:
 *
 *   import('@iconify/json/json/<prefix>.json')
 *
 * Loaded lazily from a curated family map (below). The optical-center
 * plugin recognises the Iconify collection shape and body-wraps every icon
 * at build/dev time, so the JSON that reaches the browser already carries
 * the optical shift — as an inner `<g transform="translate(…)">` around
 * each body. The page never runs the model.
 *
 * Why a curated list and not every set in `@iconify/json`? Correction is a
 * build-time rasterize per icon. Globbing all 232 sets would pull ~100k
 * icons into a single production build (the dev server stays lazy either
 * way). A focused, varied selection keeps the demo build practical while
 * still showing the plugin correcting many real families with zero config.
 *
 * The A/B toggle needs the *source* body too. Rather than fetch it
 * separately, we recover it from the corrected body by stripping the one
 * wrapper the plugin added — pure string surgery, zero model:
 *
 *   corrected:  <g transform="translate(0.32 0.62)"><path …/></g>
 *   source:     <path …/>
 */

import type { IconifyJSON } from '@iconify/types';

/**
 * Curated set of families the stress view can expand. Each is a literal
 * dynamic import so Vite resolves the hoisted `@iconify/json` package and
 * code-splits it into a lazy chunk; the optical-center plugin corrects each
 * set the first time it's imported. Add a line to include another family.
 */
const loaderByPrefix = new Map<string, () => Promise<unknown>>([
  ['lucide', () => import('@iconify/json/json/lucide.json')],
  ['mdi', () => import('@iconify/json/json/mdi.json')],
  ['bi', () => import('@iconify/json/json/bi.json')],
  ['heroicons', () => import('@iconify/json/json/heroicons.json')],
  ['carbon', () => import('@iconify/json/json/carbon.json')],
  ['feather', () => import('@iconify/json/json/feather.json')],
  ['octicon', () => import('@iconify/json/json/octicon.json')],
  ['ion', () => import('@iconify/json/json/ion.json')],
  ['iconoir', () => import('@iconify/json/json/iconoir.json')],
  ['akar-icons', () => import('@iconify/json/json/akar-icons.json')],
  ['bx', () => import('@iconify/json/json/bx.json')],
  ['ant-design', () => import('@iconify/json/json/ant-design.json')],
  ['mingcute', () => import('@iconify/json/json/mingcute.json')],
  ['ri', () => import('@iconify/json/json/ri.json')],
]);

/** Prefixes the stress view can expand (the curated demo families). */
export function availablePrefixes(): ReadonlySet<string> {
  return new Set(loaderByPrefix.keys());
}

export interface ResolvedIcon {
  readonly prefix: string;
  readonly name: string;
  /** Optically-corrected body (body-wrapped by the plugin). */
  readonly body: string;
  /** Source body, with the optical wrapper stripped back off. */
  readonly sourceBody: string;
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
}

export interface LocalIconSet {
  readonly prefix: string;
  readonly width: number;
  readonly height: number;
  /** Sorted icon-name list — matches what the cell grid renders. */
  readonly names: readonly string[];
  readonly icons: ReadonlyMap<string, ResolvedIcon>;
}

const DEFAULT_DIMENSION = 16;

/** Strip the single optical wrapper the plugin adds, if present. */
const OPTICAL_WRAP = /^<g transform="translate\([^)]*\)">([\s\S]*)<\/g>$/;
function stripOpticalWrap(body: string): string {
  const match = body.match(OPTICAL_WRAP);
  return match?.[1] ?? body;
}

const resolved = new Map<string, LocalIconSet | null>();
const inFlight = new Map<string, Promise<LocalIconSet | null>>();

/**
 * Load and cache one collection. Resolves to `null` when the prefix isn't
 * part of the installed `@iconify/json`. Memoised forever; one import per
 * prefix per page load.
 */
export function loadIconSet(prefix: string): Promise<LocalIconSet | null> {
  if (resolved.has(prefix)) {
    return Promise.resolve(resolved.get(prefix) ?? null);
  }
  const cached = inFlight.get(prefix);
  if (cached) return cached;

  const loader = loaderByPrefix.get(prefix);
  if (!loader) {
    resolved.set(prefix, null);
    return Promise.resolve(null);
  }

  const p = loader()
    .then((mod) => {
      const set = ((mod as { default?: IconifyJSON }).default ??
        mod) as IconifyJSON;
      return buildSet(prefix, set);
    })
    .catch(() => null)
    .finally(() => inFlight.delete(prefix));

  inFlight.set(prefix, p);
  return p.then((value) => {
    resolved.set(prefix, value);
    return value;
  });
}

function buildSet(prefix: string, set: IconifyJSON): LocalIconSet {
  const defaultW = set.width ?? DEFAULT_DIMENSION;
  const defaultH = set.height ?? defaultW;
  const names: string[] = [];
  const map = new Map<string, ResolvedIcon>();

  for (const [name, icon] of Object.entries(set.icons ?? {})) {
    if (typeof icon.body !== 'string') continue;
    const body = icon.body; // corrected (body-wrapped by the plugin)
    names.push(name);
    map.set(name, {
      prefix,
      name,
      body,
      sourceBody: stripOpticalWrap(body),
      width: icon.width ?? defaultW,
      height: icon.height ?? defaultH,
      left: icon.left ?? 0,
      top: icon.top ?? 0,
    });
  }

  names.sort((a, b) => a.localeCompare(b));
  return { prefix, width: defaultW, height: defaultH, names, icons: map };
}

/** Snapshot for the HUD. */
export function localIconSetStats(): {
  readonly loadedPrefixes: number;
  readonly loadedIcons: number;
} {
  let loadedPrefixes = 0;
  let loadedIcons = 0;
  for (const value of resolved.values()) {
    if (value !== null) {
      loadedPrefixes++;
      loadedIcons += value.icons.size;
    }
  }
  return { loadedPrefixes, loadedIcons };
}
