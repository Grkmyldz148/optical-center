import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runInit } from '../../src/cli/commands/init.js';
import { detectProject } from '../../src/cli/init/detect.js';
import { findMatchingBracket, insertImport, insertIntoArray } from '../../src/cli/init/patch.js';

async function makeProject(
  packageJson: Record<string, unknown>,
  files: Record<string, string> = {},
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'oc-init-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

// runInit in tests: stdout is not a TTY → text mode, no prompts.
const FLAGS = { yes: true, 'no-install': true } as const;

describe('detectProject', () => {
  it('detects a react-vite project with pnpm', async () => {
    const dir = await makeProject(
      { type: 'module', devDependencies: { vite: '^7.0.0', typescript: '^5.0.0' } },
      { 'vite.config.ts': 'export default {}', 'pnpm-lock.yaml': '' },
    );
    const d = detectProject(dir);
    expect(d.detected[0]).toBe('vite');
    expect(d.packageManager).toBe('pnpm');
    expect(d.hasTypeScript).toBe(true);
    expect(d.hasOpticalCenter).toBe(false);
  });

  it('prefers astro over vite when both are present', async () => {
    const dir = await makeProject({
      dependencies: { astro: '^5.0.0' },
      devDependencies: { vite: '^7.0.0' },
    });
    expect(detectProject(dir).detected[0]).toBe('astro');
  });
});

describe('patch helpers', () => {
  it('findMatchingBracket skips strings and comments', () => {
    const src = `[ '][', /* ] */ x ]`;
    expect(findMatchingBracket(src, 0)).toBe(src.length - 1);
  });

  it('insertIntoArray start and end', () => {
    const src = `export default { plugins: [react(), foo()] }`;
    expect(insertIntoArray(src, /plugins\s*:\s*\[/, 'oc()', 'start')).toContain(
      'plugins: [oc(), react()',
    );
    expect(insertIntoArray(src, /plugins\s*:\s*\[/, 'oc()', 'end')).toContain(
      'foo(), oc()]',
    );
  });

  it('insertIntoArray handles empty arrays without dangling commas', () => {
    const src = `export default { plugins: [] }`;
    expect(insertIntoArray(src, /plugins\s*:\s*\[/, 'oc()', 'start')).toContain('[oc()]');
    expect(insertIntoArray(src, /plugins\s*:\s*\[/, 'oc()', 'end')).toContain('[oc()]');
  });

  it('insertImport places the line after the last import', () => {
    const src = `import a from 'a';\nimport b from 'b';\n\nexport default {};\n`;
    const out = insertImport(src, `import oc from 'oc';`);
    expect(out.split('\n')[2]).toBe(`import oc from 'oc';`);
  });
});

describe('runInit', () => {
  it('patches an existing vite.config.ts', async () => {
    const dir = await makeProject(
      { type: 'module', devDependencies: { vite: '^7.0.0' } },
      {
        'vite.config.ts': [
          `import { defineConfig } from 'vite';`,
          `import react from '@vitejs/plugin-react';`,
          '',
          'export default defineConfig({',
          '  plugins: [react()],',
          '});',
          '',
        ].join('\n'),
      },
    );
    const code = await runInit([dir], FLAGS);
    expect(code).toBe(0);
    const config = await readFile(join(dir, 'vite.config.ts'), 'utf8');
    expect(config).toContain(`import opticalCenter from 'optical-center/vite';`);
    expect(config).toContain('plugins: [opticalCenter(), react()]');
  });

  it('creates a postcss config when none exists', async () => {
    const dir = await makeProject({ type: 'module', devDependencies: { postcss: '^8.0.0' } });
    const code = await runInit([dir], { ...FLAGS, integration: 'postcss' });
    expect(code).toBe(0);
    const config = await readFile(join(dir, 'postcss.config.js'), 'utf8');
    expect(config).toContain(`import opticalCenter from 'optical-center/postcss';`);
  });

  it('appends the postcss plugin AFTER tailwind in an existing array config', async () => {
    const dir = await makeProject(
      { type: 'module', devDependencies: { tailwindcss: '^3.0.0' } },
      {
        'postcss.config.js': [
          `import tailwindcss from 'tailwindcss';`,
          '',
          'export default {',
          '  plugins: [tailwindcss()],',
          '};',
          '',
        ].join('\n'),
        'tailwind.config.js': `export default {\n  plugins: [],\n};\n`,
      },
    );
    const code = await runInit([dir], { ...FLAGS, integration: 'tailwind' });
    expect(code).toBe(0);
    const postcss = await readFile(join(dir, 'postcss.config.js'), 'utf8');
    expect(postcss).toContain('plugins: [tailwindcss(), opticalCenter()]');
    const tailwind = await readFile(join(dir, 'tailwind.config.js'), 'utf8');
    expect(tailwind).toContain('plugins: [opticalCenter]');
  });

  it('is idempotent — a second run reports already configured', async () => {
    const dir = await makeProject(
      { type: 'module', devDependencies: { vite: '^7.0.0' } },
      { 'vite.config.ts': `export default { plugins: [] };\n` },
    );
    await runInit([dir], FLAGS);
    const first = await readFile(join(dir, 'vite.config.ts'), 'utf8');
    const code = await runInit([dir], FLAGS);
    expect(code).toBe(0);
    expect(await readFile(join(dir, 'vite.config.ts'), 'utf8')).toBe(first);
  });

  it('dry-run writes nothing', async () => {
    const dir = await makeProject(
      { type: 'module', devDependencies: { vite: '^7.0.0' } },
      { 'vite.config.ts': `export default { plugins: [] };\n` },
    );
    const before = await readFile(join(dir, 'vite.config.ts'), 'utf8');
    const code = await runInit([dir], { ...FLAGS, 'dry-run': true });
    expect(code).toBe(0);
    expect(await readFile(join(dir, 'vite.config.ts'), 'utf8')).toBe(before);
  });

  it('patches JSON babel configs', async () => {
    const dir = await makeProject(
      { devDependencies: { '@babel/core': '^7.0.0' } },
      { '.babelrc': JSON.stringify({ presets: ['@babel/preset-react'], plugins: ['x'] }) },
    );
    const code = await runInit([dir], { ...FLAGS, integration: 'babel' });
    expect(code).toBe(0);
    const rc = JSON.parse(await readFile(join(dir, '.babelrc'), 'utf8')) as {
      plugins: string[];
    };
    expect(rc.plugins[0]).toBe('optical-center/babel');
    expect(rc.plugins[1]).toBe('x');
  });

  it('rejects an unknown integration with exit 3', async () => {
    const dir = await makeProject({});
    expect(await runInit([dir], { ...FLAGS, integration: 'webpack' })).toBe(3);
  });

  it('fails with exit 2 when no package.json exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oc-init-empty-'));
    expect(await runInit([dir], FLAGS)).toBe(2);
  });

  it('fails with exit 2 when nothing is detected and no flag is given', async () => {
    const dir = await makeProject({});
    expect(await runInit([dir], FLAGS)).toBe(2);
  });
});
