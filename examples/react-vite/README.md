# React + Vite — every build-time path in one place

Three scenarios, all build-time. Zero runtime, zero React hook, zero
JS at the icon mount point.

| # | Scenario | Tooling | When to use |
|---|----------|---------|-------------|
| 1 | `<Play />` / `<Heart />` style icon components — CSS-only centering | PostCSS plugin | The default. Real npm icon packages, lucide-react DX. |
| 2 | Inline JSX `<svg optical-center="auto">` | Babel plugin | You author the SVG inline (paste from a design tool). |
| 3 | `import './x.svg?optical'` | Vite plugin (`load` hook) | You import individual SVG asset files. |

## Run it

```bash
# from repo root — workspaces will link optical-center to the local source
npm install

# then start the dev server
npm --workspace optical-center-example-react-vite run dev
```

## Scenario 1 — lucide-react DX, CSS-only centering

```tsx
import { Play, Heart, ArrowRight } from './components/icons';

<Play />        {/* identical call signature to lucide-react */}
<Heart />
<ArrowRight />
```

Each named export is a plain `<span>` wrapper around a CSS class:

```tsx
// components/icons.tsx
const make = (cls: string) => () =>
  <span className={`icon ${cls} optical`} />;

export const Play       = make('icon-lucide-play');
export const Heart      = make('icon-lucide-heart');
export const ArrowRight = make('icon-lucide-arrow-right');
```

The CSS does the rest:

```css
/* src/styles/icons.css */
.icon-lucide-play.optical {
  -webkit-mask-image: url('lucide-static/icons/play.svg');
          mask-image: url('lucide-static/icons/play.svg');
  optical-center: auto;          /* ← only line that differs */
}
```

When `postcss.config.js` registers the optical-center plugin (Vite
picks it up automatically), every rule with `optical-center: auto`
gets each `url('…svg')` rewritten to an inline `data:image/svg+xml,…`
URI of the corrected SVG. The directive is stripped from the
output. The shipped CSS is plain, browser-native, framework-agnostic.

### Why a wrapper component?

You could write `<span className="icon icon-lucide-play optical" />`
directly — that's what the wrappers do. But `<Play />` is shorter,
typed, autocompletes, and matches what people expect when they reach
for icons in React. The wrapper is one line per icon. Compared to
`lucide-react`'s React component (which emits `<svg>` at render
time and would need a runtime hook to center), the wrapper is
strictly cheaper: no JSX traversal, no SVG diffing, no `viewBox`
mutation per mount.

### Real packages used

- **`lucide-static`** — npm, raw Lucide SVGs (24x24).
- **`heroicons`** — npm, raw Heroicons SVGs (24x24, different style).
- **`@fortawesome/fontawesome-free`** — npm, non-square viewBoxes (e.g. 384x512, 576x512).

Bare specifiers (`url('lucide-static/icons/play.svg')`) resolve
through Node's module resolution. No alias config needed.

## Why no runtime?

Earlier drafts shipped `<OpticalIcon>`, `<OpticalRef>`, and a
`useOpticalCenter()` hook for icon libraries that emit `<svg>` at
render time. They were deleted. Every path is build-time:

- the math runs once at build, not on every mount,
- the browser sees a corrected SVG with no breadcrumb,
- the React tree never touches the pipeline,
- there is no runtime entry to ship.
