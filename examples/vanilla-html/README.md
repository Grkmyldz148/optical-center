# Vanilla HTML

No framework, no JSX, no JavaScript on the client. Two build-time
paths, both running through plugins Vite picks up automatically.
Icons come from the installed `lucide-static` npm package.

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
`viewBox`, and strips the marker attribute.

```html
<svg optical-center viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <polygon points="6 3 20 12 6 21 6 3"/>
</svg>
```

### 2. CSS `optical-center: auto` (PostCSS plugin)

Plain `url('lucide-static/icons/play.svg')` in the stylesheet — bare
specifier resolves through Node's module resolution. The rule opts
in by adding one declaration. The PostCSS plugin (registered in
`postcss.config.js`, which Vite picks up) inlines a corrected SVG.

```css
.icon {
  background-image: url('lucide-static/icons/play.svg');
  optical-center: auto;
}

.tinted {
  -webkit-mask-image: url('lucide-static/icons/heart.svg');
          mask-image: url('lucide-static/icons/heart.svg');
  optical-center: auto;          /* one directive — both URLs corrected */
}
```

## No runtime, no aliases

Every path is build-time. There is no browser runtime. The only
configuration `postcss.config.js` carries is registering the plugin
itself — bare specifiers (`lucide-static/icons/...`) resolve through
Node's module resolution, so installed icon packages just work.
