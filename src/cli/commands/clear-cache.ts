/**
 * `optical-center clear-cache [--all]` — wipe the on-disk cache.
 *
 * Without `--all` only the current algorithm-version directory is
 * removed; older versions stay as garbage and can be inspected. With
 * `--all` the whole `optical-center` cache root disappears.
 */

import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { defaultCacheDir } from '../../cache.js';
import { ALGORITHM_VERSION } from '../../version.js';

import { getStringFlag, getBoolFlag } from '../argv.js';
import { readOutputOptions, writeJson, writeStderr, writeStdout } from '../output.js';

export async function runClearCache(
  _positionals: ReadonlyArray<string>,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  const output = readOutputOptions(flags);
  const all = getBoolFlag(flags, 'all');
  const dir = getStringFlag(flags, 'cache-dir') ?? defaultCacheDir();
  const target = all ? dir : join(dir, ALGORITHM_VERSION);

  try {
    await rm(target, { recursive: true, force: true });
  } catch (error) {
    writeStderr(`error: failed to remove ${target}: ${describe(error)}`, output);
    return 3;
  }

  const result = { cleared: target, scope: all ? 'all' : 'current-version' };
  if (output.json) {
    writeJson('clear-cache', result, output);
  } else {
    writeStdout(`cleared ${target}`, output);
  }
  return 0;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
