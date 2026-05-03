/**
 * Tiny argv parser. We avoid a `commander` / `yargs` dep for two reasons:
 *
 *   1. The CLI surface is small (five commands, one digit's worth of
 *      flags each).
 *   2. Stable parser semantics matter for the Output Contract: agents
 *      depend on `--json`, `--strict`, and exit codes never silently
 *      changing meaning under us.
 *
 * Flag conventions (all unambiguous, no positional/value heuristics):
 *
 *   --flag         → boolean true
 *   --key=value    → string value
 *   --key value    → string value (the next token, if it isn't a flag)
 *
 * Positional arguments accumulate in order. The first positional is the
 * command name.
 */

export interface ParsedArgs {
  readonly command: string | undefined;
  readonly positionals: ReadonlyArray<string>;
  readonly flags: Readonly<Record<string, string | boolean>>;
}

export function parseArgv(argv: ReadonlyArray<string>): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eq = body.indexOf('=');
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[body] = next;
        i++;
      } else {
        flags[body] = true;
      }
      continue;
    }

    if (command === undefined) {
      command = arg;
    } else {
      positionals.push(arg);
    }
  }

  return { command, positionals, flags };
}

export function getStringFlag(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): string | undefined {
  const v = flags[name];
  return typeof v === 'string' ? v : undefined;
}

export function getBoolFlag(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): boolean {
  return flags[name] === true || flags[name] === 'true';
}
