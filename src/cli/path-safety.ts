/**
 * Path safety helpers for CLI orchestrators.
 *
 * The `transform` command walks a directory and writes files back to
 * disk. Without checks, a malicious or accidental path can:
 *
 *   1. Escape the working directory via symlinks pointing at /etc, $HOME,
 *      or another project. Even read-only access leaks file content if
 *      the SVG happens to start with credentials-shaped text.
 *   2. Take the output root somewhere unexpected (a typo'd cwd argument
 *      can have the CLI clobber files under `/`).
 *
 * The defaults are conservative:
 *
 *   - Inputs and outputs must resolve under the current working directory.
 *   - Symlinks that point outside the cwd are rejected.
 *   - Pass `--allow-outside-cwd` to opt out (e.g. CI runners that cd into
 *     a sandboxed dir before running and want to write to a sibling).
 */

import { realpath, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

export interface PathSafetyOptions {
  /** Working directory the path is checked against. Defaults to `process.cwd()`. */
  readonly cwd?: string;
  /**
   * Allow paths that resolve outside the working directory. Defaults to
   * `false` — the CLI surfaces this as `--allow-outside-cwd`.
   */
  readonly allowOutsideCwd?: boolean;
}

export interface PathCheck {
  readonly resolved: string;
  readonly real: string;
  readonly insideCwd: boolean;
  readonly isSymlink: boolean;
}

export class PathSafetyError extends Error {
  constructor(
    public readonly path: string,
    public readonly reason: 'escapes-cwd' | 'symlink-escape' | 'unreadable',
    detail?: string,
  ) {
    super(
      `path safety: ${path} ${reason}${detail ? ` (${detail})` : ''}; pass --allow-outside-cwd to override`,
    );
    this.name = 'PathSafetyError';
  }
}

/**
 * Resolve and validate a CLI path argument. Returns metadata that the
 * caller can use for further checks; throws `PathSafetyError` on
 * violations unless `allowOutsideCwd` is set.
 */
export async function checkPathSafety(
  input: string,
  options: PathSafetyOptions = {},
): Promise<PathCheck> {
  const rawCwd = options.cwd ?? process.cwd();
  const cwd = await realpathOr(rawCwd);
  const allowOutsideCwd = options.allowOutsideCwd === true;
  const resolved = resolve(rawCwd, input);

  let isSymlink = false;
  try {
    const lstat = await stat(resolved);
    isSymlink = lstat.isSymbolicLink?.() ?? false;
  } catch {
    // path may not exist yet (e.g. output root we'll create) — that's fine.
  }

  const real = await realpathWithFallback(resolved);
  const insideCwd = isInside(cwd, real);
  if (!allowOutsideCwd && !insideCwd) {
    throw new PathSafetyError(
      input,
      isSymlink ? 'symlink-escape' : 'escapes-cwd',
      `resolves to ${real}`,
    );
  }

  return { resolved, real, insideCwd, isSymlink };
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  if (rel === '') return true;
  return !rel.startsWith('..') && !rel.startsWith(`..${sep}`);
}

async function realpathOr(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

/**
 * realpath() the longest existing prefix of `path` and re-append the
 * non-existent tail. Lets us validate output roots that don't exist yet
 * while still resolving any symlink components in the parent chain.
 */
async function realpathWithFallback(path: string): Promise<string> {
  let current = path;
  const tail: string[] = [];
  while (current && current !== dirname(current)) {
    try {
      const real = await realpath(current);
      return tail.length === 0 ? real : resolve(real, ...tail.reverse());
    } catch {
      tail.push(current.slice(dirname(current).length + 1));
      current = dirname(current);
    }
  }
  return path;
}
