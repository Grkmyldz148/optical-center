# React + Vite — every integration path in one place

Six scenarios side-by-side so you can see exactly which approach
applies to your icons:

| # | Scenario | Path | When to use |
|---|----------|------|-------------|
| 1 | Inline `<svg opticalCenter>` JSX | build-time | You author the SVG inline. |
| 2 | `import './x.svg?optical'` | build-time | You import SVG asset files. |
| 3 | `lucide-react` + ref hook | runtime | Component lib that forwards refs. |
| 4 | `@heroicons/react` + ref hook | runtime | Same as Lucide. |
| 5 | `react-icons` + `<OpticalIcon>` wrapper | runtime | Lib that doesn't forward refs. |
| 6 | `@iconify/react` (200K+ icons) | runtime | Async icon data, dynamic sets. |

## Run it

```bash
# from repo root — workspaces will link optical-center to the local source
npm install

# then start the dev server
npm --workspace optical-center-example-react-vite run dev
```

Open the printed URL. Each section has a "build-time" or "runtime"
pill explaining what's happening.

## Which to use in your own app

- **You write `<svg>` inline?** Use scenario 1. It's free at runtime.
- **You import `.svg` files?** Use scenario 2. The Vite plugin's
  `?optical` query lets you opt in per import.
- **You use `lucide-react`, `@heroicons/react`, or any lib that
  forwards refs?** Scenario 3/4 — `useOpticalCenterRef()` is one
  line.
- **You use `react-icons`, `@fortawesome/react-fontawesome`, or any
  lib that hides its `<svg>`?** Scenario 5 — `<OpticalIcon>` wraps
  any of them.
- **You use `@iconify/react`?** Scenario 6 — same `<OpticalIcon>`
  wrapper handles its async render too.

## What the runtime hook costs

For runtime scenarios (3–6), the optical-center pass runs once per
SVG on mount: serialize, rasterize via Image+canvas, compute, mutate
viewBox. ~5–10ms per icon on a typical machine. The result is
cached on the DOM element via `data-optical-center`, so re-renders
don't redo the work.

For static icon sets, prefer the build-time path (scenarios 1–2)
where the cost is paid once at build, not per-page-view.
