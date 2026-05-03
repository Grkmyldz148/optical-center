/**
 * Loads a golden SVG fixture from tests/fixtures/icons/. Lets tests refer
 * to icons by name instead of pasting SVG strings inline.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '..', 'fixtures', 'icons');

export function loadIcon(name: string): string {
  const file = name.endsWith('.svg') ? name : `${name}.svg`;
  return readFileSync(join(FIXTURES, file), 'utf8');
}

export function iconPath(name: string): string {
  const file = name.endsWith('.svg') ? name : `${name}.svg`;
  return join(FIXTURES, file);
}
