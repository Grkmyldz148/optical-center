# Examples

Four runnable demos covering the most common ways to drop
`optical-center` into a real project:

| Folder | Use case | Pipeline |
|--------|----------|----------|
| [`react-vite/`](./react-vite/) | React app, write `<svg opticalCenter>` directly in JSX | Vite + Babel plugin |
| [`asset-import/`](./asset-import/) | Static SVG files imported via `?optical` suffix | Vite plugin (`load` hook) |
| [`vanilla-html/`](./vanilla-html/) | Plain HTML — drop `<svg optical-center>` and ship | CLI or Vite `transformIndexHtml` |
| [`cli-pipeline/`](./cli-pipeline/) | Folder of SVGs → folder of centered SVGs (icon sets, design systems) | CLI only |

Each subfolder has its own `README.md` with run instructions. They are
all real working setups — install + run, no hand-waving.
