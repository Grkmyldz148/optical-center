# Vanilla HTML example

Run the CLI on a folder of SVGs to produce a folder of perceptually
centered SVGs. No bundler, no JSX, just files in and files out.

## Run it

```bash
npx optical-center transform ./icons ./icons-centered
```

Compare the two folders: every output has a rewritten `viewBox` and a
`data-optical-center` attribute on the root `<svg>`.

## Inline use

You can also drop `optical-center` straight onto an `<svg>` tag inside
your HTML and run the Vite plugin's `transformIndexHtml` against the
file:

```html
<svg optical-center viewBox="0 0 24 24" width="32" height="32">
  <path d="M8 5v14l11-7z" />
</svg>
```
