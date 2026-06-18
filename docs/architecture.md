# Architecture

How `optical-center` computes a correction and how the code is laid out
internally. For the user-facing API see [reference.md](./reference.md); to
hack on the code see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Contents

- [The model](#the-model)
- [The build pipeline](#the-build-pipeline)
- [Module layering](#module-layering)
- [Caching](#caching)

---

## The model

The shipped model is **`V2 × 0.745`**.

### V2: the raw pipeline

A biologically-inspired estimate of where an icon's visual mass sits, computed
purely over the icon's RGBA raster (no vector parsing). In order:

1. **Difference-of-Gaussians** edge response: approximates early-vision
   contrast sensitivity.
2. **Luminance compression**: down-weights large flat areas so a shape's
   silhouette dominates.
3. **Blended centroids**: combines the area centroid and the edge centroid.
4. **Symmetry-axis correction**: detects the dominant symmetry axis and pulls
   the estimate toward it (so a symmetric glyph isn't nudged off-axis by noise).
5. **Vertical bias**: a small constant downward bias that matches measured
   human preference.

Lives in [`src/model/`](../src/model). The output is an offset in **raster
pixels**; scale to display px by multiplying by `displaySize / rasterSize`.

### × 0.745: the perceptual scale

`CORRECTION_SCALE = 0.745` is a single global factor applied to the V2 output.
It comes from a two-alternative forced-choice (2AFC) study: shown the
geometric placement vs. various fractions of the V2 correction, participants
preferred ~74.5 % of the raw correction.

| Phase | Method | N | Result |
|---|---|---|---|
| 1 | method of adjustment | 36 | RMSE = 2.99 px, r = 0.585 |
| 2 | 2AFC (bias-free forced choice) | 30 | pooled PSE = 0.745 |

The version string `ALGORITHM_VERSION` (`1.0.0-v2`) identifies this model and
is mixed into the cache key (see [Caching](#caching)).

---

## The build pipeline

Every adapter (Babel, Vite, PostCSS, Astro, CLI) funnels through the same three
steps; only the input/output wrapping differs.

```
SVG string ──rasterizeSvg()──▶ RGBA raster ──getOpticalCenter()──▶ { dx, dy }
                                                                       │
   rewritten <svg> / data-URI mask ◀──applyTransformToSvg()──◀ transformViewBox()
```

1. **Rasterize** (`optical-center/node`, backed by `@resvg/resvg-js`): turn
   the SVG into a pixel buffer. Pluggable, so a WASM rasterizer can be swapped
   in.
2. **Measure** (`optical-center` core): `getOpticalCenter()` runs the model on
   the buffer.
3. **Apply** (`optical-center` core): `transformViewBox()` converts the offset
   into a new `viewBox`, and `applyTransformToSvg()` writes it back into the SVG
   string (or the adapter inlines a corrected `data:` mask for CSS).

The browser never runs any of this; the corrected `viewBox` is baked into the
shipped asset.

---

## Module layering

The package is strictly layered so a browser bundler never pulls in native
code. Dependencies point **rightward** only:

```
model  →  core  →  { node, cache, detect, corrector, babel, vite, astro, postcss, tailwind, cli }
```

| Layer | Folder | Responsibility | Browser-safe? |
|---|---|---|---|
| model | `src/model` | RGBA buffer → optical offset (the algorithm). | ✅ |
| core | `src/core` | viewBox math, SVG string surgery, types, constants, warning registry, version. | ✅ |
| node | `src/node` | resvg rasterize, SVG sanitize, per-file timeout. | ❌ native |
| cache | `src/cache` | content-addressable transform cache + algorithm fingerprint. | ❌ |
| detect | `src/detect` | structural icon-data detection (is this value an icon?). | ✅ |
| corrector | `src/corrector` | bulk icon-data correction (Iconify sets) via a worker pool. | ❌ |
| babel | `src/babel` | Babel plugin: `<svg opticalCenter>` JSX. | build |
| vite | `src/vite` | Vite plugin: Babel pass + `index.html` + imported icons. | build |
| astro | `src/astro` | Astro integration + post-build HTML sweep + dev middleware. | build |
| postcss | `src/postcss` | PostCSS plugin: `optical-center: auto`. | build |
| tailwind | `src/tailwind` | Tailwind plugin that emits the directive. | build |
| cli | `src/cli` | the `optical-center` binary (+ `caret/`, a tiny TUI toolkit). | Node |

**The rule:** `model/` and `core/` must not import `node/`, `cache/`,
`babel/`, `vite/`, `cli/`, etc. Anything with a native binding, `fs` access, or
a worker thread belongs in `node/`, `cache/`, or `corrector/`, never in the
browser-safe core.

---

## Caching

The transform cache is content-addressable. The key is:

```
sha256(rawSvgBytes + ALGORITHM_VERSION)
```

Because the algorithm version is part of the key, a model change (with a bumped
`ALGORITHM_VERSION`) automatically invalidates every stale entry, no manual
cache clear needed. A warm second pass over 100 icons completes in well under
200 ms. Clear it explicitly with `optical-center clear-cache [--all]`.
