# Reference

CLI, configuration, programmatic API, warning codes, and performance notes for
`optical-center`. For a friendly overview start at the
[README](../README.md); for internals see
[architecture.md](./architecture.md).

## Contents

- [CLI](#cli)
- [Configuration](#configuration)
- [Programmatic API](#programmatic-api)
- [Warning codes](#warning-codes)
- [Performance](#performance)

---

## CLI

```bash
npx optical-center                              # bare, in a terminal → interactive wizard
npx optical-center init [dir]                   # auto-detect framework, install, patch config
npx optical-center transform <input> [output]   # folder → folder
npx optical-center info <svg>                   # one file, full breakdown
npx optical-center analyze <folder>             # aggregate report, top-N
npx optical-center clear-cache [--all]
npx optical-center version
```

### Interactive wizard

Run the binary with no arguments in a real terminal for a menu instead of a
help dump: pick a command, fill in filesystem-validated paths, and the wizard
echoes the equivalent one-shot invocation so it doubles as a flag tutorial.
After each command the menu returns. Pipes, CI, `--json`, and `--silent` never
see the wizard.

### `init`

Detects the framework (Vite / Astro / Tailwind / PostCSS / Babel) and package
manager, installs the dependency, and patches the config: `opticalCenter()`
first in Vite's `plugins`, after Tailwind in PostCSS's, and so on.

Flags: `--integration=<name>`, `--yes`, `--no-install`, `--pm=<name>`,
`--dry-run`. When a config's shape can't be edited confidently, it prints a
paste-ready snippet and exits `1` instead of guessing.

### Output contract

stdout = data only, stderr = progress + warnings.

| Exit code | Meaning |
|---|---|
| `0` | success |
| `1` | success **with warnings** (e.g. clip detection) |
| `2` | recoverable error |
| `3` | fatal |

`--strict` promotes warnings to a non-zero exit so CI fails on clip detection.

> **Heads-up for script runners:** exit code `1` (success-with-warnings) makes
> yarn/npm print a "command failed" banner. That's the runner talking, not a
> crash; check stderr for the actual warning. The interactive wizard always
> exits `0` on a clean quit.

```bash
$ optical-center info ./icons/play.svg --json
{"schemaVersion":1,"command":"info","result":{"file":".../play.svg","newViewBox":"-0.3239 -0.6226 24 24","offset":{"dxPercent":1.3497,"dyPercent":2.5944},"clipDetected":false},"version":{"package":"0.2.0-alpha.0","algorithm":"1.0.0-v2","schema":1}}
```

Global flags: `--no-cache`, `--cache-dir=…`, `--strict`, `--emit-metadata`,
`--json`, `--silent`, `--quiet`. See `optical-center help <command>`.

---

## Configuration

The defaults work; the knobs are for advanced users.

```ts
opticalCenter({
  emitMetadata: process.env.NODE_ENV !== 'production',
  onWarning: (w) => myLogger.warn(w),
});
```

| Plugin option | Default | Effect |
|---|---|---|
| `emitMetadata` | `true` under serve, `false` under build | Adds `data-optical-original-viewbox` + `data-optical-offset` for DevTools. |
| `onWarning` | logs to stderr | Receives `{ code, location? }`; pass `null` to silence. |
| `iconData.exclude` | (none) | Scope the automatic imported-icon pass. |
| `babel.emitMetadata` | inherits plugin's | Override per Babel pass. |

---

## Programmatic API

```ts
import {
  getOpticalCenter,
  transformViewBox,
  applyTransformToSvg,
} from 'optical-center';
import { rasterizeSvg } from 'optical-center/node'; // Node only

const svg = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
const raster = rasterizeSvg(svg);                      // Node
const offset = getOpticalCenter(raster);               // { dx, dy }
const result = transformViewBox(svg, raster, offset);  // { viewBox, breadcrumb, clipDetected }
const next = applyTransformToSvg(svg, result);         // string with rewritten <svg>
```

`getOpticalCenter` is platform-agnostic: feed it any RGBA buffer (canvas,
OffscreenCanvas, Sharp, ImageData). Pull `rasterizeSvg` from
`optical-center/node` only when you actually need to rasterize an SVG string in
Node.

The result carries both raster-pixel offsets (`dx`, `dy`) and percentages
(`dxPercent`, `dyPercent`); the percentages are resolution-independent and are
what the build adapters apply to the `viewBox`.

---

## Warning codes

Every adapter emits a stable code, so consumers can grep / filter / `--strict`.
These are part of the public API: they are added to, never renamed.

| Code | Meaning |
|---|---|
| `OPTICAL_DYNAMIC_SVG` | JSX child or attribute is dynamic: bailed out. |
| `OPTICAL_SPREAD_PROPS` | `<svg {...rest}>`: can't statically detect the marker. |
| `OPTICAL_MISSING_VIEWBOX` | No viewBox and no width/height. |
| `OPTICAL_VIEWBOX_DERIVED` | viewBox derived from width/height. |
| `OPTICAL_CLIP_DETECTED` | Shifted viewBox might clip painted pixels. |
| `OPTICAL_RASTERIZE_FAILED` | resvg couldn't parse the SVG. |
| `OPTICAL_CACHE_WRITE_FAIL` | Cache disk write failed (compute still ran). |
| `OPTICAL_VERSION_MISMATCH` | Cached entry from a different algorithm version. |
| `OPTICAL_INPUT_TOO_LARGE` | SVG exceeded `MAX_INPUT_BYTES`. |
| `OPTICAL_TIMEOUT` | Per-file timeout exceeded. |

---

## Performance

End-to-end (rasterize + pipeline + viewBox transform) runs at **~3 ms per
icon** on a Lucide-class SVG. The cache is content-addressable
(`sha256(rawSvgBytes + algorithmVersion)`); a warm second pass over 100 icons
completes in well under 200 ms.

Because `ALGORITHM_VERSION` is part of the cache key, bumping the model
automatically invalidates stale cached offsets.
