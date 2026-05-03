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
 */

import { parseArgv } from './argv.js';
import { runAnalyze } from './commands/analyze.js';
import { runClearCache } from './commands/clear-cache.js';
import { runInfo } from './commands/info.js';
import { runTransform } from './commands/transform.js';
import { runVersion } from './commands/version.js';
import { HELP_COMMANDS, HELP_ROOT } from './help.js';
import { readOutputOptions, writeStderr, writeStdout } from './output.js';

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgv(argv);
  const output = readOutputOptions(parsed.flags);

  if (parsed.flags['help'] === true || parsed.command === undefined) {
    writeStdout(HELP_ROOT, output);
    return parsed.command === undefined ? 0 : 0;
  }

  switch (parsed.command) {
    case 'help': {
      const target = parsed.positionals[0];
      const text = target ? HELP_COMMANDS[target] : HELP_ROOT;
      if (!text) {
        writeStderr(`error: unknown command '${target}'`, output);
        return 3;
      }
      writeStdout(text, output);
      return 0;
    }
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
      writeStderr(`error: unknown command '${parsed.command}'`, output);
      writeStderr('run `optical-center --help` for the full list', output);
      return 3;
  }
}

main().then(
  (code) => {
    process.exit(code);
  },
  (error: unknown) => {
    process.stderr.write(`fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(3);
  },
);
