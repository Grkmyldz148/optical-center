/**
 * Output-mode router for the CLI.
 *
 * Three rendering modes, in priority order:
 *
 *   1. `--json`             → NDJSON envelope on stdout. (writeJson in
 *                             output.ts is the contract.)
 *   2. TTY (interactive)    → Caret components on stdout/stderr — banner,
 *                             keyValue, step, table, error, success/warn.
 *   3. Pipe / non-TTY       → Plain text (the original Output Contract).
 *                             Agents, CI logs, and `--quiet` runs land
 *                             here too.
 *
 * Commands use `pickMode()` once and switch on the discriminated union.
 * Keeping the gate in one place stops drift between commands.
 */

import type { OutputOptions } from './output.js';

export type RenderMode = 'json' | 'tty' | 'text';

export function pickMode(options: OutputOptions): RenderMode {
  if (options.json) return 'json';
  if (options.silent) return 'text';
  if (process.stdout.isTTY === true) return 'tty';
  return 'text';
}
