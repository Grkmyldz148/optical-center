# React + Vite — every build-time path in one place

Three scenarios, all build-time. Zero runtime, zero React hook, zero
JS at the icon mount point.

| # | Scenario | Tooling | When to use |
|---|----------|---------|-------------|
| 1 | Inline `<svg opticalCenter>` JSX | Babel plugin | You author the SVG inline. |
| 2 | `import './x.svg?optical'` | Vite plugin (`load` hook) | You import SVG asset files. |
| 3 | CSS-mounted icons + `optical-center: auto` | PostCSS plugin | You use installed icon packages. |

## Run it

```bash
# from repo root — workspaces will link optical-center to the local source
npm install

# then start the dev server
npm --workspace optical-center-example-react-vite run dev
```

## Scenario 3 in detail

The recommended path for everything that isn't hand-authored JSX.
Real installed icon packages, no React component wrapper, no runtime
hook. The recipe:

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
  return <span className="icon icon-lucide-play optical" />;
}
```

The PostCSS plugin (registered via `postcss.config.js`) walks every
rule that declares `optical-center: auto`, pulls each
`url('…svg')` from disk through the rasterize → optical-center →
viewBox-rewrite pipeline, and replaces it with an inline
`data:image/svg+xml,…` URI. The directive is stripped from the
output. Your shipped CSS is plain, browser-native, framework-agnostic.

### Real packages used

- **`lucide-static`** — npm package, raw Lucide SVGs (24x24).
- **`heroicons`** — npm package, raw Heroicons SVGs (24x24, different style).
- **`@fortawesome/fontawesome-free`** — npm package, non-square viewBoxes (e.g. 384x512, 576x512).

The PostCSS plugin resolves bare specifiers through Node's module
resolution, so installed packages work with no alias config —
`url('lucide-static/icons/play.svg')` just works.

## Why no React component?

Earlier drafts shipped `<OpticalIcon>`, `<OpticalRef>`, and a
`useOpticalCenter()` hook for icon libraries that emit `<svg>` at
render time. They were deleted. Every path is build-time:

- the math runs once at build, not on every mount,
- the browser sees a corrected SVG with no breadcrumb,
- the React tree never touches the pipeline,
- there is no runtime entry to ship.
