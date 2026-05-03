export const HELP_ROOT = `optical-center — perceptual optical centering toolkit

Usage:
  optical-center <command> [options]

Commands:
  transform <input> [output]   Rewrite viewBox on every SVG in a folder.
  info <svg>                   Report optical-center metrics for one file.
  analyze <folder>             Aggregate report across a folder.
  clear-cache [--all]          Remove cached transforms.
  version                      Print package + algorithm version.
  help [command]               Show this message or a per-command page.

Output flags (every command):
  --json              Emit a single NDJSON envelope on stdout.
  --silent            Suppress stdout (envelope only on --json).
  --quiet             Suppress stderr progress (errors still print).

Exit codes:
  0  success
  1  success with warnings (clipping, derived viewBox)
  2  recoverable error (at least one file bailed out)
  3  fatal error (config invalid, native binding fail)
`;

export const HELP_COMMANDS: Record<string, string> = {
  transform: `Usage: optical-center transform <input> [output]

Rewrite the viewBox on every SVG file in <input>, writing the results to
<output> (or in-place when output is omitted).

Options:
  --no-cache          Bypass the on-disk cache.
  --cache-dir=<path>  Override the cache root.
  --strict            Promote warnings to a non-zero exit code.
  --emit-metadata     Add data-optical-original-viewbox / data-optical-offset.
  --json              Emit a structured report on stdout.
`,
  info: `Usage: optical-center info <svg>

Print the computed offset, new viewBox, and clip-detection result for a
single SVG file.

Options:
  --json              Emit a structured report on stdout.
`,
  analyze: `Usage: optical-center analyze <folder>

Aggregate report: count, average offset magnitude, files with warnings,
files with the largest offsets.

Options:
  --json              Emit a structured report on stdout.
`,
  'clear-cache': `Usage: optical-center clear-cache [--all]

Remove the cache directory for the current algorithm version.

Options:
  --all               Wipe every algorithm-version directory.
  --cache-dir=<path>  Override the cache root.
`,
  version: `Usage: optical-center version

Print the package version, algorithm version, and JSON schema version.
`,
};
