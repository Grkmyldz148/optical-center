# optical-center

A drop-in toolkit that **bakes perceptual centering into your SVG icons at build time**. You write `<svg opticalCenter>` (JSX), `<svg optical-center>` (HTML), or `import play from './play.svg?optical'` (Vite asset). Every adapter resolves the marker, runs a biologically-inspired centering pipeline once, and rewrites the icon's `viewBox` so the browser sees a flat, pre-computed SVG. Zero runtime cost.

> Geometric center ≠ visual center. A play triangle (▶) placed at the geometric midpoint looks pulled to the left — its visual mass sits on the right. This package finds where the eye actually wants the icon, and shifts the SVG window to put it there.

## What's inside (one package, several entry points)

| Subpath | Use it for |
|---|---|
| `optical-center` | Browser-safe core. `getOpticalCenter()`, `transformViewBox()`, `applyTransformToSvg()`, types. |
| `optical-center/node` | Node-only convenience: `rasterizeSvg()`, `transformViewBoxFromSvg()` (SVG string → result). |
| `optical-center/cli` | The `optical-center` binary: `transform`, `info`, `analyze`, `clear-cache`, `version`. |
| `optical-center/babel` | Babel plugin. Transforms `<svg opticalCenter>` JSX. |
| `optical-center/vite` | Vite plugin. Orchestrates Babel + `?optical` asset transform + HTML scan. |

The model itself is `V2 × 0.745` — a DoG + convex hull + symmetry pipeline (Phase 1, N=36, method of adjustment) globally scaled by the Phase 2 pooled PSE (N=30, 2AFC).

## Quick start — Vite + React

```bash
npm install optical-center
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import opticalCenter from 'optical-center/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [opticalCenter(), react()],
});
```

```tsx
// PlayButton.tsx
export function PlayButton() {
  return (
    <button>
      <svg opticalCenter viewBox="0 0 24 24" width="24" height="24">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  );
}
```

After build the JSX above ships as:

```jsx
<svg viewBox="-0.3239 -0.6226 24 24" data-optical-center="" width="24" height="24">
  <path d="M8 5v14l11-7z" />
</svg>
```

No `opticalCenter` prop, no runtime computation, no CSS to maintain.

## Quick start — vanilla HTML

```html
<svg optical-center viewBox="0 0 24 24" width="24" height="24">
  <path d="M8 5v14l11-7z" />
</svg>
```

The same Vite plugin transforms this when it runs `transformIndexHtml`. Outside Vite, the CLI does the same job:

```bash
npx optical-center transform ./icons/raw ./icons/centered
```

## Quick start — asset import

```ts
// SVG file on disk, opted in at the import site:
import play from './play.svg?optical';
// `play` is a string — the rewritten SVG, ready to inject as innerHTML.
```

## CLI (everything is `--json`-able)

```bash
npx optical-center transform <input> [output]   # folder → folder
npx optical-center info <svg>                   # one file, full breakdown
npx optical-center analyze <folder>             # aggregate report, top-N
npx optical-center clear-cache [--all]
npx optical-center version
```

Output streams stay clean: stdout = data only, stderr = progress + warnings, exit codes follow the contract (0 success / 1 success+warnings / 2 recoverable error / 3 fatal). `--strict` promotes warnings to a non-zero exit so CI fails on clip detection.

```bash
$ optical-center info ./icons/play.svg --json
{"schemaVersion":1,"command":"info","result":{"file":".../play.svg","originalViewBox":{"x":0,"y":0,"w":24,"h":24,"source":"attribute"},"newViewBox":"-0.3239 -0.6226 24 24","offset":{"dxPercent":1.3497,"dyPercent":2.5944,"dx":1.62,"dy":3.11},"clipDetected":false,"breadcrumb":{"data-optical-center":"","data-optical-original-viewbox":"0 0 24 24","data-optical-offset":"1.3497% 2.5944%"}},"version":{"package":"0.2.0-alpha.0","algorithm":"1.0.0-v2","schema":1}}
```

## Programmatic API (browser-safe core)

```ts
import {
  getOpticalCenter,
  transformViewBox,
  applyTransformToSvg,
} from 'optical-center';
import { rasterizeSvg } from 'optical-center/node'; // Node only

const svg = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
const raster = rasterizeSvg(svg);                      // Node
const offset = getOpticalCenter(raster);               // { dx, dy, dxPercent, dyPercent }
const result = transformViewBox(svg, raster, offset);  // { viewBox, breadcrumb, clipDetected }
const next = applyTransformToSvg(svg, result);         // string with rewritten <svg>
```

`getOpticalCenter` is platform-agnostic — feed it any RGBA buffer (canvas, OffscreenCanvas, Sharp, ImageData). Pull `rasterizeSvg` from `optical-center/node` only when you actually want to rasterize an SVG string in Node.

## Configuration knobs

The defaults work; the knobs are mostly for advanced users:

```ts
opticalCenter({
  emitMetadata: process.env.NODE_ENV !== 'production', // default tracks command
  babel: { onWarning: (w) => myLogger.warn(w) },
  onWarning: (w) => myLogger.warn(w),
});
```

| Plugin option | Default | Effect |
|---|---|---|
| `emitMetadata` | `true` under serve, `false` under build | Adds `data-optical-original-viewbox` and `data-optical-offset` for DevTools. |
| `onWarning` | logs to stderr | Receives `{ code, location? }`; pass `null` to silence. |
| `babel.emitMetadata` | falls back to plugin's | Override per Babel pass. |

CLI flags include `--no-cache`, `--cache-dir=...`, `--strict`, `--emit-metadata`, `--json`, `--silent`, `--quiet`. See `optical-center help <command>`.

## Warning codes

Every adapter emits a stable code so consumers can grep / filter / `--strict` on it.

| Code | Meaning |
|---|---|
| `OPTICAL_DYNAMIC_SVG` | JSX child or attribute is dynamic — bailed out. |
| `OPTICAL_SPREAD_PROPS` | `<svg {...rest}>` — can't statically detect opticalCenter. |
| `OPTICAL_MISSING_VIEWBOX` | No viewBox and no width/height. |
| `OPTICAL_VIEWBOX_DERIVED` | viewBox derived from width/height. |
| `OPTICAL_CLIP_DETECTED` | Shifted viewBox might clip painted pixels. |
| `OPTICAL_RASTERIZE_FAILED` | resvg couldn't parse the SVG. |
| `OPTICAL_CACHE_WRITE_FAIL` | Cache disk write failed (compute still ran). |
| `OPTICAL_VERSION_MISMATCH` | Cached entry from a different algorithm version. |
| `OPTICAL_INPUT_TOO_LARGE` | SVG exceeded `MAX_INPUT_BYTES`. |
| `OPTICAL_TIMEOUT` | Per-file timeout exceeded. |

## Performance

End-to-end (rasterize + pipeline + viewBox transform) runs at **~3 ms per icon** on a Lucide-class SVG. The plan target was 10–50 ms; the symmetry-axis Phase 2.5 optimization (36 → 12 angles + power LUT) pulls us an order of magnitude under.

The cache is content-addressable (`sha256(rawSvgBytes + algoVersion)`); a warm second pass over 100 icons completes in well under 200 ms.

## Migration from 0.1.x

`getOpticalCenter` keeps the same shape; the result now also carries `dxPercent` and `dyPercent` (additive, no breaking changes). Everything new lives behind subpath imports — `optical-center/node`, `optical-center/babel`, `optical-center/vite`, `optical-center/cli` — so existing browser callers see no surface change.

## Background

- Phase 1 (N=36, method of adjustment): RMSE = 2.99 px, r = 0.585.
- Phase 2 (N=30, 2AFC): pooled PSE = 0.745 — humans prefer 74.5% of the V2 raw correction.
- Phase 3 (N=46, adjustment fine-tune): per-icon validation; quantified central-tendency bias in adjustment tasks (Jewell & McCourt 2000).

The shipped model is `V2 × 0.745`.

## License

MIT.
