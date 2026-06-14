# optical-center · postcss-cli

The bundler-agnostic path. Pure PostCSS — no Vite, no webpack, no
Next.js, no JavaScript at runtime. Icons come from real installed
npm packages (`lucide-static`, `heroicons`,
`@fortawesome/fontawesome-free`); the plugin resolves bare
specifiers through Node's module resolution, so no alias config is
needed.

The opt-in is a single CSS declaration:

```css
.icon {
  background-image: url('lucide-static/icons/play.svg');
  optical-center: auto;
}
```

When the plugin sees `optical-center: auto;` in a rule, it walks
every other declaration in that rule, rewrites every
`url('…svg')` to a corrected `data:image/svg+xml,…` URI, and
replaces the directive with `--optical-center: auto` (a no-op
tracer kept as a DevTools breadcrumb).

## Run it

```bash
# from the repo root
yarn install
yarn workspace optical-center-example-postcss-cli build
open examples/postcss-cli/index.html
```

The build emits `dist/styles.css` next to the source.
`dist/styles.css` is what the demo page loads.

## How it's wired

`postcss.config.js` registers two plugins:

```js
import opticalCenter from 'optical-center/postcss';

export default {
  plugins: [opticalCenter(), inlineRemainingSvgUrls()],
};
```

The first is the subject of the demo — `optical-center/postcss`.
The second (`inlineRemainingSvgUrls`) is a ~25-line adjunct
defined inline in `postcss.config.js` that resolves bare
specifiers and inlines them as data URIs. It exists only so the
demo's non-optical "geometric" badges also load via `file://`.
**In a real project you would not need it** — your bundler (Vite,
webpack, Next.js, …) handles bare-specifier asset resolution out
of the box. The optical-center plugin itself only acts on rules
that opt in via the directive.

`src/styles.css` writes urls as bare specifiers. The plugin
resolves them through `node_modules`:

```css
.icon-fa-play.optical {
  background-image: url('@fortawesome/fontawesome-free/svgs/solid/play.svg');
  optical-center: auto;
}

.mask-arrow-right.optical {
  mask-image: url('lucide-static/icons/arrow-right.svg');
  optical-center: auto;
}
```

Editors that lint unknown CSS properties may flag
`optical-center`. Use `--optical-center: auto` instead — the
plugin treats both forms identically and `--*` is a valid CSS
custom property by spec.

## What the example demonstrates

Six sections, each isolating one flavour of the directive. The
demo page renders every section side-by-side: the geometric badge
mounts the raw SVG, the optical badge adds one
`optical-center: auto` declaration. A crosshair behind every
badge marks the wrapper's geometric centre so the perceptual
shift is eyeballable.

| § | Scenario | Property under test | Lesson |
| - | -------- | ------------------- | ------ |
| 1 | `background-image` | `background-image: url(…)` | Canonical case across three packages (lucide, heroicons, fontawesome) |
| 2 | `background` shorthand | `background: … url(…) …` | Shorthand vs. longhand makes no difference |
| 3 | Off-centre position | `background-position: 28% 50%` | The shift is internal to the SVG; your positioning is preserved |
| 4 | `mask-image` | `mask-image: url(…)` | Re-tintable icons (mask + `currentColor`) work the same |
| 5 | `mask` shorthand | `mask: url(…) …` | The url matcher doesn't care which mask property |
| 6 | `content: url()` | `::before { content: url(…) }` | Replaced-element mounting on pseudos works too |

The pattern is the same in every section: one rule, one
`optical-center: auto` declaration, the plugin walks the rule and
rewrites every `url('…svg')` it finds.

## Why a directive?

A property-shaped directive matches how CSS already opts into
behaviour elsewhere (`will-change`, `contain`,
`content-visibility`). It is local to the rule, applies to every
URL in the rule, and the source URLs stay as plain `url('…')` —
copy-paste from anywhere.

## What gets emitted

Each opted-in rule looks like this after the plugin runs:

```css
.icon-lucide-play.optical {
  background-image: url("data:image/svg+xml;utf8,%3Csvg viewBox=%22-1.293 -0.628 24 24%22…");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 44px;
  --optical-center: auto;
}
```

The viewBox is shifted (negative `min-x` / `min-y` translates the
content inside its rendering box). The rest of the SVG is
preserved byte-for-byte. The `optical-center: auto` declaration
has been replaced with the no-op `--optical-center: auto` tracer.

## Why this matters

Anywhere PostCSS runs, the optical-center plugin can run:

- Tailwind CSS (PostCSS plugin chain)
- Next.js (PostCSS by default)
- Create React App, Vite, Astro (all use PostCSS internally)
- esbuild + postcss-loader
- webpack + postcss-loader
- standalone postcss-cli (this example)

CSS-only icon system. Perceptually correct centering. Build time,
zero runtime cost, zero framework lock-in.
