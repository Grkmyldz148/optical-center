# Examples

Four runnable demos covering every realistic way to drop
`optical-center` into a project. They all share one
[`fixtures/icons/`](../fixtures/icons/) pool — 30 real icons from
Lucide, Heroicons, Feather, FontAwesome, Phosphor, Tabler, plus a
stress set of edge cases (asymmetric, multicolor, edge-clipped,
stroke-only, non-square, negative viewBox, gradient).

| Folder | Scenarios it demonstrates | When to reach for it |
|--------|---------------------------|----------------------|
| [`react-vite/`](./react-vite/) | inline JSX `<svg opticalCenter>`, `?optical` asset imports, `lucide-react`, `@heroicons/react`, `react-icons`, `@iconify/react` | React apps using any major icon library |
| [`asset-import/`](./asset-import/) | every fixture imported via `?optical` (build-time), side-by-side with the raw original | Bundler users with their own SVG files |
| [`vanilla-html/`](./vanilla-html/) | inline `<svg optical-center>`, CSS `background-image: url('…?optical')`, Iconify CDN + runtime hook | No-framework projects, third-party CDN icon sets |
| [`cli-pipeline/`](./cli-pipeline/) | CLI run against the shared fixture pool with structured JSON output | Design-system pipelines, CI gating, npm-publishable icon sets |

## Run any of them

```bash
# from the repo root
npm install                                                         # links workspaces
npm --workspace optical-center-example-react-vite run dev           # React grid
npm --workspace optical-center-example-asset-import run dev         # full ?optical sweep
npm --workspace optical-center-example-vanilla-html run dev         # plain HTML
npm --workspace optical-center-example-cli-pipeline run transform   # CLI batch
```

## Build-time vs. runtime

The library covers both halves of the icon problem:

- **Build-time** rewrites the `viewBox` once, at compile, and ships a
  corrected SVG. Zero runtime cost. Used in: inline JSX (Babel),
  asset imports (`?optical`), vanilla HTML (`transformIndexHtml`),
  CLI batch.

- **Runtime** rasterizes the rendered `<svg>` in the browser and
  rewrites its `viewBox` after mount. Slightly heavier, but the only
  option for icon libraries that emit `<svg>` at render time
  (`lucide-react`, `@heroicons/react`, `react-icons`,
  `@iconify/react`, `<iconify-icon>`). Exposed via
  `optical-center/runtime`.

Each example shows whichever path is appropriate for its setup — and
the React example shows both side by side.

## Code duplication

Zero. Every example pulls SVGs from `fixtures/icons/` via the
`@fixtures` Vite alias or `import.meta.glob`. Adding an icon to
`fixtures/icons/<family>/` automatically picks it up in all four
examples and the test suite.
