# React + Vite — every build-time path in one place

Three scenarios, all build-time. Zero runtime, zero React hook, zero
JS at the icon mount point.

| # | Scenario | Tooling | When to use |
|---|----------|---------|-------------|
| 1 | Inline `<svg opticalCenter>` JSX | Babel plugin | You author the SVG inline. |
| 2 | `import './x.svg?optical'` | Vite plugin (`load` hook) | You import SVG asset files. |
| 3 | CSS-mounted icons + `optical-center: auto` | PostCSS plugin | You use installed icon packages or your own SVG folder. |

## Run it

```bash
# from repo root — workspaces will link optical-center to the local source
npm install

# then start the dev server
npm --workspace optical-center-example-react-vite run dev
```

## Scenario 3 in detail

This is the path the project recommends for everything that isn't
hand-authored JSX. Real installed icon packages, no React component
wrapper, no runtime hook. The recipe:

```css
/* src/styles/icons.css */
.icon-play.optical {
  -webkit-mask-image: url('lucide-static/icons/play.svg');
          mask-image: url('lucide-static/icons/play.svg');
  optical-center: auto;          /* ← the plugin inlines the corrected SVG */
}
```

```tsx
function PlayButton() {
  return <span className="icon icon-play optical" />;
}
```

The PostCSS plugin (registered via `postcss.config.js`) walks every
rule that declares `optical-center: auto`, pulls each
`url('…svg')` from disk through the rasterize → optical-center →
viewBox-rewrite pipeline, and replaces it with an inline
`data:image/svg+xml,…` URI. The directive is stripped from the
output. Your shipped CSS is plain, browser-native, framework-agnostic.

### Sources demonstrated

- **`lucide-static`** — npm package with raw Lucide SVGs.
- **`heroicons`** — npm package with raw Heroicons SVGs.
- **`@fortawesome/fontawesome-free`** — npm package, non-square viewBoxes.
- **`@fixtures/...`** — local SVG folder via a Vite + PostCSS alias.

The PostCSS plugin resolves bare specifiers through Node's module
resolution, so npm packages work with no alias config.

## Why no React component?

Earlier drafts shipped `<OpticalIcon>`, `<OpticalRef>`, and a
`useOpticalCenter()` hook for icon libraries that emit `<svg>` at
render time. They worked, but they pushed the optical-center pass to
the browser — ~5–10ms per icon on every mount, plus a `data-optical-center`
breadcrumb hanging off every node. The CSS path skips all of that:
the math runs once at build, the browser sees a corrected SVG, the
React tree never touches the pipeline.

The runtime hook (`optical-center/runtime`) still ships in the
package as the documented escape hatch for genuinely dynamic cases
(e.g., `<iconify-icon>` from a CDN — see `examples/vanilla-html/`).
The React example doesn't need it.
