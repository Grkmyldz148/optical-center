# PostCSS CLI

The bundler-agnostic path. Pure PostCSS — no Vite, no webpack, no
JavaScript at runtime. The opt-in is a single CSS declaration:

```css
.icon {
  background-image: url('icons/play.svg');
  optical-center: auto;
}
```

When the plugin sees `optical-center: auto;` in a rule, it walks
every other declaration in that rule, rewrites every `url('…svg')`
to a corrected `data:image/svg+xml,…` URI, and strips the directive
from the output. Shipped CSS is plain, browser-native,
zero-runtime.

## Run it

```bash
# from repo root
npm install
npm --workspace optical-center-example-postcss-cli run build
open examples/postcss-cli/index.html
```

## How it's wired

`postcss.config.js` registers the plugin with an alias for the
shared fixture pool:

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

`src/styles.css` writes URLs as if they were sibling files. Every
rule that wants optical centering adds one line:

```css
.icon-play-optical {
  background-image: url('@fixtures/lucide/play.svg');
  optical-center: auto;
}

.mask-heart-optical {
  -webkit-mask-image: url('@fixtures/lucide/heart.svg');
          mask-image: url('@fixtures/lucide/heart.svg');
  optical-center: auto;          /* one directive — both URLs corrected */
}
```

Editors that lint unknown properties may flag `optical-center`. Use
`--optical-center: auto` instead — the plugin treats both forms
identically and `--*` is a valid CSS custom property by spec.

## Why a directive (not a query suffix or function)?

Earlier drafts tried `url('play.svg?optical')` and
`optical(url('play.svg'))`. Both worked, both felt grafted on. A
property-shaped directive matches how CSS already opts into
behavior elsewhere (`will-change`, `contain`, `content-visibility`)
and reads naturally inside any rule:

- It's local to the rule it's declared on.
- It applies to every URL the rule contains, not just one.
- Source URLs stay as plain `url('…')` — copy-paste from anywhere.

## What gets emitted

Look at `dist/styles.css` after the build. Each opted-in rule looks
like:

```css
.icon-play-optical {
  background-image: url("data:image/svg+xml;utf8,%3Csvg viewBox=%22-1.293 -0.628 24 24%22…");
}
```

The viewBox is shifted; the rest of the SVG is preserved
byte-for-byte. The `optical-center: auto` declaration is gone.

## Why this matters

Anywhere PostCSS runs, the optical-center plugin can run. That covers:

- Tailwind CSS (PostCSS plugin chain)
- Next.js (PostCSS by default)
- Create React App / Vite / Astro (all use PostCSS internally)
- esbuild + postcss-loader
- webpack + postcss-loader
- standalone postcss-cli

So a CSS-only icon system gets perceptually correct centering at
build time, with zero runtime cost and zero framework lock-in.

## Shared fixture pool

This example doesn't ship its own icons. It points at the repo-root
`fixtures/icons/` folder via the `@fixtures` alias — same pool the
tests, the React example, the asset-import example, the vanilla-HTML
example, and the CLI pipeline all share.
