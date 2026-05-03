# Migrating `optical-center` from 0.1 → 0.2

`0.2` is the first release where `optical-center` ships as a complete
build-time toolchain instead of a single function. The model itself is
unchanged — same offsets, same calibration — but everything around it
has moved. This guide walks the changes you'll see.

## TL;DR

- The default import (`optical-center`) is browser-safe and contains
  the algorithm + viewBox helpers. **No more raster I/O at runtime.**
- A new `optical-center/node` entry exposes the rasterizer and the
  full SVG-string → viewBox pipeline.
- New subpaths: `optical-center/cli`, `optical-center/babel`,
  `optical-center/vite`.
- The recommended way to use the library is now declarative —
  `<svg opticalCenter>` in JSX, `<svg optical-center>` in HTML, or
  `optical-center transform <folder>` in CI.

## Old API (0.1)

```ts
import { getOpticalCenter } from 'optical-center';

const offset = getOpticalCenter({
  data: pixels,        // Uint8ClampedArray RGBA
  width: 120,
  height: 120,
});
// → { dx, dy, dxPercent, dyPercent }
```

You had to rasterize the SVG yourself. The library returned a number
and washed its hands.

## What stayed identical

`getOpticalCenter()` still exists, has the same signature, returns the
same shape, and returns the same numbers for the same inputs. If you
were calling it directly to drive a custom CSS transform, **nothing
needs to change**.

```ts
import { getOpticalCenter } from 'optical-center'; // unchanged
```

## What's new

### 1. JSX integration

```tsx
import opticalCenter from 'optical-center/babel';

// in babel.config / vite.config:
plugins: [['optical-center/babel', { emitMetadata: true }]];
```

```tsx
<svg opticalCenter viewBox="0 0 24 24">
  <path d="M8 5v14l11-7z" />
</svg>
```

The Babel plugin rasterizes static `<svg opticalCenter>` subtrees at
build time, rewrites the `viewBox`, strips the marker, and adds a
`data-optical-center=""` breadcrumb. Zero runtime cost.

For TypeScript users, opt into the JSX prop type via:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "types": ["optical-center/babel/jsx-runtime-augment"]
  }
}
```

### 2. Vite plugin

```ts
// vite.config.ts
import opticalCenter from 'optical-center/vite';

export default { plugins: [opticalCenter()] };
```

Three things happen:

- `.tsx` / `.jsx` files are run through the Babel plugin (with
  `enforce: 'pre'` so we win the race against esbuild's JSX transform).
- SVG asset imports with the `?optical` suffix are rewritten at load
  time: `import icon from './play.svg?optical'`.
- `<svg optical-center>` blocks in `index.html` are rewritten via
  `transformIndexHtml` (running at `order: 'post'` so framework-injected
  SVGs are caught).

### 3. CLI

```bash
# transform a folder, mirror to a sibling
npx optical-center transform ./icons ./icons-centered

# inspect a single file
npx optical-center info ./icons/play.svg

# aggregate stats
npx optical-center analyze ./icons

# clear the on-disk cache
npx optical-center clear-cache --all
```

All commands accept `--json` and emit a structured envelope with
`schemaVersion`. Exit codes are stable: `0` clean, `1` warnings, `2`
failures, `3` invalid args.

### 4. Cache

A content-addressable cache (`node_modules/.cache/optical-center` by
default) is shared by the CLI, Vite plugin, and Babel sync cache. Cache
keys mix the SVG bytes with both the published `ALGORITHM_VERSION` and
a SHA fingerprint of every model source file — any algorithm tweak
self-invalidates without a manual bump.

## Removed

Nothing from the public 0.1 API has been removed. `getOpticalCenter`,
its return shape, and the `OpticalCenterResult` type are all still
exported.

## Behavioral changes worth knowing

- **Default raster size** (`RASTER_SIZE`) is now 120 (the model's
  validation point) instead of whatever you happened to feed it. If you
  rasterized at a different size, results may shift very slightly —
  `getOpticalCenter` is identical, but if you used the new
  `transformViewBox` helper, set `rasterize.size` to match.
- **`MAX_INPUT_BYTES`** is now enforced (default 5 MB). Larger SVGs
  bail out with `OPTICAL_RASTERIZE_FAILED`. Override via plugin options
  or `MAX_INPUT_BYTES` constant.
- **Output SVGs are sanitized by default** (drop `<script>`,
  `on*` handlers, `javascript:` URIs, `<foreignObject>`). Opt out with
  `sanitize: false` only when sources are fully trusted.
- **CLI honors path safety**: input/output paths must resolve under
  cwd. Pass `--allow-outside-cwd` to skip the check.

## Where to read more

- [`docs/plans/2026-05-03-feat-optical-center-drop-in-plan.md`](./plans/2026-05-03-feat-optical-center-drop-in-plan.md)
  — full implementation plan with ADRs.
- [`examples/`](../examples/) — four runnable demos covering React,
  Vite asset import, vanilla HTML, and CLI-only icon-set workflows.
