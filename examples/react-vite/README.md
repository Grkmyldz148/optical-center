# React + Vite — `optical-center: auto`

One declaration, two surfaces. Same property name in CSS and JSX.

| Surface | What you write | Plugin that handles it |
|---------|----------------|------------------------|
| JSX     | `<svg optical-center="auto">…</svg>` | Babel (via `optical-center/vite`) |
| CSS     | `.icon { mask: url('…svg'); optical-center: auto; }` | PostCSS (`optical-center/postcss`) |

Both run at build time. The marker is stripped from the output; the
browser sees a flat, pre-corrected SVG (or a `data:image/svg+xml,…`
inline mask). No runtime, no React hook, no JS at the icon mount
point.

## Run it

```bash
# from repo root
npm install
npm --workspace optical-center-example-react-vite run dev
```

## Surface 1 — JSX

Real-world idiom: paste an SVG inline (designer hand-off, icon
library source, or hand-rolled glyph) and add the attribute.

```tsx
export function PlayButton() {
  return (
    <button>
      <svg optical-center="auto" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <polygon points="6 3 20 12 6 21 6 3" />
      </svg>
    </button>
  );
}
```

The Babel plugin walks the static `<svg>` subtree at compile time,
runs the optical-centering pipeline, rewrites `viewBox`, and strips
the marker. Both `optical-center="auto"` (mirrors CSS), the camelCase
`opticalCenter="auto"`, and the boolean shorthand `opticalCenter` are
accepted.

## Surface 2 — CSS

Real-world idiom: a single-color utility icon mounted via
`mask-image`, recolored by `currentColor` (Tailwind mask-utility,
shadcn-style icon primitives, etc.).

```css
.icon-play {
  display: inline-block;
  width: 24px;
  height: 24px;
  background: currentColor;
  mask: url('lucide-static/icons/play.svg') center / contain no-repeat;
  optical-center: auto;
}
```

The PostCSS plugin walks every rule that contains `optical-center: auto`,
runs each `url('…svg')` through the rasterize → optical-center → viewBox
rewrite pipeline, and inlines the corrected SVG as a `data:image/svg+xml,…`
URI. The directive disappears from shipped CSS.

Bare specifiers like `lucide-static/icons/play.svg` resolve through
Node's module resolution — installed npm icon packages just work,
no alias config needed.

## Wiring

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import opticalCenter from 'optical-center/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [opticalCenter(), react()],
});
```

`postcss.config.js`:

```js
import opticalCenter from 'optical-center/postcss';
export default { plugins: [opticalCenter()] };
```

Vite picks `postcss.config.js` up automatically. That's the whole
setup — two plugins, two API surfaces, one declaration.
