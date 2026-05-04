# PostCSS CLI

The bundler-agnostic path. Pure PostCSS — no Vite, no webpack, no
JavaScript at runtime. Author CSS as if the icons were just static
SVGs; the plugin sees `?optical` at build time and inlines a
corrected SVG as a `data:image/svg+xml,…` URI.

## Run it

```bash
# from repo root
npm install
npm --workspace optical-center-example-postcss-cli run build
open examples/postcss-cli/index.html
```

## How it's wired

`postcss.config.js` registers `optical-center/postcss` with an alias
that points at the shared fixture pool:

```js
import opticalCenter from 'optical-center/postcss';

export default {
  plugins: [
    opticalCenter({
      aliases: { '@fixtures': '/abs/path/to/fixtures/icons' },
    }),
  ],
};
```

`src/styles.css` writes the URLs as if they were sibling files:

```css
.icon-play-optical {
  background-image: url('@fixtures/lucide/play.svg?optical');
}
```

The plugin runs during `postcss-cli`'s build and replaces every
`?optical` URL with an inline data URI of the rewritten SVG. The
shipped `dist/styles.css` is plain CSS — works in any browser, no
JavaScript required.

## Why this matters

Anywhere PostCSS runs, the optical-center plugin can run. That
covers:

- Tailwind CSS (PostCSS plugin chain)
- Next.js (PostCSS by default)
- Create React App / Vite / Astro (all use PostCSS internally)
- esbuild + postcss-loader
- webpack + postcss-loader
- standalone postcss-cli

So a CSS-only icon system gets perceptually correct centering at
build time, with zero runtime cost and zero framework lock-in.

## What gets emitted

Look at `dist/styles.css` after running the build. Each `?optical`
URL has been replaced with something like:

```css
.icon-play-optical {
  background-image: url("data:image/svg+xml;utf8,%3Csvg viewBox=%22-1.293 -0.628 24 24%22…");
}
```

The viewBox is shifted; the rest of the SVG is preserved byte-for-byte.

## Shared fixture pool

This example doesn't ship its own icons. It points at the repo-root
`fixtures/icons/` folder via the `@fixtures` alias — same pool the
tests, the React example, the asset-import example, the vanilla-HTML
example, and the CLI pipeline all share.
