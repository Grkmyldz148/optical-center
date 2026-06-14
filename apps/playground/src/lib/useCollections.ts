/**
 * Iconify collection catalogue.
 *
 * Imported directly from the locally-installed `@iconify/json` package —
 * `collections.json` is plain catalogue metadata (no icon bodies), so the
 * optical-center plugin leaves it untouched and Vite bundles it as data.
 * No fetch, no endpoint, no custom plugin. The list is ready synchronously;
 * the hook keeps the old `{ list, ready, error }` shape so the views are
 * unchanged.
 */

import { useState } from 'react';

// Catalogue metadata for every collection — resolved from the hoisted
// `@iconify/json` install. Not icon-shaped, so it ships as-is.
import collectionsRaw from '../../../../node_modules/@iconify/json/collections.json';

import { availablePrefixes } from './iconifyLocal.js';

interface RawCollection {
  readonly name?: string;
  readonly total?: number;
  readonly category?: string;
  readonly author?: { readonly name?: string };
  readonly license?: { readonly title?: string; readonly spdx?: string };
}

export interface CollectionEntry {
  readonly prefix: string;
  readonly name: string;
  readonly total: number;
  readonly category: string | null;
  readonly license: string | null;
  readonly spdx: string | null;
  readonly author: string | null;
}

export interface CollectionsState {
  readonly list: readonly CollectionEntry[];
  readonly ready: boolean;
  readonly error: string | null;
}

const CURATED = availablePrefixes();

const LIST: readonly CollectionEntry[] = Object.entries(
  collectionsRaw as Record<string, RawCollection>,
)
  // Only the curated families the stress view can actually expand. The
  // catalogue itself has all 232; correction is build-time per icon, so the
  // demo focuses on a varied subset (see iconifyLocal).
  .filter(([prefix]) => CURATED.has(prefix))
  .map(([prefix, info]) => ({
    prefix,
    name: info.name ?? prefix,
    total: info.total ?? 0,
    category: info.category ?? null,
    license: info.license?.title ?? null,
    spdx: info.license?.spdx ?? null,
    author: info.author?.name ?? null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const READY: CollectionsState = { list: LIST, ready: true, error: null };

export function useCollections(): CollectionsState {
  // The catalogue is bundled, so there's nothing to load — but keep the
  // hook signature stable for the views.
  const [state] = useState<CollectionsState>(READY);
  return state;
}
