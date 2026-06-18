# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The current working version is `0.2.0-alpha.0`; everything for the 0.2.0 line
lives under **[Unreleased]** until it ships.

## [Unreleased]

### Added

- **Subpath entry points**: `optical-center/node`, `/cli`, `/babel`, `/vite`,
  `/astro`, `/postcss`, `/tailwind`. The default `.` entry stays browser-safe.
- **Vite plugin**: rewrites `<svg optical-center>` in JSX/TSX and `index.html`,
  **and** auto-corrects imported icon data (Iconify sets, single-icon modules,
  plain icon maps) detected by shape.
- **PostCSS plugin**: bundler-agnostic, build-time `url('…svg')` rewriting
  inside any rule that declares `optical-center: auto`.
- **Babel plugin**: unified JSX syntax: `optical-center="auto"` behaves
  identically to the CSS directive.
- **Astro integration**: dev middleware + a post-build HTML sweep so
  `<svg optical-center="auto">` works inside `.astro` templates.
- **Tailwind plugin**: emits an `optical-center` utility class.
- **CLI**: `init` (framework + package-manager detection and config patching),
  `transform`, `info`, `analyze`, `clear-cache`, `version`, an interactive
  wizard, and a stable `--json` / `--strict` / exit-code contract.
- **Content-addressable cache** keyed by `sha256(rawSvgBytes + ALGORITHM_VERSION)`,
  so model bumps invalidate stale entries automatically.
- `dxPercent` / `dyPercent` on the optical-center result (additive, existing
  `dx` / `dy` callers are unaffected).
- **Apps & infra**: an interactive playground (`play.opticalcenter.dev`), an
  Astro docs/marketing site (`opticalcenter.dev`), Cloudflare Pages CI/CD, and a
  cross-platform test matrix (Linux / macOS / Windows × Node 20 / 22).
- A **Playground** link in the site header.
- An animated README banner (`docs/assets/`) demonstrating the geometric →
  optical shift, generated reproducibly from source.
- A dispatch **release workflow** (`.github/workflows/release.yml`) that bumps
  the version with `npm version` (package.json + lockfile, so `npm ci` stays in
  sync) and cuts a GitHub Release, which the publish workflow turns into an
  `npm publish`.

### Changed

- Opt-in moved to the `optical-center: auto` declaration as the single source of
  truth across CSS, JSX, and HTML.
- Documentation restructured: a slim `README.md` plus `docs/reference.md`,
  `docs/architecture.md`, `CONTRIBUTING.md`, and this changelog.

### Removed

- The browser runtime; all centering is now computed at build time.

## [0.1.0] - 2026-04-24

### Added

- Initial release: `getOpticalCenter` and the **V2 × 0.745** perceptual model
  (DoG + convex hull + symmetry pipeline, globally scaled by the Phase 2 pooled
  PSE).

[Unreleased]: https://github.com/Grkmyldz148/optical-center/compare/main...HEAD
