/**
 * `optical-center/tailwind` — Tailwind CSS plugin registration.
 *
 * Drop this into your `tailwind.config.{js,ts,mjs}`:
 *
 *   import opticalCenter from 'optical-center/tailwind';
 *   export default { plugins: [opticalCenter] };
 *
 * After that, `optical-center` is a real Tailwind utility class.
 * Wrap any icon in an element that uses it:
 *
 *   <div class="optical-center">
 *     <Play />
 *   </div>
 *
 * The Tailwind plugin emits a single declaration:
 *
 *   .optical-center { optical-center: auto; }
 *
 * The directive itself is consumed by the project's PostCSS pipeline
 * (`optical-center/postcss`), which expands it into a real centering
 * block plus a `${selector} > *` sibling rule with the perceptual
 * translate. So make sure the PostCSS plugin runs AFTER Tailwind in
 * your `postcss.config.{js,cjs,mjs}` — Tailwind ships the directive,
 * `optical-center/postcss` resolves it.
 *
 * The Babel plugin (`optical-center/babel`) reads the same `class`
 * marker is NOT needed for the JSX-scan path (the PostCSS plugin
 * scans JSX directly). It IS useful when you also write a static
 * inline `<svg>` and want its viewBox rewritten at compile time —
 * in that case put `optical-center="auto"` on the wrapper alongside
 * the class.
 *
 * Implementation note: we deliberately don't expand the directive
 * inside the Tailwind plugin. Tailwind plugins run BEFORE the rest
 * of the PostCSS chain, so any expansion here would mean the
 * `optical-center/postcss` plugin has nothing left to process. By
 * emitting just the directive we keep one source of truth — the
 * PostCSS plugin — for what `optical-center: auto` actually compiles
 * to (positioning, child rule, JSX scan match, etc.).
 */

interface TailwindPluginApi {
  /**
   * Tailwind 3.x `addComponents` API. Typed loosely so we don't
   * pull a hard `tailwindcss` peer dep just for the plugin's
   * declarations.
   */
  addComponents: (components: Record<string, Record<string, string>>) => void;
}

type TailwindPluginFn = (api: TailwindPluginApi) => void;

const opticalCenterTailwind: TailwindPluginFn = ({ addComponents }) => {
  addComponents({
    '.optical-center': {
      'optical-center': 'auto',
    },
  });
};

export default opticalCenterTailwind;
