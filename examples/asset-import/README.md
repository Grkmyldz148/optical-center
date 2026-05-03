# Asset import example

Demonstrates the `?optical` query suffix for SVG asset imports — useful
when icons live in a folder of static `.svg` files (Heroicons, Lucide,
your own design-system) and you don't want to inline JSX for each one.

## Run it

```bash
npm install
npm run dev
```

## How it works

```ts
import playRaw from './icons/play.svg?raw';
import playOptical from './icons/play.svg?optical';

// playRaw       — original SVG markup, geometric center
// playOptical   — same SVG, viewBox rewritten by optical-center
```

The `?optical` suffix is an explicit opt-in: the Vite plugin sees the
suffix in the importer's id and transforms the SVG once at build time.
HMR is wired via `handleHotUpdate` so editing the source `.svg`
invalidates the cached module.

## Note on framework integration

Other Vite-based meta-frameworks (Astro, SolidStart, Marko, SvelteKit)
work the same way as long as they keep the standard Vite plugin API.
Drop `optical-center/vite` into your config's `plugins` array and the
`?optical` suffix lights up.
