/**
 * Interactive wizard — `optical-center` with no arguments in a TTY.
 *
 * Instead of dumping the help page, walk the user through the same
 * commands the flag surface exposes: pick a command from a Caret select,
 * collect its inputs (paths validated against the filesystem before the
 * command runs), then dispatch to the exact same per-command runner the
 * non-interactive path uses. Before dispatching we echo the equivalent
 * one-shot invocation so the wizard doubles as a teaching surface.
 *
 * The wizard is a session, not a one-shot: after a command finishes its
 * exit status is shown inline and the menu comes back, so several
 * commands can run back to back. `exit` (or esc / ctrl-c on the menu)
 * leaves the session. A clean quit always exits 0 — per-command codes
 * are display-only here, because a human already saw the warnings;
 * the 0/1/2/3 contract is for the non-interactive surface. (Script
 * runners like yarn print a scary "command failed" banner for any
 * non-zero exit, which is noise for an interactively-closed session.)
 *
 * Pipes, --json, and --silent never reach this module — index.ts gates
 * on a TTY for both stdin and stdout and falls back to the help page.
 */

import { existsSync, statSync } from 'node:fs';

import { banner } from './caret/components/banner.js';
import { divider } from './caret/components/divider.js';
import { input } from './caret/components/input.js';
import { select } from './caret/components/select.js';
import { paintAccent, paintDim, paintSemantic } from './caret/lib/paint.js';
import { getTheme } from './caret/theme/global.js';
import { runAnalyze } from './commands/analyze.js';
import { runClearCache } from './commands/clear-cache.js';
import { runInfo } from './commands/info.js';
import { runInit } from './commands/init.js';
import { runTransform } from './commands/transform.js';
import { runVersion } from './commands/version.js';
import { printRootHelp } from './help.js';
import type { OutputOptions } from './output.js';

type CommandName =
  | 'init'
  | 'transform'
  | 'info'
  | 'analyze'
  | 'clear-cache'
  | 'version'
  | 'help'
  | 'exit';

const COMMAND_CHOICES: ReadonlyArray<{ label: string; value: CommandName; hint: string }> = [
  { label: 'init', value: 'init', hint: 'Set up optical-center in a project (auto-detects the framework).' },
  { label: 'transform', value: 'transform', hint: 'Rewrite viewBox on every SVG in a folder.' },
  { label: 'info', value: 'info', hint: 'Report optical-center metrics for one file.' },
  { label: 'analyze', value: 'analyze', hint: 'Aggregate report across a folder.' },
  { label: 'clear-cache', value: 'clear-cache', hint: 'Remove cached transforms.' },
  { label: 'version', value: 'version', hint: 'Print package + algorithm version.' },
  { label: 'help', value: 'help', hint: 'Show the full command reference.' },
  { label: 'exit', value: 'exit', hint: 'Leave the wizard (esc works too).' },
];

export async function runInteractive(output: OutputOptions): Promise<number> {
  banner({
    title: 'Optical Center',
    subtitle: 'perceptual optical centering toolkit',
  });

  for (;;) {
    process.stdout.write('\n');
    const command = await select({
      message: 'What do you want to do?',
      choices: COMMAND_CHOICES,
    });
    if (command === null || command === 'exit') {
      const dim = paintDim();
      process.stdout.write(dim('bye.') + '\n');
      return 0;
    }

    const code = await dispatch(command, output);
    if (code !== null) reportExit(code);
    process.stdout.write('\n');
    divider({});
  }
}

/**
 * Run one menu entry. Returns the command's exit code, or null when
 * there is no meaningful status to show (help, cancelled prompts).
 */
async function dispatch(
  command: Exclude<CommandName, 'exit'>,
  output: OutputOptions,
): Promise<number | null> {
  switch (command) {
    case 'init':
      // init runs its own prompts (integration select, install confirm).
      return runInit([], {});
    case 'transform':
      return wizardTransform();
    case 'info':
      return wizardInfo();
    case 'analyze':
      return wizardAnalyze();
    case 'clear-cache':
      return wizardClearCache();
    case 'version':
      echoCommand(['version']);
      return runVersion([], {});
    case 'help':
      process.stdout.write('\n');
      printRootHelp(output);
      return null;
  }
}

/** One dim status line so the session log shows how each command ended. */
function reportExit(code: number): void {
  const theme = getTheme();
  const dim = paintDim();
  if (code === 0) {
    const success = paintSemantic(theme, 'success');
    process.stdout.write(`\n${success(theme.symbols.state.success)} ${dim('done')}\n`);
  } else if (code === 1) {
    const warning = paintSemantic(theme, 'warning');
    process.stdout.write(
      `\n${warning(theme.symbols.state.warning)} ${dim('finished with warnings (exit 1)')}\n`,
    );
  } else {
    const danger = paintSemantic(theme, 'danger');
    process.stdout.write(
      `\n${danger(theme.symbols.state.failure)} ${dim(`failed (exit ${code})`)}\n`,
    );
  }
}

async function wizardTransform(): Promise<number | null> {
  const inputDir = await input({
    message: 'Input folder (SVGs to rewrite)',
    placeholder: './icons',
    required: true,
    validate: mustBeDirectory,
  });
  if (inputDir === null) return null;

  const outputDir = await input({
    message: 'Output folder',
    placeholder: 'blank = transform in place',
  });
  if (outputDir === null) return null;

  if (outputDir === '') {
    // In-place rewriting is exactly what bit our own fixtures — make
    // the destructive variant an explicit decision, not a default.
    const confirmed = await select({
      message: `Rewrite the SVGs inside ${inputDir} in place?`,
      choices: [
        { label: 'yes', value: true, hint: 'Files are overwritten — make sure they are under version control.' },
        { label: 'no', value: false, hint: 'Go back without touching anything.' },
      ],
      initial: 1,
    });
    if (confirmed !== true) return null;
  }

  const metadata = await select({
    message: 'Emit data-optical-* metadata attributes?',
    choices: [
      { label: 'no', value: false, hint: 'Rewrite the viewBox only.' },
      { label: 'yes', value: true, hint: 'Add data-optical-original-viewbox / data-optical-offset.' },
    ],
  });
  if (metadata === null) return null;

  const positionals = outputDir === '' ? [inputDir] : [inputDir, outputDir];
  const flags: Record<string, string | boolean> = metadata ? { 'emit-metadata': true } : {};
  echoCommand(['transform', ...positionals, ...(metadata ? ['--emit-metadata'] : [])]);
  return runTransform(positionals, flags);
}

async function wizardInfo(): Promise<number | null> {
  const file = await input({
    message: 'SVG file to inspect',
    placeholder: './icons/arrow.svg',
    required: true,
    validate: mustBeFile,
  });
  if (file === null) return null;

  echoCommand(['info', file]);
  return runInfo([file], {});
}

async function wizardAnalyze(): Promise<number | null> {
  const folder = await input({
    message: 'Folder to analyze',
    placeholder: './icons',
    required: true,
    validate: mustBeDirectory,
  });
  if (folder === null) return null;

  echoCommand(['analyze', folder]);
  return runAnalyze([folder], {});
}

async function wizardClearCache(): Promise<number | null> {
  const all = await select({
    message: 'Which cache entries should go?',
    choices: [
      { label: 'current version', value: false, hint: 'Only the current algorithm-version directory.' },
      { label: 'everything', value: true, hint: 'Wipe every algorithm-version directory.' },
    ],
  });
  if (all === null) return null;

  echoCommand(['clear-cache', ...(all ? ['--all'] : [])]);
  return runClearCache([], all ? { all: true } : {});
}

function mustBeDirectory(path: string): string | null {
  if (!existsSync(path)) return 'path does not exist';
  if (!statSync(path).isDirectory()) return 'path is not a folder';
  return null;
}

function mustBeFile(path: string): string | null {
  if (!existsSync(path)) return 'path does not exist';
  if (!statSync(path).isFile()) return 'path is not a file';
  return null;
}

/** Show the equivalent one-shot invocation so the wizard teaches the flags. */
function echoCommand(parts: ReadonlyArray<string>): void {
  const theme = getTheme();
  const accent = paintAccent(theme);
  const dim = paintDim();
  const rendered = parts.map((p) => (/\s/.test(p) ? `'${p}'` : p)).join(' ');
  process.stdout.write(
    `\n${accent(theme.symbols.progress.arrow)} ${dim(`optical-center ${rendered}`)}\n\n`,
  );
}
