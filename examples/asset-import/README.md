# Asset import (`?optical` suffix)

The Vite plugin's `load` hook recognises any SVG import that ends in
`?optical` and returns the rewritten markup as the default export of
a JS module. This example glob-imports every icon in a local
`src/icons/` folder — raw + optical — and renders them side by side.

## Run it

```bash
# from repo root
npm install
npm --workspace optical-center-example-asset-import run dev
```

## How it scales

Adding a new icon to `src/icons/` automatically picks it up here
because `import.meta.glob` is build-time-evaluated:

```ts
const opticalModules = import.meta.glob<string>('./icons/*.svg', {
  query: '?optical',
  import: 'default',
  eager: true,
});
```

No per-icon import line. Drop a new SVG in, hit save.

## Bundler-agnostic note

The same `?optical` suffix works in any tool that loads via the Vite
plugin API surface: Astro, SolidStart, Marko, SvelteKit, Nuxt 3
(which uses Vite under the hood).
