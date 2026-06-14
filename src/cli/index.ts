#!/usr/bin/env node
/**
 * CLI entry point. Dispatches to per-command runners; every runner
 * returns a numeric exit code that we propagate to `process.exit`.
 *
 * The Output Contract (see plan §"CLI Output Contract"):
 *   - stdout: machine output (text or NDJSON envelope under --json)
 *   - stderr: progress / warnings / errors
 *   - exit codes: 0 success, 1 success+warnings, 2 recoverable error,
 *                 3 fatal (config invalid, native binding fail)
 *
 * Output is layered: in interactive TTYs we render via Caret components,
 * pipes and `--silent` fall back to the plain-text Output Contract, and
 * `--json` always emits the NDJSON envelope. See ./render.ts for the gate.
 */

import { parseArgv } from './argv.js';
import { error as caretError } from './caret/components/error.js';
import { capability } from './caret/lib/capability.js';
import { runAnalyze } from './commands/analyze.js';
import { runClearCache } from './commands/clear-cache.js';
import { runInfo } from './commands/info.js';
import { runInit } from './commands/init.js';
import { runTransform } from './commands/transform.js';
import { runVersion } from './commands/version.js';
import { knownHelpTopic, printCommandHelp, printRootHelp } from './help.js';
import { runInteractive } from './interactive.js';
import { readOutputOptions, writeStderr } from './output.js';
import { pickMode } from './render.js';

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgv(argv);
  const output = readOutputOptions(parsed.flags);

  if (parsed.flags['help'] === true) {
    printRootHelp(output);
    return 0;
  }

  if (parsed.command === undefined) {
    // Bare `optical-center` in a real terminal opens the wizard; pipes,
    // --json, and --silent keep the historical help-page behaviour.
    const cap = capability();
    if (pickMode(output) === 'tty' && cap.isStdinTTY) {
      return runInteractive(output);
    }
    printRootHelp(output);
    return 0;
  }

  switch (parsed.command) {
    case 'help': {
      const target = parsed.positionals[0];
      if (target === undefined) {
        printRootHelp(output);
        return 0;
      }
      if (!knownHelpTopic(target)) {
        reportUnknownCommand(target, output, /* root hint */ false);
        return 3;
      }
      printCommandHelp(target, output);
      return 0;
    }
    case 'init':
      return runInit(parsed.positionals, parsed.flags);
    case 'transform':
      return runTransform(parsed.positionals, parsed.flags);
    case 'info':
      return runInfo(parsed.positionals, parsed.flags);
    case 'analyze':
      return runAnalyze(parsed.positionals, parsed.flags);
    case 'clear-cache':
      return runClearCache(parsed.positionals, parsed.flags);
    case 'version':
      return runVersion(parsed.positionals, parsed.flags);
    default:
      reportUnknownCommand(parsed.command, output, /* root hint */ true);
      return 3;
  }
}

function reportUnknownCommand(
  name: string,
  output: ReturnType<typeof readOutputOptions>,
  rootHint: boolean,
): void {
  const mode = pickMode(output);
  if (mode === 'tty') {
    caretError(`unknown command '${name}'`, {
      hint: rootHint
        ? 'run `optical-center --help` for the full list of commands.'
        : 'run `optical-center help` for the full list of commands.',
    });
    return;
  }
  writeStderr(`error: unknown command '${name}'`, output);
  if (rootHint) {
    writeStderr('run `optical-center --help` for the full list', output);
  }
}

main().then(
  (code) => {
    process.exit(code);
  },
  (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    if (process.stdout.isTTY === true && !process.argv.includes('--json')) {
      const opts: Parameters<typeof caretError>[1] = {
        hint: 'this is a bug. please report it with the command and stack above.',
      };
      if (stack !== undefined && stack !== message) {
        opts.body = stack;
      }
      caretError(message, opts);
    } else {
      process.stderr.write(`fatal: ${stack ?? message}\n`);
    }
    process.exit(3);
  },
);
