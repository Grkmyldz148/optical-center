# Vanilla HTML

No framework, no JSX, no JavaScript on the client. Two build-time
paths, both running through plugins Vite picks up automatically.

## Run it

```bash
# from repo root
npm install
npm --workspace optical-center-example-vanilla-html run dev
```

## What's inside

### 1. Inline `<svg optical-center>` (Vite plugin)

The Vite plugin's `transformIndexHtml` hook scans `index.html` at
build time, finds every `<svg optical-center>`, rewrites the
`viewBox`, and strips the marker attribute. Zero runtime cost — the
shipped HTML is just a corrected `<svg>`.

```html
<svg optical-center viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <polygon points="6 3 20 12 6 21 6 3"/>
</svg>
```

### 2. CSS `optical-center: auto` (PostCSS plugin)

Plain `url('…svg')` in the stylesheet — the rule opts in by adding
one declaration. The PostCSS plugin (registered in
`postcss.config.js`, which Vite picks up automatically) walks the
rule, rewrites every URL inside to an inline `data:image/svg+xml,…`
URI, and strips the directive from the output.

```css
.icon-after {
  background-image: url('@fixtures/lucide/play.svg');
  optical-center: auto;
}

.icon-tinted {
  -webkit-mask-image: url('@fixtures/lucide/heart.svg');
          mask-image: url('@fixtures/lucide/heart.svg');
  optical-center: auto;          /* one directive — both URLs corrected */
}
```

## No runtime

Earlier drafts shipped an `optical-center/runtime` entry that
rasterized `<svg>` elements in the browser. It's gone. Every path
this library exposes is build-time. Anything that genuinely couldn't
be solved at build time (e.g. a CDN-loaded `<iconify-icon>` whose
SVG content the bundler never sees) is out of scope — install the
icon package as a dependency and use the CSS path instead.

## Shared fixture pool

Pulls SVGs from the repo-root `fixtures/icons/` folder via the
`@fixtures` alias — same pool the tests, the React example, the
asset-import example, the postcss-cli example, and the CLI pipeline
all share.
