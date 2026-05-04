# PostCSS CLI

The bundler-agnostic path. Pure PostCSS — no Vite, no webpack, no
JavaScript at runtime. Icons come from real installed npm packages
(`lucide-static`, `heroicons`, `@fortawesome/fontawesome-free`); the
plugin resolves bare specifiers through Node's module resolution, so
no alias config is needed.

The opt-in is a single CSS declaration:

```css
.icon {
  background-image: url('lucide-static/icons/play.svg');
  optical-center: auto;
}
```

When the plugin sees `optical-center: auto;` in a rule, it walks
every other declaration in that rule, rewrites every `url('…svg')`
to a corrected `data:image/svg+xml,…` URI, and strips the directive
from the output.

## Run it

```bash
# from repo root
npm install
npm --workspace optical-center-example-postcss-cli run build
open examples/postcss-cli/index.html
```

## How it's wired

`postcss.config.js` registers the plugin — that's it:

```js
import opticalCenter from 'optical-center/postcss';

export default {
  plugins: [opticalCenter()],
};
```

`src/styles.css` writes URLs as bare specifiers; the plugin resolves
them through `node_modules`:

```css
.icon-fa-play.optical {
  background-image: url('@fortawesome/fontawesome-free/svgs/solid/play.svg');
  optical-center: auto;
}

.mask-arrow-right.optical {
  -webkit-mask-image: url('lucide-static/icons/arrow-right.svg');
          mask-image: url('lucide-static/icons/arrow-right.svg');
  optical-center: auto;          /* one directive — both URLs corrected */
}
```

Editors that lint unknown CSS properties may flag `optical-center`.
Use `--optical-center: auto` instead — the plugin treats both forms
identically and `--*` is a valid CSS custom property by spec.

## Why a directive?

A property-shaped directive matches how CSS already opts into
behavior elsewhere (`will-change`, `contain`, `content-visibility`).
It's local to the rule, applies to every URL in the rule, and the
source URLs stay as plain `url('…')` — copy-paste from anywhere.

## What gets emitted

Each opted-in rule looks like:

```css
.icon-lucide-play.optical {
  background-image: url("data:image/svg+xml;utf8,%3Csvg viewBox=%22-1.293 -0.628 24 24%22…");
}
```

The viewBox is shifted; the rest of the SVG is preserved
byte-for-byte. The `optical-center: auto` declaration is gone.

## Why this matters

Anywhere PostCSS runs, the optical-center plugin can run:

- Tailwind CSS (PostCSS plugin chain)
- Next.js (PostCSS by default)
- Create React App / Vite / Astro (all use PostCSS internally)
- esbuild + postcss-loader
- webpack + postcss-loader
- standalone postcss-cli

CSS-only icon system, perceptually correct centering, build time,
zero runtime cost, zero framework lock-in.
