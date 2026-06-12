/**
 * Help text generators.
 *
 * Each surface (root help, per-command help) has two renders: a Caret
 * render for interactive terminals and a plain-text render for pipes,
 * CI logs, and `--quiet` runs. The pipe form is the historical Output
 * Contract — keep it stable so agents that grep for keywords don't
 * break across releases.
 */

import { banner } from './caret/components/banner.js';
import { divider } from './caret/components/divider.js';
import { keyValue } from './caret/components/key-value.js';
import { list } from './caret/components/list.js';
import { paragraph } from './caret/components/paragraph.js';

import { writeStdout } from './output.js';
import type { OutputOptions } from './output.js';
import { pickMode } from './render.js';

const COMMANDS: ReadonlyArray<{ name: string; summary: string }> = [
  { name: 'init', summary: 'Set up optical-center in a project (auto-detects the framework).' },
  { name: 'transform', summary: 'Rewrite viewBox on every SVG in a folder.' },
  { name: 'info', summary: 'Report optical-center metrics for one file.' },
  { name: 'analyze', summary: 'Aggregate report across a folder.' },
  { name: 'clear-cache', summary: 'Remove cached transforms.' },
  { name: 'version', summary: 'Print package + algorithm version.' },
  { name: 'help', summary: 'Show this message or a per-command page.' },
];

const GLOBAL_FLAGS: ReadonlyArray<{ name: string; summary: string }> = [
  { name: '--json', summary: 'Emit a single NDJSON envelope on stdout.' },
  { name: '--silent', summary: 'Suppress stdout (envelope only on --json).' },
  { name: '--quiet', summary: 'Suppress stderr progress (errors still print).' },
];

const EXIT_CODES: ReadonlyArray<{ code: string; meaning: string }> = [
  { code: '0', meaning: 'success' },
  { code: '1', meaning: 'success with warnings (clipping, derived viewBox)' },
  { code: '2', meaning: 'recoverable error (at least one file bailed out)' },
  { code: '3', meaning: 'fatal error (config invalid, native binding fail)' },
];

const ROOT_HELP_PLAIN = `optical-center — perceptual optical centering toolkit

Usage:
  optical-center <command> [options]
  optical-center             (no arguments in a terminal opens the interactive wizard)

Commands:
${COMMANDS.map((c) => `  ${c.name.padEnd(12)} ${c.summary}`).join('\n')}

Output flags (every command):
${GLOBAL_FLAGS.map((f) => `  ${f.name.padEnd(12)} ${f.summary}`).join('\n')}

Exit codes:
${EXIT_CODES.map((e) => `  ${e.code}  ${e.meaning}`).join('\n')}
`;

const COMMAND_HELP_PLAIN: Record<string, string> = {
  init: `Usage: optical-center init [dir]

Wire optical-center into a project: detect the framework and package
manager, install the dependency, and patch the relevant config file.
Run without flags in a terminal to pick everything interactively.

Options:
  --integration=<name>  vite | astro | postcss | tailwind | babel
                        (default: auto-detected from the project)
  --yes                 Accept the detected defaults — never prompt.
  --no-install          Skip the package-manager install step.
  --pm=<name>           npm | pnpm | yarn | bun (default: lockfile detection).
  --dry-run             Report what would change without writing anything.
  --json                Emit a structured report on stdout.
`,
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

export function knownHelpTopic(name: string): boolean {
  return name in COMMAND_HELP_PLAIN;
}

export function printRootHelp(options: OutputOptions): void {
  const mode = pickMode(options);
  if (mode === 'tty') {
    renderRootHelpTty();
    return;
  }
  writeStdout(ROOT_HELP_PLAIN.trimEnd(), options);
}

export function printCommandHelp(name: string, options: OutputOptions): void {
  const mode = pickMode(options);
  if (mode === 'tty') {
    renderCommandHelpTty(name);
    return;
  }
  const text = COMMAND_HELP_PLAIN[name];
  if (text !== undefined) {
    writeStdout(text.trimEnd(), options);
  }
}

function renderRootHelpTty(): void {
  banner({
    title: 'Optical Center',
    subtitle: 'perceptual optical centering toolkit',
  });

  process.stdout.write('\n');
  divider({ label: 'Commands', align: 'left' });
  list({
    items: COMMANDS.map((c) => ({ label: c.name, description: c.summary })),
    variant: 'arrow',
  });

  process.stdout.write('\n');
  divider({ label: 'Output flags', align: 'left' });
  list({
    items: GLOBAL_FLAGS.map((f) => ({ label: f.name, description: f.summary })),
    variant: 'dash',
  });

  process.stdout.write('\n');
  divider({ label: 'Exit codes', align: 'left' });
  keyValue({
    rows: EXIT_CODES.map((e) => ({ key: e.code, value: e.meaning })),
    highlightKeys: true,
  });

  process.stdout.write('\n');
  paragraph('tip: run `optical-center` with no arguments to pick a command interactively.', {
    indent: 2,
  });
}

function renderCommandHelpTty(name: string): void {
  switch (name) {
    case 'init':
      renderInitHelp();
      return;
    case 'transform':
      renderTransformHelp();
      return;
    case 'info':
      renderInfoHelp();
      return;
    case 'analyze':
      renderAnalyzeHelp();
      return;
    case 'clear-cache':
      renderClearCacheHelp();
      return;
    case 'version':
      renderVersionHelp();
      return;
    default:
      return;
  }
}

function commandBanner(name: string): void {
  banner({
    title: `optical-center ${name}`,
    subtitle: usageLine(name),
  });
}

function usageLine(name: string): string {
  switch (name) {
    case 'init':
      return 'init [dir]';
    case 'transform':
      return 'transform <input> [output]';
    case 'info':
      return 'info <svg>';
    case 'analyze':
      return 'analyze <folder>';
    case 'clear-cache':
      return 'clear-cache [--all]';
    case 'version':
      return 'version';
    default:
      return name;
  }
}

function renderInitHelp(): void {
  commandBanner('init');
  process.stdout.write('\n');
  paragraph(
    'Wire optical-center into a project: detect the framework and package manager, install the dependency, and patch the relevant config file. Run without flags in a terminal to pick everything interactively.',
    { indent: 2 },
  );
  process.stdout.write('\n');
  divider({ label: 'Options', align: 'left' });
  keyValue({
    rows: [
      { key: '--integration=<name>', value: 'vite | astro | postcss | tailwind | babel (default: auto-detected).' },
      { key: '--yes', value: 'Accept the detected defaults — never prompt.' },
      { key: '--no-install', value: 'Skip the package-manager install step.' },
      { key: '--pm=<name>', value: 'npm | pnpm | yarn | bun (default: lockfile detection).' },
      { key: '--dry-run', value: 'Report what would change without writing anything.' },
      { key: '--json', value: 'Emit a structured report on stdout.' },
    ],
    highlightKeys: true,
    width: 88,
  });
}

function renderTransformHelp(): void {
  commandBanner('transform');
  process.stdout.write('\n');
  paragraph(
    'Rewrite the viewBox on every SVG file in <input>, writing the results to <output> (or in-place when output is omitted).',
    { indent: 2 },
  );
  process.stdout.write('\n');
  divider({ label: 'Options', align: 'left' });
  keyValue({
    rows: [
      { key: '--no-cache', value: 'Bypass the on-disk cache.' },
      { key: '--cache-dir=<path>', value: 'Override the cache root.' },
      { key: '--strict', value: 'Promote warnings to a non-zero exit code.' },
      { key: '--emit-metadata', value: 'Add data-optical-original-viewbox / data-optical-offset.' },
      { key: '--json', value: 'Emit a structured report on stdout.' },
    ],
    highlightKeys: true,
    width: 88,
  });
}

function renderInfoHelp(): void {
  commandBanner('info');
  process.stdout.write('\n');
  paragraph(
    'Print the computed offset, new viewBox, and clip-detection result for a single SVG file.',
    { indent: 2 },
  );
  process.stdout.write('\n');
  divider({ label: 'Options', align: 'left' });
  keyValue({
    rows: [{ key: '--json', value: 'Emit a structured report on stdout.' }],
    highlightKeys: true,
  });
}

function renderAnalyzeHelp(): void {
  commandBanner('analyze');
  process.stdout.write('\n');
  paragraph(
    'Aggregate report: count, average offset magnitude, files with warnings, files with the largest offsets.',
    { indent: 2 },
  );
  process.stdout.write('\n');
  divider({ label: 'Options', align: 'left' });
  keyValue({
    rows: [{ key: '--json', value: 'Emit a structured report on stdout.' }],
    highlightKeys: true,
  });
}

function renderClearCacheHelp(): void {
  commandBanner('clear-cache');
  process.stdout.write('\n');
  paragraph(
    'Remove the cache directory for the current algorithm version.',
    { indent: 2 },
  );
  process.stdout.write('\n');
  divider({ label: 'Options', align: 'left' });
  keyValue({
    rows: [
      { key: '--all', value: 'Wipe every algorithm-version directory.' },
      { key: '--cache-dir=<path>', value: 'Override the cache root.' },
    ],
    highlightKeys: true,
  });
}

function renderVersionHelp(): void {
  commandBanner('version');
  process.stdout.write('\n');
  paragraph(
    'Print the package version, algorithm version, and JSON schema version.',
    { indent: 2 },
  );
}
