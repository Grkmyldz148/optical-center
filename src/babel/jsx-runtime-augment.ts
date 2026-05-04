/**
 * TypeScript augmentation for the `opticalCenter` JSX prop.
 *
 * Without this declaration, TypeScript projects that write
 * `<svg opticalCenter>` get a "Property 'opticalCenter' does not exist
 * on type 'SVGProps<SVGSVGElement>'" error, because the prop is
 * compile-time-only — it's stripped by the Babel plugin before any
 * JSX runtime sees it.
 *
 * Users opt in by referencing this file:
 *
 *   /// <reference types="optical-center/babel/jsx-runtime-augment" />
 *
 * or via tsconfig:
 *
 *   {
 *     "compilerOptions": {
 *       "types": ["optical-center/babel/jsx-runtime-augment"]
 *     }
 *   }
 *
 * The augmentation extends `react`'s SVGProps via interface merging.
 * If the project does not depend on `@types/react`, the declaration is
 * silently inert — you only need it where you actually consume JSX.
 */

declare module 'react' {
  interface SVGProps<T> {
    /**
     * Compile-time marker that triggers optical-center's Babel plugin
     * to rewrite this <svg>'s viewBox so it renders perceptually
     * centered.
     *
     * The prop is stripped at build time — at runtime the only trace
     * is the rewritten viewBox and a `data-optical-center` breadcrumb.
     *
     * Pass `false` to opt out per-element. Pass `"auto"` (the default)
     * to apply the standard correction.
     */
    opticalCenter?: boolean | 'auto';
    /**
     * Kebab-case alias for `opticalCenter` — mirrors the CSS
     * `optical-center: auto` directive and the HTML
     * `<svg optical-center="auto">` attribute exactly.
     *
     * Same semantics as `opticalCenter`. Pick whichever reads better
     * for your codebase; the Babel plugin treats them identically.
     */
    'optical-center'?: boolean | 'auto';
  }
}

export {};
