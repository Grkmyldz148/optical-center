# Asset import (`?optical` suffix)

The Vite plugin's `load` hook recognises any SVG import that ends in
`?optical` and returns the rewritten markup as the default export of a
JS module. This example glob-imports every icon in the shared
`fixtures/icons/` pool — raw + optical — and renders them side by
side.

## Run it

```bash
# from repo root
npm install
npm --workspace optical-center-example-asset-import run dev
```

## How it scales

Adding a new icon to `fixtures/icons/` automatically picks it up here
because `import.meta.glob` is build-time-evaluated:

```ts
const opticalModules = import.meta.glob<string>(
  '../../../fixtures/icons/**/*.svg',
  { query: '?optical', import: 'default', eager: true },
);
```

No per-icon import line. Same pool drives the test suite, the React
example, and this one.

## Vite alias (optional)

`vite.config.ts` adds `@fixtures` → `fixtures/icons/` so production
code can write `import x from '@fixtures/lucide/play.svg?optical'`
instead of the relative `../../../fixtures/...` path.

## Bundler-agnostic note

The same `?optical` suffix works in any tool that loads via the Vite
plugin API surface: Astro, SolidStart, Marko, SvelteKit, Nuxt 3
(which uses Vite under the hood).
