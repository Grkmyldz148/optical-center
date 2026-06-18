# Contributing

Issues and PRs are welcome. The repo is a small TypeScript monorepo: the
library is plain `tsc`, the tests are Vitest, and the demos are real apps you
can run.

## Repository layout

```
optical-center/
├─ src/                  # the library (compiled to dist/ by tsc)
│  ├─ model/             #   the algorithm: RGBA buffer → optical offset (browser-safe)
│  ├─ core/              #   build-time primitives: viewBox math, types, warnings (browser-safe)
│  ├─ node/              #   Node-only: resvg rasterize, sanitize, timeout
│  ├─ cache/             #   content-addressable transform cache + algorithm fingerprint
│  ├─ detect/            #   structural icon-data detection (is this value an icon?)
│  ├─ corrector/         #   bulk icon-data correction (Iconify sets) via a worker pool
│  ├─ babel/             #   Babel plugin: <svg opticalCenter> JSX
│  ├─ vite/              #   Vite plugin: Babel pass + index.html + imported icons
│  ├─ astro/             #   Astro integration + dev middleware
│  ├─ postcss/           #   PostCSS plugin: optical-center: auto
│  ├─ tailwind/          #   Tailwind plugin surface
│  └─ cli/               #   the optical-center binary (+ caret/, a tiny TUI toolkit)
├─ tests/                # Vitest suite, mirrors src/
├─ examples/*            # runnable build-time demos (npm workspaces)
└─ apps/
   ├─ playground/        # interactive Vite + React sandbox  →  play.opticalcenter.dev
   └─ site/              # Astro marketing + docs site        →  opticalcenter.dev
```

The internal module layering and the model are documented in
[`docs/architecture.md`](docs/architecture.md).

## Prerequisites

- **Node ≥ 20** (CI runs 20 and 22)
- **npm** (the repo uses npm workspaces; the committed lockfile is
  `package-lock.json`)

## Getting started

```bash
git clone https://github.com/Grkmyldz148/optical-center.git
cd optical-center
npm install        # installs the root package + every workspace
npm run build      # tsc → dist/
npm test           # vitest run
```

## Build, test, type-check

| Command | What it does |
|---|---|
| `npm run build` | `tsc`: type-checks **and** emits `dist/`. This is the type-check gate in CI. |
| `npm test` | `vitest run`: the full suite. |
| `npm run test:watch` | Vitest in watch mode. |
| `npx vitest run tests/model` | Run one folder / file. |
| `npx vitest run --coverage` | Coverage report (v8) into `coverage/`. |

A change must keep `npm run build` and `npm test` green before it can merge.

## Dev loops

```bash
npm run dev:cli          # rebuild + run the CLI once: npm run dev:cli -- info ./icon.svg
npm run dev:playground   # Vite sandbox at http://localhost:5173
npm run dev:site         # Astro site at http://localhost:4321
```

The playground is the fastest way to _see_ a model change: it routes the same
offline `optical-center/node` computation through a Vite middleware and swaps a
cell's `viewBox` between the geometric and optical values. See
[`apps/playground/README.md`](apps/playground/README.md).

## Architecture & import rules

The package is strictly layered so a browser bundler never pulls in native
code. Respect the dependency direction when adding modules:

```
model  →  core  →  { node, cache, detect, corrector, babel, vite, astro, postcss, tailwind, cli }
```

- `model/` and `core/` are **browser-safe**: no `@resvg/resvg-js`, no `fs`, no
  worker threads.
- `core/` may import `model/` but **must not** import `cache/`, `node/`,
  `babel/`, `vite/`, or `cli/`; those depend on `core/`, not the reverse.
- Native work (rasterization, disk cache, worker pool) belongs in `node/`,
  `cache/`, or `corrector/`, never in `model/` / `core/`.

Full breakdown in [`docs/architecture.md`](docs/architecture.md).

## Conventions

- **Tests mirror `src/`.** Add or update the matching file under `tests/`.
  Cover the bail-out paths too; every
  [warning code](docs/reference.md#warning-codes) should have a test that
  triggers it.
- **Cross-platform.** CI runs on Linux, macOS, **and Windows**. Write path
  assertions with forward slashes / `path.posix` rather than OS-native
  separators, and don't commit OS-specific lockfile artifacts.
- **Warning codes are API.** Don't rename an existing `OPTICAL_*` code; add a
  new one. Consumers `--strict` and grep on them.
- **Algorithm changes** must bump `ALGORITHM_VERSION` so cached offsets
  invalidate, and update the snapshot-style expectations in `tests/model/`.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `ci:`, `chore:`, `docs:`). Keep PRs focused, and add a
  `CHANGELOG.md` entry under `[Unreleased]` for anything user-facing.

## Examples

Each folder under `examples/` is a runnable workspace demonstrating one idiom;
see [`examples/README.md`](examples/README.md):

```bash
npm --workspace optical-center-example-react-vite  run dev        # JSX + CSS surfaces
npm --workspace optical-center-example-postcss-cli run build      # PostCSS only
npm --workspace optical-center-example-cli-pipeline run transform # CLI batch
```

## CI & deployment

- **`.github/workflows/ci.yml`**: on every push/PR to `main`: install,
  `npm run build` (type-check), `npm test`, across
  `{ubuntu, macos, windows} × node {20, 22}`; coverage uploaded on PRs.
- **`.github/workflows/deploy.yml`**: builds the library + both apps and
  deploys them to Cloudflare Pages (prod on `main`, previews on PRs). See
  [`apps/DEPLOY.md`](apps/DEPLOY.md).
