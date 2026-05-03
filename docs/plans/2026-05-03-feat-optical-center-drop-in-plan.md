---
title: Optical Center — Drop-in DX Implementation
type: feat
status: completed
date: 2026-05-03
origin: docs/brainstorms/2026-05-03-optical-center-drop-in-brainstorm.md
deepened: 2026-05-03
---

# Optical Center — Drop-in DX Implementation

## Enhancement Summary

**Deepened on:** 2026-05-03
**Sections enhanced:** Overview, Architecture, Phase 2 (Core), viewBox Algorithm, Babel Contract, Vite Responsibilities, Cache Strategy, Test Strategy, Risk Analysis, Open Questions, Sources
**Research agents used:** best-practices-researcher · framework-docs-researcher · kieran-typescript-reviewer · code-simplicity-reviewer · architecture-strategist · pattern-recognition-specialist · performance-oracle · security-sentinel · agent-native-reviewer · simplify

### Headline Decisions Updated by Research

1. **MVP package count: 4 → consider 1 with subpath exports.** Simplicity + architecture reviewers converge: ship `optical-center` (single package) with `optical-center/babel`, `optical-center/vite`, `optical-center/cli` subpath exports for v0.2. Multi-package split deferred to v0.3+ when real adoption demands isolation. (See ADR-1.)
2. **Babel deps: cut to `@babel/types` dep + `@babel/core` peer.** Plan listed 4 babel packages; only 2 are correct. (See ADR-2.)
3. **Vite plugin must declare `enforce: 'pre'`.** Plan was silent — without this, esbuild's JSX transform runs first and our visitor sees no `JSXElement`. (See ADR-3.)
4. **`?optical` SVG asset transform belongs in `load()` hook, not `transform()`.** Vite asset pipeline reads files in `load`; Babel-style `transform` is for JS/TS modules. (See ADR-4.)
5. **JSX→SVG attribute mapping: use `property-information` package, not hand-rolled table.** ~500-entry map maintained upstream by hast/wooorm. Saves a generated-file question entirely.
6. **viewBox shift formula sign + math: confirmed correct.** Independent verification by performance + simplicity agents.
7. **`paddingMode` MVP scope: `'shift'` only.** `'pad'` and `'skip'` deferred — Lucide-class icons have padding, real demand unproven. (See ADR-5.)
8. **`@optical-center/core` stays browser-safe.** `@resvg/resvg-js` (Node native) lives in a `@optical-center/node` subpackage / subpath, NOT in core. Browser consumers (Storybook preview, edge runtime) get pure-TS core. (See ADR-6.)
9. **Cache: drop content normalization (collision risk), keep sha256 (zero-dep, fast enough), drop 256-way sharding for MVP (flat dir up to 1000 entries), use `write-file-atomic`.** (See ADR-7.)
10. **Algorithm version: SHA of `packages/core/src/` (auto), not manual constant.** Eliminates "forgot to bump" failure mode flagged in original Open Question §3.
11. **Default `metadata` (breadcrumb dev-attrs): `false`.** Don't auto-derive from `NODE_ENV` — Vite plugin opts in when `command === 'serve'`. Removes prod-leak surface (Security F7).
12. **`loadSystemFonts: false`** by default in `rasterize.ts` — kills determinism gap (Security F1) AND saves cold-start time.
13. **Engine perf pass needed.** `computeSymmetryAxis` runs 14.4K × 36 angles per icon — drop to 12 for ~15 ms/icon savings. Plan's "10–50 ms / icon" claim is *just* achievable without this; comfortable with it. (See ADR-8.)
14. **CLI must support `--json`, structured exit codes, stdout/stderr split.** Currently agent-hostile; full registry of warning codes (OPTICAL_*) required. (See ADR-9, new CLI Output Contract section.)
15. **MCP server: planned for second wave.** `@optical-center/mcp` package gives Claude Code / Cursor / etc. direct programmatic access — natural extension of pure-API core.
16. **Vitest: `^1.0.0` → `^3.0.0`.** Plan was 2 majors behind 2026 standard.

### Critical New Sections Added

- **Architectural Decision Log** (10 ADRs)
- **CLI Output Contract** (stdout/stderr/exit/json policy)
- **Warning Code Registry** (8 stable codes)
- **Build-Time Limits & Security Hardening** (size/time/raster caps, supply-chain policy)
- **TypeScript Hardening** (strict flags, project references, build artifact strategy)
- **Engine Performance Pass** (Phase 2.5 — pre-integration optimizations)

### Open Questions: Resolved

All 7 original Open Questions are now resolved inline. The section is removed and decisions are folded into the appropriate Detailed Specifications.

## Overview

Mevcut `optical-center` TypeScript kütüphanesini (tek paket, `getOpticalCenter()`
tek API) **deklaratif, build-time, framework-agnostic bir drop-in sisteme**
dönüştüren çok-paketli bir mimariye taşıma. Kullanıcı tek bir işaretleyici
yazar — CSS'te `optical-center: auto`, JSX'te `opticalCenter`, HTML'de
`<svg optical-center>`, Tailwind'de `class="optical-center"` — ve build
pipeline'ı SVG içeriğini analiz edip viewBox'a optik ortalamayı gömer.
Tarayıcıya giden son kod düz, hesaplanmış SVG'dir; runtime hesap yapılmaz.

İlk MVP dört paketi içerir: `@optical-center/core` (mevcut motoru taşır),
`@optical-center/cli` (klasör tarayıcı), `@optical-center/babel` (JSX
inspector), `@optical-center/vite` (orkestratör). Vue/Svelte/Astro/PostCSS/
Tailwind/icon-library adapter'ları ikinci dalga.

## Problem Statement

Mevcut sürümde `optical-center` kütüphanesi şu kullanım yükünü kullanıcıya
bırakıyor:

1. SVG'yi raster'a çevirme (canvas / `@resvg/resvg-js`)
2. `getOpticalCenter()` çağırma
3. Display boyutuna scale etme
4. Sonucu CSS transform veya viewBox olarak DOM'a uygulama

Bu zincir uzun, framework başına farklı, ve runtime'da uygulanırsa pipeline
ağırlığı (10–50 ms / ikon) bundle'a girer. Kullanıcının yazdığı tek satırlık
deklarasyondan tarayıcı için optimize edilmiş çıktıya bir köprü yok.

İhtiyaç: **kullanıcı niyeti deklare etsin, sistem her şeyi build-time'da
hallolsun, çıktı her CSS framework'üyle doğal yaşasın, runtime'da sıfır
hesap olsun.**

## Proposed Solution

Brainstorm'da uzun tartışmalardan sonra netleşen mimari (bkz. brainstorm:
`docs/brainstorms/2026-05-03-optical-center-drop-in-brainstorm.md`):

**İki taraflı sistem.**

- **Taraf 1 — Content Inspector (per-environment adapter):** SVG'yi
  *gören* taraf. Babel/SWC plugin (JSX), Vue/Svelte preprocessor, Vite
  HTML transformer, asset loader. Her biri: SVG'yi bul → core motoruna
  ver → sonucu viewBox'a yaz.

- **Taraf 2 — Çekirdek motor (`@optical-center/core`):**
  Framework-agnostic hesaplama. Mevcut `getOpticalCenter()` API'si +
  yeni `transformViewBox()` helper'ı.

**Default output mode: viewBox rewrite + `data-optical-center` breadcrumb.**

Optik ortalama SVG'nin iç koordinat sistemine yazılır (viewBox attribute
shift). CSS dünyasıyla çakışmaz — `translate`, `transform`, animation,
hover scale hepsi bağımsız çalışır. `data-optical-center` boş HTML
attribute'u DevTools'ta görünürlük + CSS hedeflenebilirlik sağlar.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  User Code                                              │
│    <svg opticalCenter viewBox="0 0 24 24">...</svg>     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Per-Environment Inspector (Taraf 1)                    │
│    @optical-center/babel         (JSX)                  │
│    @optical-center/swc           (SWC)        [v2]      │
│    @optical-center/vite          (HTML/asset)           │
│    @optical-center/postcss       (CSS @decl) [v2]       │
│    @optical-center/vue           (SFC)        [v2]      │
└────────────────────┬────────────────────────────────────┘
                     │ (svgString, originalViewBox)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  @optical-center/core  (Taraf 2)                        │
│    rasterize(svgString) → ImageData (resvg-js)          │
│    getOpticalCenter(imageData) → {dx, dy, ...}          │
│    transformViewBox(svg, opts) → {viewBox, breadcrumb}  │
│    detectClipRisk(raster, viewBox, offset) → boolean    │
└────────────────────┬────────────────────────────────────┘
                     │ (newViewBox, breadcrumb attrs)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Cache Layer  (node_modules/.cache/optical-center/)     │
│    sha256(svg + algoVersion + scale) → cached result    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Output                                                 │
│    <svg viewBox="-0.42 -0.10 24 24" data-optical-center>│
│      ...                                                │
│    </svg>                                               │
└─────────────────────────────────────────────────────────┘
```

### Monorepo Structure

**Tooling: npm workspaces** (zero new tooling — mevcut `package.json`
dönüşür, contributor'lar ekstra global tool kurmaz). pnpm/yarn berkaç adımla
geçiş yapabilir; standart workspace protokolü kullanılır.

```
optical-center/                          (monorepo root)
├── package.json                         (workspaces: ["packages/*"])
├── tsconfig.base.json                   (paylaşılan TS config)
├── packages/
│   ├── core/                            (@optical-center/core)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── final-model.ts           (mevcut)
│   │   │   ├── compute-offset.ts        (mevcut)
│   │   │   ├── analyzer.ts              (mevcut)
│   │   │   ├── preprocessing.ts         (mevcut)
│   │   │   ├── perceptual.ts            (mevcut)
│   │   │   ├── symmetry.ts              (mevcut)
│   │   │   ├── convex-hull.ts           (mevcut)
│   │   │   ├── rasterize.ts             (YENİ — resvg-js wrapper)
│   │   │   ├── transform-viewbox.ts     (YENİ — viewBox rewrite)
│   │   │   ├── detect-clip-risk.ts      (YENİ — bbox check)
│   │   │   └── version.ts               (YENİ — algorithm version sabit)
│   │   └── tests/
│   │       ├── fixtures/icons/*.svg     (golden SVG'ler)
│   │       └── *.test.ts
│   ├── cli/                             (@optical-center/cli)
│   │   ├── package.json
│   │   ├── bin/optical-center           (executable)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── commands/transform.ts    (klasör → klasör)
│   │   │   ├── commands/info.ts         (tek SVG için debug)
│   │   │   └── cache.ts                 (paylaşılan cache wrapper)
│   │   └── tests/
│   ├── babel/                           (@optical-center/babel)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts                 (Babel plugin entry)
│   │   │   ├── visitor.ts               (JSX visitor)
│   │   │   ├── jsx-to-svg.ts            (JSX serialize → SVG string)
│   │   │   └── attribute-map.ts         (camelCase → kebab-case)
│   │   └── tests/
│   └── vite/                            (@optical-center/vite)
│       ├── package.json
│       ├── src/
│       │   ├── index.ts                 (plugin factory)
│       │   ├── transform-jsx.ts         (Babel orchestration)
│       │   ├── transform-svg-asset.ts   (?optical query handler)
│       │   ├── transform-html.ts        (transformIndexHtml)
│       │   └── shared-cache.ts
│       └── tests/
├── examples/
│   ├── react-vite/                      (entegrasyon test örneği)
│   └── vanilla-html/                    (CLI + HTML örneği)
├── docs/
│   ├── brainstorms/
│   ├── plans/
│   └── solutions/
├── .changeset/                          (versiyonlama)
└── README.md
```

### Implementation Phases

#### Phase 1 — Monorepo Foundation

**Hedef:** Mevcut single-package yapıyı bozulmadan workspaces'e taşı.

**Görevler:**

1. Root `package.json`'a workspaces ekle:
   ```json
   {
     "name": "optical-center-monorepo",
     "private": true,
     "workspaces": ["packages/*"]
   }
   ```
2. Mevcut `src/`'i `packages/core/src/`'e taşı (git mv ile history korumalı).
3. Mevcut `package.json`'ı `packages/core/package.json` olarak kopyala,
   `name` `optical-center` → `@optical-center/core` (geçiş süresince
   `optical-center` alias re-export olarak korunabilir).
4. Mevcut `tsconfig.json` → `packages/core/tsconfig.json`.
5. Root'a `tsconfig.base.json` ekle (paylaşılan compiler options).
6. Root `package.json` script'leri:
   ```json
   "scripts": {
     "build": "npm run build --workspaces --if-present",
     "test": "npm run test --workspaces --if-present"
   }
   ```
7. CI workflow ekle: GitHub Actions, Node 20+, `npm ci && npm test`.

**Çıktı:** Mevcut `getOpticalCenter()` API'si değişmeden çalışmaya devam
eder, sadece `@optical-center/core`'dan import edilir hale gelir.

**Süre tahmini:** 2-4 saat.

#### Phase 2 — Core Engine Genişlemesi

**Hedef:** Core'a build-time için gerekli üç yeni modül ekle.

**Görevler:**

1. `@resvg/resvg-js` dependency olarak ekle (`packages/core/package.json`).
2. `src/rasterize.ts` — SVG string → ImageData wrapper:
   ```typescript
   export interface RasterizeOptions {
     /** Raster boyutu (default: 120, model bu boyutta valide edildi). */
     size?: number;
   }
   export function rasterizeSvg(
     svg: string,
     options?: RasterizeOptions
   ): { data: Uint8ClampedArray; width: number; height: number };
   ```
3. `src/transform-viewbox.ts` — viewBox rewrite (kontrat aşağıda).
4. `src/detect-clip-risk.ts` — path bbox detection (kontrat aşağıda).
5. `src/version.ts` — algorithm version sabit:
   ```typescript
   export const ALGORITHM_VERSION = '1.0.0-v2';
   ```
6. `index.ts`'e yeni public exports ekle.
7. Test: 5+ golden fixture SVG için `transformViewBox()` snapshot.

**Süre tahmini:** 1-2 gün.

#### Phase 3 — CLI

**Hedef:** Framework'süz kullanım için komut satırı aracı.

**Görevler:**

1. `packages/cli` skeleton (commander veya minimist).
2. Komutlar:
   - `optical-center transform <input> [output]` — klasör → klasör
   - `optical-center info <svg-file>` — tek SVG için debug raporu
   - `optical-center clear-cache` — cache temizliği
3. Cache layer (Phase 5'te paylaşılır olacak) — başlangıçta CLI içinde.
4. Test: fixtures'dan klasör input → output snapshot.

**Süre tahmini:** 1 gün.

#### Phase 4 — Babel Plugin

**Hedef:** JSX'te `<svg opticalCenter>` pattern'ini build-time'da rewrite et.

**Görevler:** (kontrat aşağıda detaylı)

1. `packages/babel` skeleton.
2. Visitor: `JSXElement` traverser, `opticalCenter` attribute matcher.
3. JSX → SVG string serializer (`jsx-to-svg.ts`).
4. Bail-out koşulları (dynamic content).
5. AST mutation: viewBox rewrite + breadcrumb ekleme + opticalCenter strip.
6. Test: 10+ JSX fixture, snapshot output.

**Süre tahmini:** 2-3 gün.

#### Phase 5 — Vite Plugin

**Hedef:** Babel plugin'i + HTML transform'u + asset transform'u orkestre et.

**Görevler:**

1. `packages/vite` skeleton.
2. `transform(code, id)`: `.jsx`/`.tsx` için Babel plugin run.
3. `transform(code, id)`: `*.svg?optical` için SVG asset transform.
4. `transformIndexHtml(html)`: `<svg optical-center>` HTML scan.
5. Paylaşılan cache wrapper (`packages/core/cache.ts`'e taşı).
6. Vite config types augmentation.
7. Test: küçük örnek React+Vite app, build sonrası `dist/` snapshot.

**Süre tahmini:** 2-3 gün.

#### Phase 6 — Documentation & Examples

**Hedef:** Yeni mimariyi tüketebilir bir README ve örneklerle yayınla.

**Görevler:**

1. Root README — yeni mimari özeti, paket map'i, hızlı başlangıç.
2. Her paketin kendi README'si.
3. `examples/react-vite/` — çalışan minimal entegrasyon.
4. `examples/vanilla-html/` — CLI tabanlı kullanım.
5. Migration rehberi (eski API kullanan kullanıcılar için).

**Süre tahmini:** 1 gün.

**Toplam MVP süresi:** ~8-12 gün geliştirme (cache, edge case'ler, test
yükü dahil).

> **Deepening note:** ADR-1 single-package'a indirdiğimizden Phase 1
> "monorepo foundation" → **Phase 0: TS hardening + structure**'a dönüşür.
> Yeni Phase 2.5 (Engine performance pass — ADR-8) eklendi.
> Net süre tahmini: ~6-8 gün (paket-bölme overhead'i kalktı, perf pass eklendi).

## Detailed Specifications

### viewBox Rewrite Algorithm Contract

**Module:** `packages/core/src/transform-viewbox.ts`

**Public API:**

```typescript
export interface TransformViewBoxOptions {
  /**
   * Edge case'de davranış:
   *  - 'shift'  : (default) sadece viewBox X/Y kaydır, boyut sabit.
   *               Path kenarda ise clipping olabilir.
   *  - 'pad'    : viewBox'ı clipping'i önleyecek şekilde genişlet.
   *               SVG render boyutunu değiştirebilir.
   *  - 'skip'   : clipping riski varsa SVG'yi olduğu gibi bırak.
   */
  paddingMode?: 'shift' | 'pad' | 'skip';

  /**
   * Breadcrumb attribute'larında orijinal viewBox + offset metadata
   * yer alsın mı (debug için).
   */
  includeMetadata?: boolean;
}

export interface TransformViewBoxResult {
  /** Yeni viewBox değeri ("x y w h" formatında). */
  viewBox: string;

  /** Element'e eklenecek HTML attribute'ları. */
  breadcrumb: {
    'data-optical-center': '';
    'data-optical-original-viewbox'?: string;
    'data-optical-offset'?: string;
  };

  /** Hesaplanan offset (bilgi amaçlı). */
  offset: {
    dxPercent: number;
    dyPercent: number;
  };

  /** Clipping tespit edildi mi (warning için). */
  clipDetected: boolean;
}

export function transformViewBox(
  svg: string,
  options?: TransformViewBoxOptions
): TransformViewBoxResult;
```

> **Research insights — signature & API revisions (Kieran-TS, simplify, architecture):**
>
> Yukarıdaki signature güncellenir:
>
> ```typescript
> // ADR-5: paddingMode option silindi. ADR-6: rasterizeSvg ayrı subpath'te.
> // dx/dy raster-pixel ↔ dxPercent type mismatch çözülüyor.
> export interface ViewBoxTransformOptions {
>   readonly emitMetadata?: boolean;  // default: false (ADR-9, security F7)
> }
>
> export interface ViewBoxTransformResult {
>   readonly viewBox: string;
>   readonly breadcrumb: ViewBoxBreadcrumb;
>   readonly offset: { readonly dxPercent: number; readonly dyPercent: number };
>   readonly clipDetected: boolean;
> }
>
> // Compose-friendly: caller raster + offset paylaşabilir
> export function transformViewBox(
>   svg: string,
>   raster: RasterImage,             // explicit, no hidden rasterize
>   offset: OpticalCenterResult,     // explicit, no hidden compute
>   options?: ViewBoxTransformOptions
> ): ViewBoxTransformResult;
>
> // Convenience wrapper (optical-center/node subpath'te yaşar — resvg-js dep)
> export function transformViewBoxFromSvg(
>   svg: string,
>   options?: ViewBoxTransformOptions
> ): ViewBoxTransformResult;
> ```
>
> Sebepler:
> - **Naming:** `TransformViewBoxOptions` → `ViewBoxTransformOptions` (verb-noun-Options stuttering).
> - **`readonly` modifiers** public result için (caller mutate ederse bug).
> - **Composable signature:** raster + offset explicit → Babel plugin aynı SVG için raster'ı `getOpticalCenter` + `detectClipRiskFromRaster` + `transformViewBox` arasında paylaşabilir (3× rasterize etmek yerine 1×).
> - **`OpticalCenterResult` `dxPercent`/`dyPercent` ekle** (mevcut `final-model.ts:26-31` sadece `dx`/`dy`). Bu eklemeyle `transformViewBox` `OpticalCenterResult`'tan direkt tüketebilir.
> - **`RasterImage` ortak tip** (`packages/core/src/types.ts`'te tek tanım) — mevcut 6+ inline shape (analyzer.ts:39, final-model.ts:39, compute-offset.ts:97/290 …) konsolide.

**Deterministik formül:**

Inputs:
- Original viewBox: `(X, Y, W, H)` (parsed from `viewBox` attribute,
  veya `width`/`height` attribute'larından `(0, 0, w, h)` derive edilir,
  ikisi de yoksa default `(0, 0, 100, 100)`).
- `getOpticalCenter()` çıktısı: `{dxPercent, dyPercent}`.

Hesaplama:

```
newX = X - (dxPercent / 100) * W
newY = Y - (dyPercent / 100) * H
newW = W
newH = H
```

**Sign convention:**

`dxPercent > 0` ⇒ "ikon ortalanmak için sağa kaydırılmalı".

viewBox'ta sağa kaydırma efekti = viewBox X değerini SOLA al (negatif yön).
Çünkü viewBox window'u sola kayarsa path göreceli olarak sağa kayar.

Math gerekçesi:
- Path bir noktada `(px, py)`, viewBox `(X, Y, W, H)`.
- Render edilen pozisyon (relative): `((px - X) / W, (py - Y) / H)`.
- `px = (X + W/2)` (viewBox geometrik merkezi) → relative pozisyon `(0.5, 0.5)`.
- `X` `(X - dx_vb)`'ye değişirse, aynı `px` için relative pozisyon
  `((px - (X - dx_vb)) / W) = (0.5 + dx_vb/W)` olur.
- `dx_vb / W` `dxPercent / 100`'e eşit olduğu için relative pozisyon
  `(0.5 + dxPercent/100, 0.5 + dyPercent/100)` — yani path tam
  istenen kadar sağa-aşağı kaymış görünür.

**Format:** `newViewBox` string'i 4 ondalık basamağa yuvarlanır
(`Number.toFixed(4)`'ten trailing zeros kırpılarak), örn. `-0.42 0 24 24`.
Bu hem deterministik hem okunaklı.

**Edge case (paddingMode = 'pad'):**

```
expandX = max(0, dxPercent / 100) * W      // sağa kaydırma → sol kenarda extra
expandY = max(0, dyPercent / 100) * H
contractX = max(0, -dxPercent / 100) * W   // sola kaydırma → sağ kenarda extra
contractY = max(0, -dyPercent / 100) * H

newX = X - (dxPercent / 100) * W
newY = Y - (dyPercent / 100) * H
newW = W + |dxPercent| / 100 * W           // genişle
newH = H + |dyPercent| / 100 * H
```

`pad` modunda SVG'nin `width`/`height` attribute'ları da orantılı
büyütülür (`newW/W` ve `newH/H` oranıyla) ki render boyutu korunsun.

### Path Bbox & Clip Risk Detection

**Module:** `packages/core/src/detect-clip-risk.ts`

**Yaklaşım:** Raster alfa kanalından bbox çıkar (zaten rasterize ediyoruz,
maliyet yok).

```typescript
export interface ClipRiskInput {
  /** getOpticalCenter pipeline'ından gelen raster (alpha içerir). */
  raster: { data: Uint8ClampedArray; width: number; height: number };
  /** Original viewBox. */
  viewBox: { x: number; y: number; w: number; h: number };
  /** Offset (% cinsinden). */
  offset: { dxPercent: number; dyPercent: number };
}

export interface ClipRiskResult {
  /** Clipping olacak mı (paddingMode='shift'de). */
  willClip: boolean;
  /** Path'in raster bbox'ı (debug için). */
  pathBboxRaster: { minX: number; minY: number; maxX: number; maxY: number };
  /** Path'in viewBox bbox'ı. */
  pathBboxViewBox: { minX: number; minY: number; maxX: number; maxY: number };
}

export function detectClipRisk(input: ClipRiskInput): ClipRiskResult;
```

**Algoritma:**

1. Raster'da alfa > threshold (e.g. 1) olan piksellerin min/max x,y'si
   bul → `pathBboxRaster`.
2. Raster→viewBox dönüşümü: `pixelX * (W / rasterW)` benzeri.
3. Yeni viewBox window'u: `(X', Y', W, H)` (paddingMode='shift'den).
4. Clipping kontrolü:
   ```
   willClip =
     pathBbox.minX < newViewBox.x ||
     pathBbox.maxX > newViewBox.x + newViewBox.w ||
     pathBbox.minY < newViewBox.y ||
     pathBbox.maxY > newViewBox.y + newViewBox.h;
   ```
5. `willClip = true` ise, `transformViewBox` `OPTICAL_CLIP_DETECTED` warning emit eder + result'ta `clipDetected: true` set eder. (ADR-5: tek mod = shift; pad/skip kaldırıldı.)

> **Research insights — clip detection (architecture, simplicity, pattern-recognition):**
>
> - **Module relocation:** `detectClipRisk` ayrı dosya/public export değil — `transform-viewbox.ts` içinde **internal helper** (`detectClipRiskFromRaster`). `transformViewBox` zaten `clipDetected: boolean` döndürüyor; ikinci public API gereksiz (pattern-recognition dup-API flag).
> - **Threshold consistency:** Plan "alpha > 1" diyor (1/255 = 0.004). Mevcut `analyzer.ts:51` "a < 0.01" (~2.55/255). **Tutarsızlık.** Çözüm: `packages/core/src/constants.ts` → `export const ALPHA_THRESHOLD = 3` (raw 0-255, ~0.012 normalized). Hem `buildWeightMap` hem `detectClipRiskFromRaster` aynı sabiti import eder.
> - **Power user için ayrı export:** Eğer raw bbox lazımsa `getRasterBbox(raster) → BBox` saf helper (browser-safe, core'da yaşar).

### Babel Plugin AST Contract

**Module:** `packages/babel/src/visitor.ts`

**Match pattern:** `JSXElement` ki:
- Açılış tag'i: `JSXOpeningElement` with `name.name === 'svg'`
- Attribute'lar arasında: `JSXAttribute` with `name.name === 'opticalCenter'`
  - Value: `null` (boolean prop), `JSXExpressionContainer` with literal
    `true`, ya da `StringLiteral` with `'auto'`
  - Diğer değerler (false, expression, dynamic) → bail out

**Pre-conditions (statik analiz başarılı olmalı):**

1. `viewBox` attribute statik string olmalı (veya yok — `width`/`height`
   ile derive edilebilir).
2. Tüm child node'lar statik:
   - `JSXElement` (path, circle, rect, vb.) — recurse
   - `JSXText` (whitespace) — preserve
   - `JSXExpressionContainer` — bail out (`{children}` gibi şeyler)
3. Tüm static element attribute'ları StringLiteral veya
   JSXExpressionContainer with literal.

**Bail-out:** Yukarıdaki koşullardan biri bozuksa, JSXElement'e
dokunulmaz, opsiyonel build warning emit edilir (`OPT_CTR_DYNAMIC_SVG`
kodu ile).

**Action (statik durumda):**

1. **JSX → SVG string serialize.** `packages/babel/src/jsx-to-svg.ts`:
   - Outer `<svg>` tag'i ve attribute'larını yaz.
   - Children'ı recursive serialize et.
   - Attribute name dönüşümü: camelCase → kebab-case
     (`strokeWidth` → `stroke-width`). Tam tablo
     `attribute-map.ts`'de (React DOM'un mapping'inden türetilir).
   - Self-closing element'leri (`<path .../>`) aynen koru.
   - `opticalCenter` attribute'u serialize'a dahil edilmez.

2. **Core motoru çağır:**
   ```
   const raster = rasterizeSvg(svgString);
   const offset = getOpticalCenter(raster);
   const result = transformViewBox(svgString, { paddingMode: 'shift' });
   ```

3. **Cache lookup/write** (Phase 5'te detaylanıyor).

4. **AST mutation:**
   - `opticalCenter` attribute'unu kaldır.
   - `viewBox` attribute'u:
     - Varsa: value'sunu `result.viewBox` ile replace et.
     - Yoksa: yeni `JSXAttribute` ekle.
   - `data-optical-center` attribute ekle (value `null` = HTML'de boolean).
   - `process.env.NODE_ENV === 'development'` veya plugin option
     `metadata: true` ise:
     - `data-optical-original-viewbox` (orijinal viewBox)
     - `data-optical-offset` (`"1.7500% 0.4100%"` formatında)

**Plugin options:**

```typescript
// ADR-5: paddingMode silindi. ADR-9: metadata default false.
// Pattern-recognition: CommonOptions base, naming clean.
export interface CommonOpticalCenterOptions {
  readonly cacheDir?: string;
  readonly emitMetadata?: boolean;
}

export interface BabelPluginOptions extends CommonOpticalCenterOptions {
  readonly warnOnBailOut?: boolean;        // default: true
  readonly maxInputBytes?: number;         // default: 5_000_000 (security)
}

// Plugin entry signature (best-practices-researcher):
import { declare } from '@babel/helper-plugin-utils';

export default declare<BabelPluginOptions>((api, options) => {
  api.assertVersion(7);
  return {
    name: 'optical-center',  // short — error messages
    pre(file) { /* cache init */ },
    visitor: { JSXOpeningElement(path) { /* two-phase: validate → commit */ } },
    post(file) { /* teardown */ }
  };
});
```

> **Research insights — Babel plugin (best-practices, framework-docs, security, pattern-recognition):**
>
> - **Deps minimal (ADR-2):** `dependencies: { "@babel/types", "@babel/helper-plugin-utils" }`, `peerDependencies: { "@babel/core" }`. `@babel/parser` ve `@babel/traverse` host'tan gelir.
> - **`@babel/generator` JSX → SVG yapamaz** (framework-docs flagged). Generator JSX'i JS olarak serialize eder, SVG XML değil. Custom recursive walker yazılır (`packages/babel/src/jsx-to-svg.ts` veya tek-paket'te `src/babel/jsx-to-svg.ts`).
> - **Attribute mapping: `property-information` package** (`wooorm/property-information`) — manuel `attribute-map.ts` yazma. ~500 attribute (HTML+SVG+ARIA) maintained upstream. SVG'nin camelCase kalması gereken edge case'leri (`viewBox`, `preserveAspectRatio`, `gradientUnits`, `gradientTransform`) doğru handle ediyor — naive camel→kebab kırılır.
> - **JSXNamespacedName** (`xlink:href`, `xmlns:xlink`) plan'ın bail-out matrix'inde yoktu. SVG'de yaygın (`<use xlink:href>`). Plugin bunları handle eder (passthrough), bail-out etmez.
> - **`@babel/preset-react` ile sıralama (framework-docs):** Plugins-before-presets kuralı sayesinde plugin React JSX transform'undan ÖNCE çalışır. Vite tarafında Vite plugin `enforce: 'pre'` (ADR-3) esbuild JSX transform'undan ÖNCE garanti eder.
> - **Two-phase atomicity (security F6):** Visitor strict olarak (a) read-only validate (bail-out check + JSX serialize + raster + transform) → (b) commit (AST mutate). Native crash veya throw durumunda AST yarı-mutate kalmaz. **`JSXSpreadAttribute` early bail** (gizli `opticalCenter` saldırı vektörü).
> - **`metadata` default `false`** (security F7, ADR-9). `process.env.NODE_ENV` autoderive yok — Vite plugin `command === 'serve'` görüp explicit `emitMetadata: true` geçer.
> - **`@babel/types` discriminated checks**: `t.isJSXIdentifier(node.name, { name: 'svg' })` formu hem tipi hem ismi tek seferde valide eder. `JSXMemberExpression` (`<Svg.Container>`) için ayrı check.
> - **Plugin re-entry guard:** mutation sonrası `node._opticalProcessed = true` veya `path.skip()` — Babel pass'leri pipeline'da iki kez koşabilir.
> - **Source map preservation:** Vite plugin Babel'i `transformAsync({ sourceMaps: true, inputSourceMap: prevMap, babelrc: false, configFile: false })` ile çağırır. `babelrc: false` kullanıcının kendi babel config'inin sızmamasını garantiler (security).

### Vite Plugin Responsibilities

**Module:** `packages/vite/src/index.ts`

```typescript
export default function opticalCenter(
  options?: OpticalCenterViteOptions
): Plugin;
```

**Yaşam döngüsü hook'ları:**

1. **`config(config)`:**
   - Vite config'i augment et (gerekirse esbuild loaders).

2. **`buildStart()`:**
   - Cache dizinini hazırla (`node_modules/.cache/optical-center/`).
   - Algorithm version'ı oku, cache invalidation yap (eski version'ları sil).

3. **`transform(code, id)` — JSX/TSX:**
   - `id` `.jsx`/`.tsx` ile bitiyorsa, `@optical-center/babel` plugin'ini
     `@babel/core` ile çalıştır.
   - Source map'i preserve et.
   - Bail-out durumlarında orijinal kodu döndür.

4. **`transform(code, id)` — SVG asset:**
   - `id` `.svg?optical` query'siyle gelmişse:
     - SVG dosya içeriğini oku.
     - `transformViewBox()` çağır.
     - Çıktıyı yeni SVG string olarak return et (Vite normal asset
       handling'ine girer).
   - `?optical` yoksa: dokunma (Vite'ın default SVG loader'ı çalışsın).

5. **`transformIndexHtml(html)`:**
   - HTML parser ile (e.g. `node-html-parser` veya `parse5`) DOM'u tara.
   - `<svg optical-center>` veya `[optical-center]` attribute'lu element'leri bul.
   - Her biri için: outerHTML'i çek → `transformViewBox()` → DOM'a yaz back.
   - Modified HTML'i return et.

6. **`handleHotUpdate(ctx)`:**
   - Dev mode'da SVG asset değişince ilgili cache entry'sini invalidate et.

**Plugin options:**

```typescript
// ADR-9 + pattern-recognition: clean naming, options.cache disambiguated
export interface VitePluginOptions extends CommonOpticalCenterOptions {
  readonly include?: string[];
  readonly exclude?: string[];
  readonly babel?: BabelPluginOptions;
  readonly cache?: false | { dir?: string };  // false = disable; obj = configure
  readonly stripScripts?: boolean;             // default: true (security F9)
  readonly maxInputBytes?: number;             // default: 5_000_000
}
```

> **Research insights — Vite plugin (best-practices, framework-docs, security, agent-native):**
>
> - **`enforce: 'pre'` ZORUNLU (ADR-3).** Vite plugin order: alias → user-pre → vite-core → user (no enforce) → vite-build → user-post. esbuild JSX transform "vite-core" katmanında — bizden sonra çalışırsa AST'imizde `JSXElement` yerine `CallExpression` olur, visitor hiçbir şey yakalamaz.
> - **`*.svg?optical` → `load()` hook (ADR-4)**, `transform()` değil. `transform`'da `code` parametresi Vite'ın okuduğu içerik (string asset URL veya inline data — duruma göre). `load`'da SVG'nin raw content'ini biz `fs.readFile` ile okur, `transformViewBox` çalıştırır, return ederiz; sonraki `transform` zinciri bunu görür.
> - **Vite 6.3+ `filter` API:** `load: { filter: { id: /\.svg(\?optical)?$/ }, handler }` — id JS layer'ına gelmeden filter native (Rolldown). 2-5× perf, eski Vite'ta sessizce ignore edilir (geriye uyumlu).
> - **`transformIndexHtml: { order: 'post', handler }`** — Vite asset URL rewrite'ı önce çalışsın, biz sonra modify edelim. HTML parser olarak `parse5` (Vite'ın kendi kullandığı, spec-compliant) tercih; `node-html-parser` MVP için yeterli ama `<foreignObject>`/HTML5 quirks karşısında tutarsızlık riski.
> - **`handleHotUpdate` scope:** Plan'ın "her SVG değişiminde invalidate" iddiası fazla — `<svg opticalCenter>` JSX inline ise `.tsx` dosyası değişimi zaten `transform()`'u tetikler ve cache key SVG content'ten türediği için **doğru entry vurulur**. Sadece `*.svg?optical` external file değişimi için manuel invalidation gerekir (10 satırlık handler).
> - **Vite version policy (framework-docs):** Plan "Vite 5+" diyordu — 2026 itibariyle Vite 7 stable, Vite 8 prerelease. `peerDependencies: { "vite": ">=5" }` koru ama README'de "tested on 5.x and 7.x" notu.
> - **HTML output scrub (security F9):** `stripScripts: true` default. `transformIndexHtml` ve `?optical` path'lerinde `on*` attribute'lar + `<script>` + `<foreignObject>` strip edilir. Babel/JSX yolu zaten React'in kapısından geçtiği için `on*` attribute'lar runtime'da React event'leri olur — JSX path için scrub gereksiz.
> - **`config(userConfig, env)` hook'unda mode detection:** `command === 'serve'` ? plugin's Babel options'ına `emitMetadata: true` geçir; `command === 'build'` ise default false. Bu plan'ın `process.env.NODE_ENV` autoderive sorununu (security F7) çözer.

### Cache Strategy

**Module:** `packages/core/src/cache.ts` (Phase 5'te core'a taşınır).

**Hash key:**

```
hashKey = sha256(
  svgContent_normalized +
  ALGORITHM_VERSION +
  CORRECTION_SCALE +
  paddingMode +
  rasterSize
)
```

`svgContent_normalized` = SVG string'inden whitespace ve comment'ler
strip edilmiş hali (deterministik anahtar için).

**Storage:**

```
node_modules/.cache/optical-center/
├── manifest.json                       (algoritma version metadata)
└── <hash[0:2]>/
    └── <hash[2:]>.json
```

İki karakter prefix'le 256-way sharding — tek dizinde 100k+ dosya
performans sorununu önler.

**Entry schema:**

```json
{
  "v": 1,
  "key": "<hash>",
  "input": {
    "originalViewBox": "0 0 24 24",
    "rasterSize": 120
  },
  "output": {
    "viewBox": "-0.42 -0.10 24 24",
    "offset": { "dxPercent": 1.75, "dyPercent": 0.41 },
    "clipDetected": false
  },
  "computedAt": "2026-05-03T14:23:01.000Z",
  "algorithmVersion": "1.0.0-v2"
}
```

**Invalidation:**

- `ALGORITHM_VERSION` değişimi → tüm cache wipe (`buildStart` hook'unda).
- Manifest'teki version mismatch → wipe.
- Manuel: `optical-center clear-cache` CLI komutu.

**Concurrency:** Build-time'da paralel transform'lar olabilir. Atomic
write pattern kullanılır (`tmp dosya + rename`). Read'ler lock-free
(immutable JSON).

**Lookup performance:** Tipik build'de cache hit ~0.5 ms (JSON parse +
filesystem read). Cache miss ~10-50 ms (full pipeline). 100 ikon için:
- Cold build: 1-5 saniye
- Warm build: ~50 ms

> **Research insights — cache (ADR-7, security F3/F4, performance):**
>
> - **Hash key:** `sha256(rawSvgBytes + paddingMode + ALGORITHM_VERSION)`. **Normalization YOK** (security F3 — collision attack vector). Plan'ın "whitespace + comments strip" yaklaşımı `<text>foo bar</text>` ↔ `<text>foo  bar</text>` veya path data spacing'lerinde adversarial pair üretmeye olanak tanır. sha256 raw bytes üstünden — cache hit rate düşer ama doğruluk artar.
> - **`CORRECTION_SCALE` ve `rasterSize` cache key'inden çıkarılır:** ikisi de `ALGORITHM_VERSION`'ın türevidir (sabit constants). Anahtar yer kaplaması azalır.
> - **Layout flat:** `node_modules/.cache/optical-center/<algorithmVersion>/<hash>.json`. Sharding 1000+ entry'de otomatik açılır (config flag). MVP 50-200 ikon için flat optimal.
> - **Manifest YOK:** version path'e gömülü. Eski version dizinleri orphan kalır, garbage; manuel `clear-cache --all`.
> - **`ALGORITHM_VERSION`:** build-time'da `packages/core/src/` (veya tek-paket'te `src/`) sha256 fingerprint'i. Manuel constant unutma riskini sıfırlar.
> - **Atomic write:** `write-file-atomic` paketi (~20 KB, npm CLI'in kullandığı). `tmp + rename` POSIX atomic; `fsync` opsiyonel. (Security F4)
> - **Read validation:** Cache entry parse'tan sonra `entry.key === lookupHash` doğrulaması — poisoning'e karşı O(1) defense.
> - **L1 in-memory cache (performance critical):** `Map<hash, ViewBoxTransformResult>` + LRU 1000 entry cap. **Plan'da yok ama ekleniyor.** Aynı SVG 50 component'te kullanılıyorsa L1 hit ~0.001 ms × 49 (vs disk read 50 ms × 49 = 2.5 saniye). HMR'da kritik.
> - **Request coalescing:** `inflight: Map<hash, Promise<Result>>` — paralel duplicate request'leri tek pipeline'a coalesce eder. Aksi halde Vite worker pool'unda 4 worker × duplicate compute (5-20× wasted CPU).
> - **Cache hit metric:** L1 hit / L2 hit / miss ayrı raporlanır. CLI `--json` ile build sonu summary'sinde emit.

### Test Strategy

**Module-level (her paket için):**

- Vitest (Vite ekosistemiyle uyum + ESM native + hızlı).
- Coverage hedef: %85+ (core), %75+ (adapter'lar).

**Core paketi:**

1. **Birim testler:**
   - `rasterizeSvg`: bilinen SVG → bilinen raster boyutu.
   - `transformViewBox`: 5+ golden fixture, snapshot match.
   - `detectClipRisk`: hem clip-safe hem clip-risk SVG'ler.

2. **Determinizm testi:**
   ```typescript
   test('transformViewBox is deterministic', () => {
     const svg = readFixture('play.svg');
     const r1 = transformViewBox(svg);
     const r2 = transformViewBox(svg);
     expect(r1.viewBox).toBe(r2.viewBox);
   });
   ```

3. **Regression fixture set:**
   - 20+ SVG (lucide subset, çeşitli simetri profilleri).
   - Her biri için kayıtlı `expectedViewBox` snapshot.
   - Pipeline değişikliği bunları kıracak — bilinçli onay gerekir.

**Babel paketi:**

1. **JSX → JSX transform snapshot:**
   ```typescript
   test('rewrites viewBox on opticalCenter prop', () => {
     const input = `<svg opticalCenter viewBox="0 0 24 24"><path d="M..."/></svg>`;
     const output = transformWithBabel(input, [opticalCenterPlugin]);
     expect(output).toMatchSnapshot();
   });
   ```

2. **Bail-out scenarios:**
   - Dynamic children: `<svg opticalCenter>{paths}</svg>` → unchanged.
   - Dynamic viewBox: `<svg opticalCenter viewBox={vb}>` → unchanged.
   - opticalCenter={false} → unchanged (false → no-op).

3. **Edge cases:**
   - SVG without viewBox but with width/height.
   - Nested SVG (yalnızca outer transform edilmeli).
   - opticalCenter spread: `<svg {...props}>` ile gizli — bail-out.

**Vite paketi:**

1. **Unit:** her hook'u izole test et (mock Vite API).
2. **Integration:** `examples/react-vite/` build et, `dist/` çıktısını
   regex/parse ile valide et.

**Visual regression (opsiyonel — Phase 6 sonrası):**

- Playwright + sıfırdan dev server.
- Her fixture'ı render et, screenshot karşılaştır.
- Pixel-level diff (CI'da false-positive riski yüksek, manuel karar).

> **Research insights — testing (framework-docs Vitest 3, simplify, performance):**
>
> - **Vitest version:** Plan `^1.0.0` → **`^3.0.0`** (2 majors yenilemeli). Vitest 3 inline `projects` field, `toMatchFileSnapshot()` (büyük HTML/SVG snapshot için ideal), v8 coverage default.
> - **Snapshot vs property test (simplify):** 20 fixture snapshot'ı algoritma her tweak'inde 20 manuel review demek. Önerilen split:
>   - **5 representative snapshots** (lucide play, search, asymmetric letter A, symmetric circle, edge-padding-tight) — pixel-equal regression.
>   - **15 property tests** — invariant-based: "output viewBox numerically equals input shifted by computed offset", "deterministic", "alpha bbox always within new viewBox unless clipDetected".
> - **Test pyramid revision:** `examples/react-vite/` real Vite build CI'da 5+ saniye. Yerine: inline JSX string + Babel plugin only — 100ms, aynı kapsama. Real example app manuel sanity check + docs aid olarak kalır.
> - **Benchmark suite (performance-oracle):** `tests/benchmarks/`:
>   - `per-icon-pipeline.bench.ts` — p50 < 30ms, p95 < 50ms.
>   - `cold-vs-warm-build.bench.ts` — 100 ikon cold < 5000ms, warm < 200ms.
>   - `cache-tier-hit-rate.bench.ts` — L1+L2 > 95%.
>   - `raster-size-fidelity.bench.ts` — 96 vs 120 vs 160 dxPercent diff < 0.1%.
>   - `memory-peak.bench.ts` — 100 paralel transform peak heap < 100 MB.
> - **Bail-out scenario coverage (security F6):** `<svg {...{opticalCenter: true}}>` (spread-injection) MUST bail. Test fixture eklenecek.

### viewBox Padding Edge Case Handling

Brainstorm'da açık soru olarak işaretlenmişti — burada karara bağlanıyor.

**Default davranış: `paddingMode: 'shift'` + warning.**

- `transformViewBox()` `clipDetected: true` döndürdüğünde:
  - Babel plugin: build warning emit eder
    (`[optical-center] Path may be clipped by viewBox shift in icon: ${id}`).
  - CLI: stderr'a uyarı + non-zero exit code (--strict ile).
  - Vite plugin: Vite logger'ı kullanarak warn.

**Opt-in `paddingMode: 'pad'`:**

- viewBox boyutunu offset miktarınca genişletir.
- `width`/`height` attribute'larını orantılı büyütür (render boyutu korunur).
- Layout açısından risk: SVG'nin total rendered boundary'si değişir.
  Kullanıcı opt-in'iyle kabul etmiş sayılır.

**Detection precision:**

- Raster bbox alpha > 1 threshold ile hesaplanır.
- 120×120 raster'da 1 pixel granularity → viewBox 24 birim ise 0.2 birim
  hassasiyet. Sub-pixel offset'lerde (genelde tüm optik ortalama
  offset'leri) bu yeterli güvenlik marjı.
- Alternative: ikon sınırına 1-2 piksel ek "safety margin" ekle.

**Lucide gibi kütüphanelerde:** Tüm ikonlar 24×24 viewBox'ta ~2-3 birim
internal padding'e sahip (path'ler genelde 2-22 aralığında). dxPercent
genelde ±2% civarı, viewBox üzerinde 0.5 birim shift demek. 2 birim
slack >> 0.5 birim shift → clipping olmaz. Pratik olarak `'shift'` yeter.

> **Research insights — padding decision (ADR-5, simplify):**
>
> Bu bölüm artık küçük: `'shift'` tek mod, plan'ın kendi argümanı (Lucide-class ikonlarda padding yeter) yeterli. `'pad'` ve `'skip'` v0.3+'a bırakıldı. `OPTICAL_CLIP_DETECTED` warning kullanıcıya kararı bırakır (manuel custom viewBox set, `optical-center` class atmama, vb.).

### Migration Plan

Mevcut `src/` → `packages/core/src/`. Public API değişmemeli (mevcut
kullanıcılar için).

**Adım 1 — Branch hazırlığı:**
```bash
git checkout -b feat/monorepo-migration
mkdir -p packages/core
git mv src packages/core/src
git mv tsconfig.json packages/core/tsconfig.json
```

**Adım 2 — packages/core/package.json:**
```json
{
  "name": "@optical-center/core",
  "version": "0.2.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  },
  "dependencies": {
    "@resvg/resvg-js": "^2.6.0"
  }
}
```

**Adım 3 — Root package.json:**
```json
{
  "name": "optical-center-monorepo",
  "private": true,
  "workspaces": ["packages/*", "examples/*"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.0.0"
  }
}
```

**Adım 4 — Geriye dönük uyumluluk (geçici):**

Eski `optical-center` paketini deprecate ederek `@optical-center/core`'a
yönlendir. v0.1.x kullanıcılar için bir kez `optical-center@0.2.0`
publish edilir; bu sürüm sadece şunu içerir:
```json
{
  "name": "optical-center",
  "version": "0.2.0",
  "deprecated": "Renamed to @optical-center/core",
  "dependencies": { "@optical-center/core": "^0.2.0" },
  "main": "index.js"
}
```
ve `index.js`:
```js
export * from '@optical-center/core';
```

**Adım 5 — README & changelog:**
- Root `README.md` yeni mimariyi anlatır, paket map'i içerir.
- `packages/core/README.md` mevcut README'nin az değişmiş hali.
- `CHANGELOG.md` 0.1 → 0.2 migration notu.

**Adım 6 — Versionlama:**

Changesets ile multi-package release:
```bash
npm install -D @changesets/cli
npx changeset init
```

Her PR'da `.changeset/*.md` ile etkilenen paketler ve semver bump
beyan edilir. Release zamanı `npx changeset publish` tüm değişen
paketleri yayınlar.

**Adım 7 — CI:**

GitHub Actions:
```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: npm run test
```

## Alternative Approaches Considered

(Brainstorm'da uzun tartışıldı — özet için bkz. brainstorm doc.)

1. **Sadece runtime kütüphane:** Reddedildi. Pipeline ağırlığı (10–50
   ms/ikon) bundle'a girer, ilk paint'i geciktirir.

2. **Sadece PostCSS plugin (`optical-center: auto` derleyicisi):**
   Reddedildi. CSS HTML'i göremez, hangi SVG'nin ortalanacağını bilmez.
   Saf CSS plugin spesifikasyonu kaldıramaz (bkz. brainstorm Key Decisions §1).

3. **CSS variable + class default mode:** Fallback olarak korunuyor,
   default değil. Çünkü kullanıcının `translate` property'siyle çakışır
   (animation, hover scale kıran senaryolar).

4. **viewBox rewrite olmadan, sadece `data-optical-center` attribute:**
   Reddedildi. Attribute tek başına render etkisi yapmaz; ya viewBox
   değişmeli ya CSS variable enjekte edilmeli.

5. **AST transform yerine source-level regex:** Reddedildi. JSX/TSX'in
   syntax karmaşıklığında regex kırılgan ve yanıltıcı (örn. comment
   içindeki `<svg>` match eder).

## System-Wide Impact

### Interaction Graph

Build pipeline'da bir `<svg opticalCenter>` JSX'in seyahati:

1. **Vite `transform` hook** (`.tsx` dosyası için):
   - `@optical-center/vite` Babel'i çağırır.
2. **Babel runs visitors:**
   - `@optical-center/babel` JSXElement'i bulur.
   - Static check, JSX→SVG string serialize.
3. **Cache layer query:**
   - `sha256(svg + version + scale)` hash'i hesaplanır.
   - Cache hit ise sonuç doğrudan kullanılır (hesaplama atlanır).
   - Miss ise pipeline çalışır.
4. **Core engine:**
   - `rasterizeSvg(svg)` → resvg-js native binding → `ImageData`.
   - `getOpticalCenter(imageData)` → DoG, hull, simetri, blend → `{dx, dy}`.
   - `detectClipRisk()` aynı raster'dan bbox çıkarır.
   - `transformViewBox()` yeni viewBox + breadcrumb döndürür.
5. **Cache write:** Sonuç JSON olarak diske yazılır (atomic rename).
6. **Babel AST mutation:** opticalCenter strip, viewBox replace,
   data-* attribute'lar eklenir.
7. **Vite source map adjust:** Babel'in source map'i Vite'ın map zincirine eklenir.
8. **Output:** `dist/assets/...` veya HMR update.

### Error & Failure Propagation

- **Rasterize hatası** (`@resvg/resvg-js` native crash): Babel plugin
  catch eder, warning emit eder, JSX dokunulmadan kalır. Kullanıcı build
  başarısız olmaz.
- **Cache write hatası** (disk full, EACCES): warn + bypass cache,
  hesaplama yine de yapılır.
- **JSX serialization hatası** (unsupported child type): bail-out,
  warning, JSX dokunulmaz.
- **Algorithm version mismatch on cache read:** cache entry ignore
  edilir, recompute.

### State Lifecycle Risks

- Cache yazımı atomic olmalı (`fs.rename`); aksi halde half-written
  JSON dosyası bir sonraki read'de parse hatası verir.
- Hot reload'da SVG asset değişse cache entry orphaned kalabilir;
  `handleHotUpdate` bunu invalidate etmeli.
- Multi-process build (Vite worker pool): cache write race condition;
  hash key dosya kollisyonsuz olduğu için problem değil ama
  `flock`/atomic write yine zorunlu.

### API Surface Parity

Mevcut `optical-center` (single-package) public API:
- `getOpticalCenter()`, `CORRECTION_SCALE`, `OpticalCenterResult`,
  `computeOffsetV2`, `OpticalOffset`, `ComputeOptionsV2`.

Yeni `@optical-center/core` aynısını re-export eder + ekler:
- `rasterizeSvg`, `transformViewBox`, `detectClipRisk`,
  `ALGORITHM_VERSION`.

Eski `optical-center` paketi 0.2.0 olarak yayınlanır, sadece
`@optical-center/core`'u re-export eder. v1.0'da deprecate edilebilir.

### Integration Test Scenarios

1. **React + Vite + 50 inline icon:** build sonrası `dist/assets/*.js`'de
   tüm `viewBox`ların değişmiş olduğunu, hiçbir `opticalCenter` prop'u
   kalmadığını valide et.

2. **Cache warm-up:** ilk build → ikinci build < 1 sn (cache hit).

3. **Algorithm version bump:** core'da version'ı bump et → cache wipe
   → recompute (dosya count'u sıfırlanır, sonra dolar).

4. **HMR:** dev mode'da SVG file edit → hot update sırasında ilgili
   modül re-transform edilir.

5. **Bail-out invariance:** `<svg opticalCenter>{children}</svg>` (dynamic
   children) ile build → warning emit edilir, JSX original olarak
   bundle'a girer.

## Acceptance Criteria

> **NB (ADR-1):** Acceptance Criteria single-package gerçekliğine güncellendi —
> `optical-center` paketi içinde subpath'ler (`/babel`, `/vite`, `/cli`).
> Önceki `@optical-center/*` referansları subpath karşılıklarıyla okunmalı.

### Functional Requirements

- [ ] `optical-center` mevcut `getOpticalCenter()` API'sini bozmadan koruyor.
- [ ] `OpticalCenterResult` `dxPercent`/`dyPercent` ekleniyor (geriye uyumlu).
- [ ] `optical-center` yeni `transformViewBox(svg, raster, offset, opts?)` API'si yukarıdaki formüle göre deterministik çıktı veriyor.
- [ ] `optical-center/node` `rasterizeSvg()` ve `transformViewBoxFromSvg()` convenience'ı export ediyor.
- [ ] Internal `detectClipRiskFromRaster()` raster bbox'ından clipping tahmin ediyor (public değil — `transformViewBox` `clipDetected` döndürüyor).
- [ ] `optical-center/cli` `transform`, `info`, `analyze`, `clear-cache`, `version` komutlarını `--json` ile birlikte sunuyor (CLI Output Contract).
- [ ] `optical-center/babel` `<svg opticalCenter>` pattern'ini yakalıyor, viewBox'ı rewrite ediyor, `data-optical-center` breadcrumb ekliyor.
- [ ] `optical-center/babel` dynamic JSX'te bail-out yapıyor, warning emit ediyor (`OPTICAL_DYNAMIC_SVG`, `OPTICAL_SPREAD_PROPS`).
- [ ] `optical-center/babel` `opticalCenter={false}` durumunda element'e dokunmuyor.
- [ ] `optical-center/babel` two-phase atomicity garantisi: validate-fully-then-mutate (security F6 test fixture'ı yeşil).
- [ ] `optical-center/vite` `enforce: 'pre'` set ediyor, `.tsx`/`.jsx` için Babel transform çalıştırıyor.
- [ ] `optical-center/vite` `*.svg?optical` import'unu `load()` hook'unda rewrite ediyor.
- [ ] `optical-center/vite` `transformIndexHtml({ order: 'post' })` ile HTML'deki `<svg optical-center>`'leri rewrite ediyor.
- [ ] `optical-center/vite` `command === 'serve'` durumunda Babel'e `emitMetadata: true` geçiyor.
- [ ] Tüm warning'ler stable code'lara sahip (Warning Code Registry).
- [ ] CLI `--json` output schemaVersion'lı, exit code semantics dokümante.

### Non-Functional Requirements

- [ ] Cache hit oranı build'lerde > %90 (warm build); L1+L2 toplamı.
- [ ] Cold build performansı: 100 ikon < 5 sn (Phase 2.5 perf pass sonrası rahat marj).
- [ ] Warm build performansı: 100 ikon < 200 ms (L1 cache aktif).
- [ ] Bundle'a runtime hesaplama girmiyor (verify: `dist/`'i grep et, `getOpticalCenter` veya `computeOffset` chunk'ı yok).
- [ ] Output SVG'ler tarayıcıda original SVG'lerle aynı boyutta render ediliyor (shift mode'unda).
- [ ] Build-time memory peak: 100 paralel transform < 100 MB heap.
- [ ] `loadSystemFonts: false` aktif → text-bearing SVG'ler deterministic.
- [ ] Per-file timeout 10s (CLI/Vite orchestration).
- [ ] `maxInputBytes: 5MB` default cap.
- [ ] resvg-js native binding fail → WASM fallback (`@resvg/resvg-wasm`) graceful.

### Quality Gates

- [ ] Test coverage `optical-center` core > %85, adapter subpath'ler > %75.
- [ ] CI: lint + typecheck (strict flags açık) + build + test her PR'da yeşil.
- [ ] CI matrix: ubuntu-x64, ubuntu-arm64, macos, windows.
- [ ] CI: `npm audit signatures` + lockfile-required.
- [ ] Migration guide README'de + 1+ örnek app `examples/`'da çalışıyor.
- [ ] Her subpath için doc section (one-page README OK).
- [ ] tsconfig: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` açık (ADR-10).
- [ ] Pure ESM publish; `engines.node >= 20`; `exports` map'inde `./package.json` export var.
- [ ] `npm publish --provenance` aktif; 2FA mandate publishing account'ta.

## Success Metrics

- **DX:** Yeni kullanıcı `npm i @optical-center/vite` + `vite.config.ts`'e
  3 satır + `<svg opticalCenter>` yazımıyla 5 dakikada çalışan demo
  alabiliyor.
- **Performance:** Mevcut single-package'a göre ek build maliyeti
  100 ikon için < 1 sn (cache cold), < 100 ms (cache warm).
- **Adoption (qualitative):** En az bir public icon library
  (lucide-style) bizim CLI'mızla pre-baked sürüm publish edebiliyor.

## Dependencies & Prerequisites

**External dependencies (yeni eklenenler — research-revised):**

- `@resvg/resvg-js` (~2.6.0, tight pin) — Node SVG rasterization. `optionalDependencies` yoluyla platform binding.
- `@resvg/resvg-wasm` (^2.6.0, optional) — WASM fallback path.
- `@babel/types` (^7.24.0) — AST builder helpers (Babel plugin).
- `@babel/helper-plugin-utils` (^7.24.0) — `declare()`, `assertVersion()`.
- `@babel/core` (^7.0.0) — **peerDependency** (host sağlar; ADR-2).
- `property-information` (^6.0.0) — JSX↔SVG attribute mapping (manuel tablo yerine).
- `parse5` (^7.0.0) — HTML parsing for `transformIndexHtml`.
- `write-file-atomic` (^5.0.0) — atomic cache writes.
- `vitest` (^3.0.0) — test runner (plan'da `^1.0.0` idi; 2 majors yenilemeli).
- `@changesets/cli` — versionlama (single-package'da bile changelog discipline için).

**Node version:** >= 20 (Vite/Vitest tooling gereksinimi; resvg-js Node 14+ destekler).

**Bundler version:** Vite 5+ tested; Vite 6/7 önerilir (`filter` API native filter perf).

## Risk Analysis & Mitigation

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| `@resvg/resvg-js` platform binding sorunu (Linux ARM, Windows) | Düşük | Yüksek | Pre-built binary'ler 8 platformda mevcut; `optionalDependencies` resolution. Alpine (musl) için `--include=optional`. CI matrix: ubuntu (x64+arm64), macos (x64+arm64), windows. `@resvg/resvg-wasm` fallback path (lazy import on native fail). |
| viewBox shift'le clipping kullanıcının fark etmediği bir hata olur | Orta | Orta | `OPTICAL_CLIP_DETECTED` warning emit (default), `--strict` ile build error. v0.3+'ta `paddingMode: 'pad'` opsiyonel. |
| Babel plugin static analysis kaçışı (örn. spread props gizliyor) | Yüksek | Düşük | Bail-out konservatif; `JSXSpreadAttribute` görür görmez early bail (security F6). `<svg {...{opticalCenter:true}}>` test fixture'ı. |
| Cache corruption / poisoning | Düşük | Orta | `write-file-atomic` paketi; entry validation on read (key match check); raw-bytes hash (no normalization, security F3). |
| Cache write race (multi-process) | Düşük | Düşük | Vite single-process default; multi-process build advisory `proper-lockfile` peer. Duplicate compute idempotent (deterministic). |
| Algorithm version bump cache invalidation unutma | Düşük | Düşük | Version `src/` SHA fingerprint'inden auto. Manuel constant yok → unutma fail-mode'u eliminated. |
| SVG-DoS via malicious input (build hang / memory) | Düşük | Yüksek | `maxInputBytes: 5MB` pre-parse cap. `rasterSize` clamp [16, 512]. Per-file timeout 10s. resvg-js'in usvg defenses (1M element cap, 1024 nesting). |
| Cache key collision (normalization-based) | Yok artık | Yok | Normalization stratejisi kaldırıldı (security F3). Raw bytes hash. |
| Supply-chain compromise (resvg native, Babel chain) | Düşük | Yüksek | `npm publish --provenance` (Sigstore), 2FA mandate, `npm audit signatures` CI step, lockfile-required, no postinstall in our packages, `~2.6.0` tight pin on resvg-js. |
| `loadSystemFonts: true` non-determinism (text in SVG) | Yok artık | Yok | Default `false` set (security F1). Font support v0.3+ explicit `fontFiles` opt-in (cache key'e hashleme). |
| Vite/Webpack/Rollup plugin lifecycle farkları | Düşük | Orta | İlk MVP sadece Vite. Vite plugin Rollup-compatible — Rollup'a geçişin %80'i bedava. SWC/Vue/Svelte v0.3+. |
| Babel `@preset-react`'tan sonra çalışma riski | Düşük | Yüksek | Babel: plugins-before-presets garantili. Vite: `enforce: 'pre'` (ADR-3). Test fixture: preset-react config'iyle birlikte transform. |
| `process.env.NODE_ENV` autoderive prod-leak | Yok artık | Düşük | `metadata` default `false`; Vite plugin `command === 'serve'` görüp explicit opt-in (security F7). |

## Future Considerations

ADR-1 ile MVP single-package (`optical-center`); ikinci/üçüncü dalga ya yeni paket ya da subpath olarak gelir.

**v0.3+ — framework adapter'ları + agent-native:**

- `optical-center/swc` veya `@optical-center/swc-plugin` — Next.js'in default JSX transform'u.
- `optical-center/postcss` — `optical-center: auto` declaration handler. **NB:** PostCSS Mode B tek başına fonksiyonel değil, mutlaka HTML/JSX inspector ile pair olur (architecture-strategist). Plugin install'da peer kontrolü yapılır.
- `optical-center/tailwind` — utility class kaydedicisi (PostCSS plugin üstünde 50 satır wrapper).
- `optical-center/vue` — Vue SFC compiler hook.
- `optical-center/svelte` — Svelte preprocessor.
- `optical-center/astro` — Astro integration.
- `optical-center/webpack` — webpack loader.
- `optical-center/rollup` — rollup plugin.
- **`optical-center/mcp`** (yeni — agent-native-reviewer önerisi). MCP server, stdio transport. Tools:
  - `compute_offset(svg) → { dxPercent, dyPercent, algorithmVersion }`
  - `transform_svg(svg, options?) → { svg, viewBox, breadcrumb, clipDetected }`
  - `analyze_icon_set(folder) → { count, withWarnings, byWarningCode, avgOffsetMagnitude }`
  - `info(svg) → { offset, viewBox, clipDetected, pathBbox }`

**v0.4+ — shared utility paketleri** (architecture-strategist Mimari drift önerisi):

Tema-bazlı, `@optical-center/utils` "kitchen sink" değil:
- `@optical-center/serialize` — AST-agnostic intermediate node + SVG serializer (Babel/Vue/Svelte/SWC ortak tüketir; duplikasyon önler).
- `@optical-center/cache` — file-system + L1 cache infrastructure.
- `@optical-center/diag` — diagnostic types (warning code registry, severity, context).
- `@optical-center/viewbox` — viewBox string parser/serializer.

**v1.0+ — icon library adapter'ları:**

- `@optical-center/lucide` — pre-baked lucide. Versiyon dist-tag stratejisi: `@optical-center/lucide@1.0.0-lucide-0.300` (lucide upstream version pinned).
- `@optical-center/heroicons`
- `@optical-center/phosphor`
- `@optical-center/tabler`

Bu adapter'lar build sırasında ilgili kütüphanenin SVG'lerini tarar,
viewBox'ı rewrite edilmiş bir aynısını publish eder. Kullanıcı sadece
`import { Play } from '@optical-center/lucide'` yapar, hiçbir build
config'i gerekmez.

## Documentation Plan

- **Root README.md:** Yeni mimari özeti, paket harita, hızlı başlangıç,
  migration notu.
- **packages/core/README.md:** Mevcut README + yeni `transformViewBox`
  API'si.
- **packages/cli/README.md:** Komut listesi, kullanım örnekleri.
- **packages/babel/README.md:** Babel config örneği, plugin options,
  bail-out davranışı.
- **packages/vite/README.md:** vite.config.ts örneği, plugin options,
  HMR davranışı.
- **examples/react-vite/README.md:** Çalıştırma talimatları.
- **examples/vanilla-html/README.md:** CLI tabanlı kullanım.
- **docs/migration-0.1-to-0.2.md:** Mevcut kullanıcılar için detaylı
  migration rehberi.

## Resolved Decisions (formerly Open Questions)

Brainstorm'dan ve research raporlarından gelen 7 sorunun hepsi karara bağlandı:

1. **Eski `optical-center` paketi:** Re-export shim YOK. Paket `init` commit'i, gerçek kullanıcı yok. ADR-1 ile single-package devam ediyoruz → paket adı `optical-center` korunur, doğrudan v0.2.0 yayınlanır. v0.1.x npm'de `deprecated` mesajıyla pinlenir.
2. **`paddingMode` default:** Sadece `'shift'`. `'pad'` ve `'skip'` MVP'den çıkarıldı (ADR-5). Clipping algılanırsa `OPTICAL_CLIP_DETECTED` warning emit edilir.
3. **Algorithm version kaynağı:** Build-time'da `src/` (single-package) veya `packages/core/src/` (multi-package) dizininin sha256 fingerprint'i. Manuel constant unutma riskini sıfırlar; sadece pipeline kodu değişince invalidate olur.
4. **Cache lokasyonu:** `node_modules/.cache/optical-center/<algorithmVersion>/`. Version path'e gömülü → manifest.json gereksiz, eski version dizinleri garbage olarak bırakılır.
5. **`<use href>` sprite:** MVP dışı. v0.3+'a `@optical-center/sprite` (veya subpath) olarak gelir.
6. **Source map:** Babel `transformAsync({ sourceMaps: true, inputSourceMap, babelrc: false, configFile: false })` ile çağrılır. Vite plugin zincirler. Phase 5 acceptance criterion: "5+ fixture'da source map line:column accuracy regression test'i yeşil."
7. **TS JSX augmentation:** `optical-center/babel` (subpath) ship eder: `jsx-react.d.ts` (`declare module 'react'` ile `SVGAttributes<T>` augment), `jsx-preact.d.ts`, `jsx-solid.d.ts` ileride. Kullanıcı `tsconfig.json`'a `"types": ["optical-center/babel/jsx-react"]` ekler. `'auto'` literal narrowing default.

## Architectural Decision Log

Bu ADR'lar deepening sırasında alınan kararları sabitler. Her biri bir veya birden fazla research agent bulgusundan türev.

### ADR-1: Single-package MVP, multi-package deferred to v0.3+
- **Status:** Accepted
- **Context:** Plan başlangıçta 4 MVP paket önerdi. Code-simplicity + architecture reviewer'lar paket sayısının kullanıcı yokluğunda over-engineering olduğunu işaret etti. Git log: tek commit `init`.
- **Decision:** v0.2.0 tek paket — `optical-center`. Subpath exports:
  - `optical-center` → core (browser-safe, mevcut motor)
  - `optical-center/node` → `rasterizeSvg`, `transformViewBox` (resvg-js dep, Node-only)
  - `optical-center/cli` → CLI library
  - `optical-center/babel` → Babel plugin (default export)
  - `optical-center/vite` → Vite plugin (default export)
- **Rationale:** Adoption gözleminden sonra çatallandığında bölmek ucuz. Şimdi `workspace:*` gotcha'ları, changesets coordination, per-package READMEs, cross-package version skew yükleri sıfır kullanıcı için ödeniyor.
- **Trigger to revisit:** Bir adapter (ör. Vue) gelince paketler ayrılır. Tek paket içinde 7+ subpath gerekirse yine ayrılır.
- **Source:** code-simplicity-reviewer, architecture-strategist, simplify

### ADR-2: Babel deps minimal — only `@babel/types` + peer `@babel/core`
- **Status:** Accepted
- **Context:** Plan 4 babel paketi listeledi (`@babel/core`, `@babel/parser`, `@babel/traverse`, `@babel/types`). Best-practices-researcher ve framework-docs-researcher Babel plugin authoring convention'ını doğruladı.
- **Decision:** `optical-center/babel` package.json:
  - `dependencies`: `{ "@babel/types": "^7.24.0", "@babel/helper-plugin-utils": "^7.24.0" }`
  - `peerDependencies`: `{ "@babel/core": "^7.0.0" }`
  - `peerDependenciesMeta.optional`: `false` (host MUST provide)
- **Rationale:** `@babel/parser` ve `@babel/traverse` host (Vite/Webpack/Next) tarafından sağlanır; ayrı dep duplicate install + version skew yaratır.
- **Source:** best-practices-researcher

### ADR-3: Vite plugin `enforce: 'pre'` zorunlu
- **Status:** Accepted
- **Context:** Plan plugin order belirtmemiş. Vite'ın esbuild JSX transform'u default olarak user plugin'lerden önce çalışırsa AST'imiz `JSXElement` görmez (CallExpression görür).
- **Decision:** Plugin objesi:
  ```ts
  return {
    name: 'optical-center',
    enforce: 'pre',
    apply: undefined, // both serve and build
    load: { filter: { id: /\.svg(\?optical)?$/ }, handler },
    transform: { filter: { id: /\.[jt]sx$/ }, handler },
    transformIndexHtml: { order: 'post', handler },
    handleHotUpdate, buildStart
  };
  ```
- **Rationale:** `enforce: 'pre'` user plugin'leri Vite core'dan önce koşturur. Vite 6.3+ `filter` API perf için (eski Vite'ta sessizce ignore).
- **Source:** best-practices-researcher, framework-docs-researcher

### ADR-4: `?optical` SVG asset transform → `load()` hook, not `transform()`
- **Status:** Accepted
- **Context:** Plan `transform(code, id)` içinde `*.svg?optical` handle ediyordu. Best-practices-researcher Vite asset pipeline conventions'ını (vite-plugin-svgr pattern) doğruladı.
- **Decision:**
  - `load(id)`: id `?optical` query'siyle bitiyorsa `fs.readFile` + `transformViewBox` + return new SVG.
  - `transform(code, id)`: sadece `.jsx`/`.tsx` için Babel.
- **Rationale:** `transform` JS-modül için, `load` raw asset için. Vite default SVG loader'ıyla çakışmaz.

### ADR-5: `paddingMode` MVP'de sadece `'shift'`
- **Status:** Accepted
- **Context:** Plan tri-state mode (`'shift' | 'pad' | 'skip'`) sundu. Kendisi (line 750-751) Lucide-class ikonlarda padding olduğunu kabul ediyor. Code-simplicity + simplify YAGNI flag'ledi.
- **Decision:** `transformViewBox()` opsiyonel `paddingMode` almaz; her zaman shift. Result'ta `clipDetected: boolean`. `'pad'` v0.3+'ta gerçek kullanıcı talebiyle gelir. `'skip'` davranışı kullanıcı kendisinin yapacağı şey (warning'i görüp `data-optical-center` class'ı atmaz).
- **Source:** code-simplicity-reviewer, simplify

### ADR-6: Core browser-safe; resvg-js subpath/separate package'da
- **Status:** Accepted
- **Context:** Mevcut `getOpticalCenter()` saf hesap (RGBA → offset). resvg-js native binding eklemek core'u Node-only yapar. Architecture-strategist core'un browser-safe kalması gerektiğini argümanladı (Storybook preview, edge runtime).
- **Decision:**
  - `optical-center` (default subpath) → mevcut motor + saf TS yardımcılar (`detectClipRiskFromRaster` saf bbox helper). Browser-safe, zero native dep.
  - `optical-center/node` → `rasterizeSvg`, `transformViewBox` (composes core + native). resvg-js dep burada.
  - `package.json`'da:
    ```json
    "exports": {
      ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "./node": { "types": "./dist/node.d.ts", "default": "./dist/node.js" },
      "./babel": "./dist/babel/index.js",
      "./vite": "./dist/vite/index.js",
      "./cli": "./dist/cli/index.js",
      "./package.json": "./package.json"
    }
    ```
  - resvg-js `optionalDependencies` (platform binding'leri); core kullanıcısı install etmek zorunda değil.
- **Source:** architecture-strategist

### ADR-7: Cache: sha256 + flat (1k threshold) + `write-file-atomic` + version path
- **Status:** Accepted
- **Context:** Plan sha256 + 256-way sharding + manifest.json + atomic rename önerdi. Code-simplicity ve simplify "manifest gereksiz, sharding 100 dosya için overkill"; security F3 "normalization collision riskli"; best-practices "write-file-atomic kullan".
- **Decision:**
  - **Hash:** `sha256(svgRawBytes + paddingMode + ALGORITHM_VERSION)`. **Normalization YOK** (security F3). Native crypto, zero dep.
  - **Layout:** `node_modules/.cache/optical-center/<algorithmVersion>/<hash>.json`. Flat dizin. ≥1000 entry'e gelince 2-char shard'a otomatik geçiş (config flag, default trigger).
  - **Write:** `write-file-atomic` paketi (~20 KB, npm CLI'in kullandığı).
  - **Validation on read:** Cache entry parse edildikten sonra `entry.input.hash === lookupKey` doğrulanır → poisoning'e karşı cheap O(1) defense (security F4).
  - **L1 in-memory `Map<hash, result>` cache + LRU 1000 entry cap** (perf: aynı SVG'nin tekrarlanan transform'ları için ~1000× hızlanma).
  - **Request coalescing:** `inflight: Map<hash, Promise<Result>>` → aynı SVG paralel transform'da tek pipeline koşar.
- **Manifest YOK** — version path'e gömülü, eski version dizinleri orphaned (manuel `clear-cache` veya GC).
- **Source:** code-simplicity, simplify, security-sentinel, performance-oracle, best-practices

### ADR-8: Engine performance pass — Phase 2.5
- **Status:** Accepted
- **Context:** Performance-oracle mevcut motoru analiz etti: `computeSymmetryAxis` 14.4K × 36 angles ≈ pipeline'ın %50-60'ı. Plan 10-50 ms/icon hedefi *just* tutuyor; optimization rahat marja çıkarır.
- **Decision:** Phase 2 ile Phase 3 arasına Phase 2.5 ekle. Şu optimizasyonlar:
  - `computeSymmetryAxis` `numAngles: 36 → 12` (golden test: dxPercent değişimi < 0.05% — kullanıcı görmez). **~15 ms/icon kazanç.**
  - `applyPowerCompression` `Math.pow` → 256-entry LUT. **~1.5 ms/icon.**
  - `Float32Array` pool (`gaussianBlur` 4 alloc → 2 reuse). **~2 ms GC overhead eliminasyon.**
  - Radial pre-check (radial > 0.85 ise axis bypass). **~10 ms/icon avg.**
  - Stale TODO yorumları `symmetry.ts:62, 125, 300` sil (bug-magnet — pattern-recognition flagged).
  - Duplicate `computeOffsetFromWeightMap` (compute-offset.ts:194) `computeOffset` içine refactor → ~60 satır dedupe.
- **Net beklenen:** 50 ms baseline → 20-25 ms/icon (2× pipeline hızı, plan iddialarını rahat marja taşır).
- **Source:** performance-oracle, pattern-recognition

### ADR-9: CLI Output Contract (agent-native)
- **Status:** Accepted
- **Context:** Agent-native-reviewer 8/22 score verdi. CLI çıktıları human-only, `--json`, exit codes, stdout/stderr policy yok. Plan implicit free-form text varsayıyordu.
- **Decision:** Yeni "CLI Output Contract" bölümü (aşağıda). Tüm komutlar `--json` flag'i destekler. Exit code semantik. Stdout/stderr ayrımı.
- **Source:** agent-native-reviewer

### ADR-10: TypeScript hardening (strict flags + project references + verbatimModuleSyntax)
- **Status:** Accepted
- **Context:** Kieran-typescript-reviewer mevcut tsconfig'in eksiklerini detaylı listeledi.
- **Decision:** Phase 1'in başında (ya da Phase 0 olarak ayrılarak) bu flag'ler açılır:
  ```jsonc
  // tsconfig.base.json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "noImplicitOverride": true,
      "noPropertyAccessFromIndexSignature": true,
      "noFallthroughCasesInSwitch": true,
      "verbatimModuleSyntax": true,
      "isolatedModules": true,
      "moduleResolution": "NodeNext",
      "module": "NodeNext",
      "target": "ES2022",
      "composite": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "stripInternal": true
    }
  }
  ```
  - Mevcut `src/` üstünde flag'leri açıp hataları düzelt — paket bölmeden ÖNCE.
  - Multi-package'a geçince TS project references kur (tsconfig per package + root references).
  - Lint: `@typescript-eslint/consistent-type-imports`.
- **Source:** kieran-typescript-reviewer

## CLI Output Contract

Tüm CLI komutları aşağıdaki contract'a uyar:

### Streams
- **stdout:** sadece data (formatted output veya JSON). `--silent`'ta hiçbir şey yazılmaz.
- **stderr:** sadece log/progress/warning. `--quiet` warning'i suppress, `--silent` hepsini suppress.
- **TTY awareness:** `process.stdout.isTTY === false` ise progress bar kapatılır otomatik.

### Exit codes
- `0` — success
- `1` — success with warnings (clipping, derived viewBox)
- `2` — recoverable error (en az bir dosya bail-out)
- `3` — fatal error (config invalid, native binding fail, IO permission)

`--strict` flag'i `1`'i `2`'ye terfi ettirir (CI'da fail-on-warning).

### Format flags
- `--json` → stdout = NDJSON (her dosya / sonuç bir satır JSON). Schema versionlu.
- `--format=table|json|yaml` (info/analyze) — daha zengin output formatları.
- `--log-format=text|json` (stderr için NDJSON log mode).
- `--no-cache` — cache bypass (debug).
- `--cache-dir <path>` — cache dizini override (path traversal validate edilir).

### Schema-versioned JSON
```json
{ "schemaVersion": 1, "command": "info", "result": { ... },
  "version": { "package": "0.2.0", "algorithm": "1.0.0-...", "schema": 1 } }
```

`schemaVersion` artırıldığında consumer'lar uyumsuzluğu yakalar.

### Komut listesi (MVP)
- `optical-center transform <input> [output] [--json] [--strict] [--no-cache]` — klasör → klasör
- `optical-center info <svg> [--json] [--format=table|json|yaml]` — tek SVG raporu
- `optical-center analyze <folder> [--json]` — klasör için aggregate rapor (count, avg offset, clip count, max offset file)
- `optical-center clear-cache [--all] [--json]` — cache temizliği
- `optical-center version [--json]` — versiyon bilgisi (package + algorithm + schema)
- `optical-center --help`, `optical-center help <command> [--json]` — discovery

`info` ve `clear-cache` artık MVP'de (agent-native parity için, simplify'ın "kes" önerisi reddedildi). `analyze` yeni komut (folder report — agent için critical).

## Warning Code Registry

Tüm bail-out ve warning'ler stable koda sahip. JSON output'ta `{ code, severity, message, location? }` shape'i.

| Code | Severity | Trigger | Action |
|------|----------|---------|--------|
| `OPTICAL_DYNAMIC_SVG` | warn | JSX child/viewBox dynamic expression | Bail-out, JSX dokunulmaz |
| `OPTICAL_SPREAD_PROPS` | warn | `<svg {...rest}>` görüldü | Bail-out (gizli opticalCenter olabilir) |
| `OPTICAL_MISSING_VIEWBOX` | warn | viewBox yok ve width/height de yok | Bail-out |
| `OPTICAL_VIEWBOX_DERIVED` | info | viewBox yoktu, width/height'tan derive edildi | Continue |
| `OPTICAL_CLIP_DETECTED` | warn | viewBox shift path'i kırpabilir | Continue (default), `--strict`'te error |
| `OPTICAL_RASTERIZE_FAILED` | error | resvg-js exception | Bail-out |
| `OPTICAL_CACHE_WRITE_FAIL` | warn | Cache yazılamadı (disk full, EACCES) | Continue (compute yine yapıldı) |
| `OPTICAL_VERSION_MISMATCH` | info | Cached entry'nin algorithm version'ı farklı | Discard, recompute |
| `OPTICAL_INPUT_TOO_LARGE` | error | SVG > maxInputBytes | Bail-out |
| `OPTICAL_TIMEOUT` | error | Per-file timeout aşıldı | Bail-out |

Programmatic API: `import { WARNINGS } from 'optical-center'` — code → tanım mapping. Adapter (Babel/Vite/CLI) merkezi `emitWarning(code, ctx)` helper'ı kullanır → consistent format.

## Build-Time Limits & Security Hardening

Security-sentinel raporundan türev. Defense in depth.

### Resource limits (core seviyesinde, caller bypass edemez)
- `maxInputBytes`: **5 MB** (default). Pre-parse check.
- `maxRasterSize`: **512** (clamp). `rasterSize` çağıranın verdiği değil, `RASTER_SIZE = 120` constant; clamp güvenlik için.
- Per-file timeout: **10 saniye** (CLI/Vite orchestration, Promise.race).
- `loadSystemFonts: false` resvg-js default'u. Determinism + perf + privacy (security F1).
- **No font directories scanned.** Eğer text rendering ileride gerekirse `fontFiles: string[]` opt-in (hash'leri cache key'e eklenir).

### SVG output sanitization (HTML/asset transform path)
- Default olarak `on*` event handler attribute'ları strip edilir.
- `<script>` element'leri strip edilir.
- `<foreignObject>` strip edilir (HTML execution surface).
- Opt-out: `stripScripts: false` (deliberate use case için).
- **Babel/JSX path bunu otomatik yapmaz** — React zaten render etmez, gerek yok.

### Path validation (CLI)
- `input` ve `output` path'leri `path.resolve()` ile absolute'a çevrilir.
- Default'ta cwd dışına yazılma reddedilir; `--allow-outside-cwd` ile açılır.
- Symlink follow yapılmaz (`fs.lstat`).
- `output` boş değilse `--force` zorunlu.
- `cacheDir` `node_modules/` dışına çıkamaz; `allowExternalCache: true` ile açılır.

### Supply chain policy
- Tüm `optical-center/*` paket yayınları **`npm publish --provenance`** ile (Sigstore attestation, GitHub Actions `id-token: write`).
- npm publish hesabında **2FA mandate**.
- CI'da **`npm audit signatures`** zorunlu.
- **No postinstall scripts** in any package we ship.
- `@resvg/resvg-js` pinned `~2.6.0` (tight range), bump'lar manual review.
- `@babel/*` peer dep (host sağlar), version range loose ama compat-asserted (`api.assertVersion(7)`).

### Babel plugin atomicity (security F6)
- Visitor logic strict iki fazlı:
  1. **Read-only validation** (bail-out check, JSX serialize, cache lookup, raster, transform). Saf, throw edebilir, AST hiç dokunulmaz.
  2. **Commit phase** — sadece (1) başarılıysa: opticalCenter strip + viewBox replace + data-* ekle.
- `JSXSpreadAttribute` görür görmez **early bail** (gizli `opticalCenter` saldırı vektörü yok).
- Plugin re-entry guard: `node._opticalProcessed = true` flag.
- Native crash isolation: resvg-js çağrısı try/catch + warning emit. Segfault edge case → process crash, kullanıcıya bildirilen "binding incompatible" hatası.

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-05-03-optical-center-drop-in-brainstorm.md](../brainstorms/2026-05-03-optical-center-drop-in-brainstorm.md)

  Carried-forward decisions:
  - **Default mode = viewBox rewrite + breadcrumb** (CSS dünyasıyla
    çakışmaz, DevTools'ta görünür).
  - **CSS variable mode = opt-in fallback** (sprite/dış SVG için).
  - **API yüzeyi declarative, parametresiz** (`auto`/presence-based).
  - **İki taraflı mimari** (Content Inspector + Çekirdek motor).
  - **MVP scope: core + cli + babel + vite**.

### Internal References

- Mevcut motor: `src/final-model.ts:39` — `getOpticalCenter()` entry.
- V2 pipeline: `src/compute-offset.ts:289` — `computeOffsetV2()`.
- Mevcut public API: `src/index.ts:1`.
- Pipeline doc: `PROJE_OZETI.md` (Türkçe, mimari özet).

### External References

**Babel & AST tooling:**
- Babel Plugin Handbook — https://github.com/jamiebuilds/babel-handbook
- `@babel/types` reference — https://babeljs.io/docs/babel-types
- `@babel/helper-plugin-utils` (`declare`) — https://babeljs.io/docs/babel-helper-plugin-utils
- `airbnb/babel-plugin-inline-react-svg` — https://github.com/airbnb/babel-plugin-inline-react-svg (visitor pattern reference)
- `svgr/babel-plugin-transform-svg-component` — https://github.com/gregberge/svgr/tree/main/packages/babel-plugin-transform-svg-component
- `wooorm/property-information` — https://github.com/wooorm/property-information (JSX↔SVG attribute mapping)

**Vite plugin authoring:**
- Vite Plugin API — https://vite.dev/guide/api-plugin
- Vite 6 Migration — https://v6.vite.dev/guide/migration
- Vite 5/6 plugin order discussion — https://github.com/vitejs/vite/discussions/1815
- `vite-plugin-svgr` source — https://github.com/pd4d10/vite-plugin-svgr
- `@vitejs/plugin-react` source — https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react

**Monorepo & packaging:**
- pnpm Workspaces — https://pnpm.io/workspaces
- npm Workspaces — https://docs.npmjs.com/cli/v10/using-npm/workspaces
- Complete Monorepo Guide (pnpm + Changesets, 2025) — https://jsdev.space/complete-monorepo-guide/
- Monorepo Tools 2026 Comparison — https://viadreams.cc/en/blog/monorepo-tools-2026/
- ESM-only vs Dual Package Migration 2026 — https://www.pkgpulse.com/guides/great-migration-cjs-to-esm-npm-ecosystem-2026
- TypeScript Project References (Nx) — https://nx.dev/blog/managing-ts-packages-in-monorepos
- TypeScript ESM/CJS in 2025 — https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing
- Changesets — https://github.com/changesets/changesets
- Changesets Config Options — https://github.com/changesets/changesets/blob/main/docs/config-file-options.md
- Changesets Prereleases — https://github.com/changesets/changesets/blob/main/docs/prereleases.md
- Changesets GitHub Action — https://github.com/changesets/action

**Cache & hashing:**
- xxHash homepage — https://xxhash.com/
- SHA-256 Alternatives Speed (2025) — https://devtoolspro.org/articles/sha256-alternatives-faster-hash-functions-2025/
- `npm/write-file-atomic` — https://github.com/npm/write-file-atomic
- Turborepo Caching docs — https://turbo.build/repo/docs/core-concepts/caching
- `hash-wasm` — https://github.com/Daninet/hash-wasm

**SVG rasterization:**
- `@resvg/resvg-js` — https://github.com/thx/resvg-js (NB: org `thx`, not `yisibl`)
- resvg-js Releases — https://github.com/thx/resvg-js/releases
- sharp vs resvg-js benchmark — https://github.com/privatenumber/sharp-vs-resvgjs
- resvg-js performance issue #145 — https://github.com/thx/resvg-js/issues/145
- resvg-js Vite 4 .node loader Issue #175 — https://github.com/thx/resvg-js/issues/175

**Testing:**
- Vitest — https://vitest.dev/
- Vitest 3 Workspace/Projects — https://vitest.dev/guide/workspace
- Vitest Snapshot — https://vitest.dev/guide/snapshot

**Security & supply chain:**
- npm Provenance (`--provenance`) — https://docs.npmjs.com/generating-provenance-statements
- Sigstore for npm — https://blog.sigstore.dev/npm-provenance/
- usvg / resvg defenses — https://github.com/RazrFalcon/resvg
- Node 22 ESM `require` support — https://blog.arcjet.com/nodejs-22-support-esm-require-for-nestjs/

**Agent-native:**
- Model Context Protocol — https://modelcontextprotocol.io/
- MCP TypeScript SDK — https://github.com/modelcontextprotocol/typescript-sdk

### Deepening Agent Reports

Bu plan'ın deepening sırasında 9 agent çalıştı. Raporlar context'te (in-conversation) tutuldu, dosyaya commit edilmedi (boyut). Reference için agent listesi:

- best-practices-researcher — Babel/Vite/monorepo/cache/AST patterns 2024-2026
- framework-docs-researcher — resvg-js / Vite / Babel / changesets / vitest official docs
- kieran-typescript-reviewer — TS API contract + existing src/ TS quality
- code-simplicity-reviewer — YAGNI lens, scope cuts
- architecture-strategist — pattern compliance, layering, alternatives
- pattern-recognition-specialist — naming, conventions, duplication, anti-patterns
- performance-oracle — pipeline op count, cache perf, build-time projeksiyonları
- security-sentinel — DoS, supply chain, AST safety, output sanitization
- agent-native-reviewer — CLI/MCP parity scoring (8/22 → revised)
- simplify (skill) — 3-lens review (reuse, quality, efficiency)

### Related Work

- README.md — kullanım örnekleri.
- PROJE_OZETI.md — algoritma derin teknik özeti (Türkçe).
- src/symmetry.ts:62, 125, 300 — stale TODOs (Phase 0 hijyen kapsamında silinecek).
- src/compute-offset.ts:194 — `computeOffsetFromWeightMap` duplikasyonu (Phase 2.5'te dedupe).
