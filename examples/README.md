# Examples

Three runnable build-time demos using real-world idioms. For an
interactive runtime sandbox, see [`apps/playground/`](../apps/playground/).

| Folder | What it shows | When to reach for it |
|--------|---------------|----------------------|
| [`react-vite/`](./react-vite/) | inline JSX `<svg optical-center="auto">` (Babel) + a CSS rule with `mask: url('lucide-static/icons/play.svg'); optical-center: auto;` (PostCSS) | React apps — both surfaces of the `optical-center` declaration in one app |
| [`postcss-cli/`](./postcss-cli/) | pure PostCSS — `optical-center: auto` against npm-resolved icon paths, no bundler | Tailwind / Next / webpack / postcss-cli — anywhere PostCSS runs |
| [`cli-pipeline/`](./cli-pipeline/) | CLI run against a project's own `./icons/` folder with structured JSON output | Design-system pipelines, CI gating, npm-publishable icon sets |

## Run any of them

```bash
# from the repo root
npm install                                                         # links workspaces
npm --workspace optical-center-example-react-vite     run dev       # React grid
npm --workspace optical-center-example-postcss-cli    run build     # postcss only
npm --workspace optical-center-example-cli-pipeline   run transform # CLI batch
```

## One declaration, two surfaces

The library exposes exactly one opt-in: the `optical-center` declaration.

- **CSS** — `optical-center: auto;` inside any rule. The PostCSS
  plugin (`optical-center/postcss`) rewrites every `url('…svg')`
  inside that rule to a corrected inline data URI. Bundler-agnostic
  (Tailwind / Next / webpack / postcss-cli / Vite).
- **JSX / HTML** — `optical-center="auto"` on a `<svg>` element. The
  Vite plugin (`optical-center/vite`) wires Babel for `.tsx`/`.jsx`
  modules and `transformIndexHtml` for plain HTML.

Plus the **CLI** (`optical-center transform <input> [output]`) for
folder-of-SVGs → folder-of-corrected-SVGs workflows that don't fit
either surface.

## No alias config needed

The PostCSS plugin resolves bare specifiers through Node's module
resolution. So `url('lucide-static/icons/play.svg')` just works — no
`@alias`, no path-juggling. Every example sets up nothing more than
registering the plugin:

```js
// postcss.config.js
import opticalCenter from 'optical-center/postcss';
export default { plugins: [opticalCenter()] };
```
