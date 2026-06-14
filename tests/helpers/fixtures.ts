/**
 * Loader for the shared icon pool at root-level `fixtures/`. The same
 * pool drives every example project under `examples/` so a case
 * exercised in a test is visible at runtime, and vice versa.
 *
 * Icons are addressed as `family/name` (e.g. `lucide/play`,
 * `edge-cases/asymmetric-triangle`). The trailing `.svg` is optional.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = resolve(HERE, '..', '..', 'fixtures');
const ICONS_ROOT = join(FIXTURES_ROOT, 'icons');

export interface FixtureEntry {
  readonly id: string;
  readonly family: string;
  readonly name: string;
  readonly viewBox: string;
  readonly stroke: boolean;
  /** Reference magnitude (% of max(w,h)) measured against the live model. */
  readonly magnitudeRef: number;
  /** Whether the shifted window is expected to crop opaque pixels. */
  readonly clipExpected: boolean;
  readonly notes: string;
}

interface Manifest {
  readonly version: number;
  readonly tolerancePercent: number;
  readonly icons: ReadonlyArray<FixtureEntry>;
}

export function getTolerancePercent(): number {
  return loadManifest().tolerancePercent;
}

let cachedManifest: Manifest | undefined;

function loadManifest(): Manifest {
  if (cachedManifest) return cachedManifest;
  const raw = readFileSync(join(FIXTURES_ROOT, 'manifest.json'), 'utf8');
  cachedManifest = JSON.parse(raw) as Manifest;
  return cachedManifest;
}

export function loadIcon(id: string): string {
  const file = id.endsWith('.svg') ? id : `${id}.svg`;
  return readFileSync(join(ICONS_ROOT, file), 'utf8');
}

export function iconPath(id: string): string {
  const file = id.endsWith('.svg') ? id : `${id}.svg`;
  // Forward slashes so the path embeds cleanly into CSS `url(...)` strings
  // (real CSS never uses backslashes) and regex assertions stay
  // platform-agnostic. Node's fs accepts `/` on Windows, so the plugin
  // still resolves and reads the file.
  return join(ICONS_ROOT, file).replaceAll('\\', '/');
}

export interface ListFilter {
  readonly family?: string;
}

export function listIcons(filter: ListFilter = {}): ReadonlyArray<FixtureEntry> {
  return loadManifest().icons.filter((icon) => {
    if (filter.family && icon.family !== filter.family) return false;
    return true;
  });
}

export function getIcon(id: string): FixtureEntry | undefined {
  return loadManifest().icons.find((i) => i.id === id);
}
