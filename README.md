# optical-center

Computes the **perceptual optical center** of an icon — the position where the icon should be rendered to appear visually centered inside a container, rather than geometrically centered.

## What this is

A TypeScript implementation of a biologically-inspired optical centering model, validated against human perceptual judgments (N=30 participants, 2AFC study, PSE = 0.745).

The model is `V2_pipeline × 0.745`:

- **V2 pipeline** — a multi-stage perceptual model (DoG edge detection, convex hull centroid, bilateral symmetry analysis, mass centroid blending, vertical perceptual bias)
- **× 0.745** — global correction scale derived from Phase 2 2AFC user study (humans prefer 74.5% of the V2 raw correction)

## API

```typescript
import { getOpticalCenter } from 'optical-center';

const offset = getOpticalCenter(imageData);
// { dx: number, dy: number } — in raster pixels
```

### Input

`imageData`: a standard rasterized icon buffer.

```typescript
{
  data: Uint8ClampedArray,   // RGBA pixels
  width: number,              // typically 120 (the raster size the model was validated at)
  height: number
}
```

You can produce this from an SVG using [`@resvg/resvg-js`](https://www.npmjs.com/package/@resvg/resvg-js) (Node) or `OffscreenCanvas` / `ImageData` (browser).

### Output

```typescript
{
  dx: number,  // horizontal offset in raster pixels, positive = shift right
  dy: number   // vertical offset in raster pixels, positive = shift down
}
```

To apply in CSS, scale to your display size:

```typescript
const displayScale = displaySize / 120; // if display icon is 80px, scale = 0.667
element.style.transform = `translate(${offset.dx * displayScale}px, ${offset.dy * displayScale}px)`;
```

## Example

```typescript
import { getOpticalCenter } from 'optical-center';
import { Resvg } from '@resvg/resvg-js';

const svg = await fetch('./icons/play.svg').then((r) => r.text());
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 120 } });
const rendered = resvg.render();

const offset = getOpticalCenter({
  data: new Uint8ClampedArray(rendered.pixels),
  width: rendered.width,
  height: rendered.height,
});

console.log(offset); // e.g. { dx: 2.1, dy: 1.3 }
```

## File structure

```
src/
├── index.ts           Public API
├── final-model.ts     getOpticalCenter() — main entry point
├── compute-offset.ts  V2 pipeline core
├── analyzer.ts        Weight map + weighted centroid
├── preprocessing.ts   DoG + power compression (retinal + V1 inspired)
├── convex-hull.ts     Andrew's monotone chain + hull centroid
├── perceptual.ts      Vertical bias, shape correction, blending
└── symmetry.ts        Bilateral + radial symmetry analysis
```

## Build

```bash
npm install
npm run build
```

Output goes to `dist/`.

## Performance note

This model runs a full image-processing pipeline per icon (DoG convolution, hull extraction, symmetry analysis). Expect **~10–50ms per icon** depending on image size. For production usage it's recommended to **pre-compute offsets at build time** (e.g. via a build plugin or CLI script) and ship a JSON lookup to the browser.

## Background

- **Phase 1** (N=36, method of adjustment): validated the V2 pipeline against human icon placement. RMSE = 2.99 px, r = 0.585.
- **Phase 2** (N=30, 2AFC forced choice): extracted the pooled PSE = 0.745 — the proportion of V2 correction humans prefer.
- **Phase 3** (N=46, adjustment fine-tune): per-icon validation and methodological characterization of adjustment-task central-tendency bias (~0.30 attenuation, consistent with Jewell & McCourt 2000).

The final model shipped here is the Phase 2 output: `V2 × 0.745`, applicable to any icon.
