/**
 * `optical-center clear-cache [--all]` — wipe the on-disk cache.
 *
 * Without `--all` only the current algorithm-version directory is
 * removed; older versions stay as garbage and can be inspected. With
 * `--all` the whole `optical-center` cache root disappears.
 */

import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { defaultCacheDir } from '../../cache/index.js';
import { ALGORITHM_VERSION } from '../../core/version.js';

import { error as caretError } from '../caret/components/error.js';
import { success as caretSuccess } from '../caret/components/message.js';

import { getStringFlag, getBoolFlag } from '../argv.js';
import { readOutputOptions, writeJson, writeStderr, writeStdout } from '../output.js';
import { pickMode } from '../render.js';

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
  } catch (err) {
    const mode = pickMode(output);
    if (mode === 'tty') {
      caretError(`failed to remove ${target}`, { body: describe(err) });
    } else {
      writeStderr(`error: failed to remove ${target}: ${describe(err)}`, output);
    }
    return 3;
  }

  const result = { cleared: target, scope: all ? 'all' : 'current-version' };
  const mode = pickMode(output);
  if (mode === 'json') {
    writeJson('clear-cache', result, output);
  } else if (mode === 'tty') {
    caretSuccess(`cleared ${target}`);
  } else {
    writeStdout(`cleared ${target}`, output);
  }
  return 0;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
