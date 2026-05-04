# Examples

Five runnable demos covering every realistic way to drop
`optical-center` into a project. They all share one
[`fixtures/icons/`](../fixtures/icons/) pool — 30 real icons from
Lucide, Heroicons, Feather, FontAwesome, Phosphor, Tabler, plus a
stress set of edge cases (asymmetric, multicolor, edge-clipped,
stroke-only, non-square, negative viewBox, gradient).

| Folder | Scenarios it demonstrates | When to reach for it |
|--------|---------------------------|----------------------|
| [`react-vite/`](./react-vite/) | inline JSX `<svg opticalCenter>`, `?optical` asset imports, CSS-mounted icons via `lucide-static` / `heroicons` / `@fortawesome/fontawesome-free` (PostCSS) | React apps — every path is build-time, no React hook |
| [`asset-import/`](./asset-import/) | every fixture imported via `?optical` (build-time), side-by-side with the raw original | Bundler users with their own SVG files |
| [`vanilla-html/`](./vanilla-html/) | inline `<svg optical-center>`, CSS `background-image: url('…?optical')`, Iconify CDN + runtime hook | No-framework projects, third-party CDN icon sets |
| [`postcss-cli/`](./postcss-cli/) | pure PostCSS — `background-image` + `mask-image` rewritten via `optical-center: auto`, no bundler | Tailwind / Next / webpack / postcss-cli — anywhere PostCSS runs |
| [`cli-pipeline/`](./cli-pipeline/) | CLI run against the shared fixture pool with structured JSON output | Design-system pipelines, CI gating, npm-publishable icon sets |

## Run any of them

```bash
# from the repo root
npm install                                                         # links workspaces
npm --workspace optical-center-example-react-vite     run dev       # React grid
npm --workspace optical-center-example-asset-import   run dev       # full ?optical sweep
npm --workspace optical-center-example-vanilla-html   run dev       # plain HTML
npm --workspace optical-center-example-postcss-cli    run build     # postcss only
npm --workspace optical-center-example-cli-pipeline   run transform # CLI batch
```

## Build-time first

Every example except the Iconify CDN block in `vanilla-html/` runs
the optical-center pass at compile time. Four entry points,
overlapping coverage:

- the **Babel plugin** — `<svg opticalCenter>` in JSX,
- the **Vite plugin** — `import x from 'play.svg?optical'` + HTML `<svg optical-center>`,
- the **PostCSS plugin** — any CSS rule that adds `optical-center: auto`,
  bundler-agnostic (Tailwind / Next / webpack / postcss-cli / Vite),
- the **CLI** — folder of SVGs → folder of corrected SVGs, with JSON output.

For React, the recommended path is the PostCSS one: install icon
packages that ship raw SVGs (`lucide-static`, `heroicons`,
`@fortawesome/fontawesome-free`), author CSS with
`mask-image: url('lucide-static/icons/play.svg')` + `optical-center: auto`,
render plain `<span className="icon icon-play" />`. The whole
correction happens before a byte ships.

## Runtime is the escape hatch

`optical-center/runtime` exists for the one case build-time can't
cover: a third-party web component that fetches its SVG from a CDN
at runtime (e.g. `<iconify-icon>`). The vanilla-HTML example shows
this clearly marked. Nothing else uses it.

## Code duplication

Zero. Every example pulls SVGs from `fixtures/icons/` via the
`@fixtures` alias (Vite or PostCSS), `import.meta.glob`, or a
relative path. Adding an icon to `fixtures/icons/<family>/`
automatically picks it up in all five examples and the test suite.
