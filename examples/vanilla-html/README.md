# Vanilla HTML

No React, no JSX, no framework. Three integration paths covering the
full surface — build-time inline SVG, build-time CSS background, and
runtime third-party web components.

## Run it

```bash
# from repo root
npm install
npm --workspace optical-center-example-vanilla-html run dev
```

## What's inside

### 1. Inline `<svg optical-center>` (build-time)

The Vite plugin's `transformIndexHtml` hook scans `index.html` at
build time, finds every `<svg optical-center>`, rewrites the
`viewBox`, and strips the marker attribute. Zero runtime cost — the
shipped HTML is just a corrected `<svg>`.

```html
<svg optical-center viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <polygon points="6 3 20 12 6 21 6 3"/>
</svg>
```

### 2. CSS `background-image` with `?optical` (build-time)

Vite's `load` hook recognises the `?optical` query suffix on SVG
imports — including the ones that come in via `url(...)` inside CSS.
The browser receives a corrected SVG; the CSS author never sees the
math.

```css
.icon-after  { background-image: url('@fixtures/lucide/play.svg?optical'); }
.icon-before { background-image: url('@fixtures/lucide/play.svg'); }
```

### 3. Iconify CDN + runtime hook

Third-party icon set loaded from a CDN `<script>` — no npm package,
no build step, no bundler awareness of the icons. `<iconify-icon>` is
a custom element that fetches its data and renders an `<svg>` into
its open shadow root.

We listen for the `load` event Iconify dispatches, traverse into the
shadow root, and call `applyOpticalCenter(svg)`:

```html
<iconify-icon class="optical" icon="mdi:play" width="36"></iconify-icon>
```

```ts
import { applyOpticalCenter } from 'optical-center/runtime';

document.querySelectorAll('iconify-icon.optical').forEach((host) => {
  host.addEventListener('load', () => {
    const svg = host.shadowRoot?.querySelector('svg');
    if (svg) void applyOpticalCenter(svg as SVGSVGElement);
  }, { once: true });
});
```

This pattern works for any icon library that emits an `<svg>` at
runtime — including ones that aren't installed via npm at all.

## Shared fixture pool

Both build-time scenarios pull SVGs from `fixtures/icons/` via the
`@fixtures` Vite alias. The same pool drives the test suite, the
React example, and the asset-import example — adding an icon to
`fixtures/icons/` automatically makes it available everywhere.
