# Examples

Five runnable demos. Every path is build-time, every example uses
real-world idioms — installed npm packages or a project's own local
SVG folder. No alias workarounds, no shared `@fixtures` plumbing.
The repo-root [`fixtures/icons/`](../fixtures/icons/) pool is for
the test suite only.

| Folder | Real-world idiom it demonstrates | When to reach for it |
|--------|----------------------------------|----------------------|
| [`react-vite/`](./react-vite/) | inline JSX + `?optical` asset imports + CSS-mounted icons from `lucide-static` / `heroicons` / `@fortawesome/fontawesome-free` (PostCSS) | React apps using real npm icon packages |
| [`asset-import/`](./asset-import/) | `import.meta.glob` over a local `src/icons/` folder, raw + `?optical` side by side | Bundler users with their own SVG folder |
| [`vanilla-html/`](./vanilla-html/) | inline `<svg optical-center>` + CSS `optical-center: auto` against `lucide-static/icons/...` bare specifiers | No-framework HTML pages with installed icon packages |
| [`postcss-cli/`](./postcss-cli/) | pure PostCSS — `optical-center: auto` against npm-resolved icon paths, no bundler | Tailwind / Next / webpack / postcss-cli — anywhere PostCSS runs |
| [`cli-pipeline/`](./cli-pipeline/) | CLI run against a project's own `./icons/` folder with structured JSON output | Design-system pipelines, CI gating, npm-publishable icon sets |

## Run any of them

```bash
# from the repo root
npm install                                                         # links workspaces
npm --workspace optical-center-example-react-vite     run dev       # React grid
npm --workspace optical-center-example-asset-import   run dev       # local ?optical sweep
npm --workspace optical-center-example-vanilla-html   run dev       # plain HTML
npm --workspace optical-center-example-postcss-cli    run build     # postcss only
npm --workspace optical-center-example-cli-pipeline   run transform # CLI batch
```

## Build-time only

Every path the library exposes is build-time. There is no browser
runtime — it was deliberately stripped out. Four entry points,
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
render plain `<span className="icon icon-lucide-play optical" />`.
The whole correction happens before a byte ships.

## No alias config needed

The PostCSS plugin resolves bare specifiers through Node's module
resolution. So `url('lucide-static/icons/play.svg')` just works —
no `@alias`, no path-juggling. Every example sets up nothing more
than registering the plugin:

```js
// postcss.config.js
import opticalCenter from 'optical-center/postcss';
export default { plugins: [opticalCenter()] };
```
