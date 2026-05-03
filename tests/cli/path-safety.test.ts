import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PathSafetyError,
  checkPathSafety,
} from '../../src/cli/path-safety.js';

describe('checkPathSafety', () => {
  it('accepts a path inside the working directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'oc-safe-'));
    const inner = join(cwd, 'icons');
    await mkdir(inner, { recursive: true });
    const result = await checkPathSafety('icons', { cwd });
    expect(result.insideCwd).toBe(true);
    expect(result.resolved).toBe(inner);
  });

  it('rejects a path that escapes the working directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'oc-safe-'));
    const outside = await mkdtemp(join(tmpdir(), 'oc-outside-'));
    await expect(
      checkPathSafety(outside, { cwd }),
    ).rejects.toBeInstanceOf(PathSafetyError);
  });

  it('allows escapes when allowOutsideCwd is set', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'oc-safe-'));
    const outside = await mkdtemp(join(tmpdir(), 'oc-outside-'));
    const result = await checkPathSafety(outside, { cwd, allowOutsideCwd: true });
    expect(result.insideCwd).toBe(false);
  });

  it('rejects symlinks that point outside the working directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'oc-safe-'));
    const outside = await mkdtemp(join(tmpdir(), 'oc-outside-'));
    await writeFile(join(outside, 'secret.txt'), 'TOP SECRET');
    const linkPath = join(cwd, 'link');
    await symlink(outside, linkPath);

    await expect(
      checkPathSafety('link', { cwd }),
    ).rejects.toBeInstanceOf(PathSafetyError);
  });

  it('does not throw on paths that do not exist yet (output roots)', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'oc-safe-'));
    const result = await checkPathSafety('does-not-exist-yet', { cwd });
    expect(result.insideCwd).toBe(true);
  });
});
