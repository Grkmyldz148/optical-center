/**
 * Real-world scenario matrix for `optical-center init`.
 *
 * Every scaffold here replicates byte-for-byte what the actual tooling
 * generates (`npm create vite@latest`, `npm create astro@latest`,
 * `npx tailwindcss init -p`, CRA babel configs…), then runs init
 * against it and asserts three things:
 *
 *   1. the right file was patched/created,
 *   2. the wiring is exactly what the integration docs prescribe,
 *   3. the resulting file still PARSES — every patched config goes
 *      through Babel's parser, so a regression that produces broken
 *      JS/TS fails loudly here, not in some user's build.
 */

import { parseSync } from '@babel/core';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runInit } from '../../src/cli/commands/init.js';
import { detectProject } from '../../src/cli/init/detect.js';

const FLAGS = { yes: true, 'no-install': true } as const;

async function makeProject(
  packageJson: Record<string, unknown>,
  files: Record<string, string> = {},
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'oc-scenario-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

/** The patched config must still be syntactically valid JS/TS. */
function assertParses(code: string, filename: string): void {
  expect(
    () =>
      parseSync(code, {
        filename,
        babelrc: false,
        configFile: false,
        parserOpts: { sourceType: 'unambiguous', plugins: ['typescript'] },
      }),
    `patched ${filename} no longer parses:\n${code}`,
  ).not.toThrow();
}

async function readAndParse(dir: string, file: string): Promise<string> {
  const content = await readFile(join(dir, file), 'utf8');
  assertParses(content, file);
  return content;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// Fresh Vite scaffolds — exactly what `npm create vite@latest` emits
// ────────────────────────────────────────────────────────────────────

describe('fresh react + vite project (react-ts template)', () => {
  const VITE_CONFIG = [
    `import { defineConfig } from 'vite'`,
    `import react from '@vitejs/plugin-react'`,
    '',
    '// https://vite.dev/config/',
    'export default defineConfig({',
    '  plugins: [react()],',
    '})',
    '',
  ].join('\n');

  const PACKAGE_JSON = {
    name: 'fresh-react-app',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview' },
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.4',
      typescript: '~5.7.2',
      vite: '^6.0.5',
    },
  };

  it('detects vite and patches the scaffold config', async () => {
    const dir = await makeProject(PACKAGE_JSON, { 'vite.config.ts': VITE_CONFIG });
    expect(await runInit([dir], FLAGS)).toBe(0);

    const config = await readAndParse(dir, 'vite.config.ts');
    expect(config).toContain(`import opticalCenter from 'optical-center/vite';`);
    expect(config).toContain('plugins: [opticalCenter(), react()]');
    // import lands after the scaffold's own imports, before the comment
    const lines = config.split('\n');
    expect(lines.indexOf(`import opticalCenter from 'optical-center/vite';`)).toBe(2);
  });

  it('is idempotent on the scaffold', async () => {
    const dir = await makeProject(PACKAGE_JSON, { 'vite.config.ts': VITE_CONFIG });
    await runInit([dir], FLAGS);
    const once = await readFile(join(dir, 'vite.config.ts'), 'utf8');
    expect(await runInit([dir], FLAGS)).toBe(0);
    expect(await readFile(join(dir, 'vite.config.ts'), 'utf8')).toBe(once);
  });
});

describe('fresh vanilla HTML + vite project (vanilla template)', () => {
  // The vanilla template ships NO vite.config at all — only index.html.
  const PACKAGE_JSON = {
    name: 'vanilla-app',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    devDependencies: { vite: '^6.0.5' },
  };

  it('creates vite.config.js from scratch (no TypeScript)', async () => {
    const dir = await makeProject(PACKAGE_JSON, {
      'index.html': '<!doctype html><html><body><div id="app"></div></body></html>',
    });
    expect(await runInit([dir], FLAGS)).toBe(0);

    expect(existsSync(join(dir, 'vite.config.ts'))).toBe(false);
    const config = await readAndParse(dir, 'vite.config.js');
    expect(config).toContain(`import { defineConfig } from 'vite';`);
    expect(config).toContain('plugins: [opticalCenter()]');
  });

  it('creates vite.config.ts when the template is vanilla-ts', async () => {
    const dir = await makeProject(
      { ...PACKAGE_JSON, devDependencies: { vite: '^6.0.5', typescript: '~5.7.2' } },
      { 'index.html': '<!doctype html><html></html>' },
    );
    expect(await runInit([dir], FLAGS)).toBe(0);
    await readAndParse(dir, 'vite.config.ts');
  });
});

// ────────────────────────────────────────────────────────────────────
// Vite config shape variants seen in the wild
// ────────────────────────────────────────────────────────────────────

describe('vite config shapes', () => {
  const PKG = { type: 'module', devDependencies: { vite: '^6.0.0' } };

  it('arrow-function config: defineConfig(({ mode }) => ({ … }))', async () => {
    const dir = await makeProject(PKG, {
      'vite.config.ts': [
        `import { defineConfig } from 'vite'`,
        `import react from '@vitejs/plugin-react'`,
        '',
        'export default defineConfig(({ mode }) => ({',
        `  plugins: [react()],`,
        `  base: mode === 'production' ? '/app/' : '/',`,
        '}))',
        '',
      ].join('\n'),
    });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'vite.config.ts');
    expect(config).toContain('plugins: [opticalCenter(), react()]');
  });

  it('config without a plugins array gains one inside defineConfig({…})', async () => {
    const dir = await makeProject(PKG, {
      'vite.config.ts': [
        `import { defineConfig } from 'vite'`,
        '',
        'export default defineConfig({',
        `  build: { outDir: 'build' },`,
        '})',
        '',
      ].join('\n'),
    });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'vite.config.ts');
    expect(config).toContain('plugins: [opticalCenter()],');
    expect(config).toContain(`build: { outDir: 'build' }`);
  });

  it('plain-object config (no defineConfig) still patches', async () => {
    const dir = await makeProject(PKG, {
      'vite.config.js': `export default {\n  plugins: [],\n};\n`,
    });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'vite.config.js');
    expect(config).toContain('plugins: [opticalCenter()]');
  });

  it('plugins array containing comments and strings survives', async () => {
    const dir = await makeProject(PKG, {
      'vite.config.ts': [
        `import { defineConfig } from 'vite'`,
        `import react from '@vitejs/plugin-react'`,
        '',
        'export default defineConfig({',
        '  plugins: [',
        '    // the "][" in this comment must not break bracket matching',
        `    react({ jsxImportSource: '@emotion/react' }),`,
        '  ],',
        '})',
        '',
      ].join('\n'),
    });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'vite.config.ts');
    expect(config).toContain('plugins: [opticalCenter(),');
  });

  it('unrecognisable config falls back to a manual snippet with exit 1', async () => {
    const dir = await makeProject(PKG, {
      'vite.config.ts': `import { makeConfig } from './tooling';\nexport default makeConfig();\n`,
    });
    const before = await readFile(join(dir, 'vite.config.ts'), 'utf8');
    expect(await runInit([dir], FLAGS)).toBe(1);
    // nothing was written — the file is untouched
    expect(await readFile(join(dir, 'vite.config.ts'), 'utf8')).toBe(before);
  });
});

// ────────────────────────────────────────────────────────────────────
// Fresh Astro scaffolds — what `npm create astro@latest` emits
// ────────────────────────────────────────────────────────────────────

describe('fresh astro project', () => {
  const PKG = {
    name: 'astro-app',
    type: 'module',
    version: '0.0.1',
    dependencies: { astro: '^5.0.0' },
  };

  it('patches the empty scaffold config: defineConfig({})', async () => {
    const dir = await makeProject(PKG, {
      'astro.config.mjs': [
        '// @ts-check',
        `import { defineConfig } from 'astro/config';`,
        '',
        '// https://astro.build/config',
        'export default defineConfig({});',
        '',
      ].join('\n'),
    });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'astro.config.mjs');
    expect(config).toContain(`import opticalCenter from 'optical-center/astro';`);
    expect(config).toContain('integrations: [opticalCenter()],');
  });

  it('prepends to an existing integrations array', async () => {
    const dir = await makeProject(PKG, {
      'astro.config.mjs': [
        `import { defineConfig } from 'astro/config';`,
        `import react from '@astrojs/react';`,
        `import sitemap from '@astrojs/sitemap';`,
        '',
        'export default defineConfig({',
        `  site: 'https://example.com',`,
        '  integrations: [react(), sitemap()],',
        '});',
        '',
      ].join('\n'),
    });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'astro.config.mjs');
    expect(config).toContain('integrations: [opticalCenter(), react(), sitemap()]');
  });

  it('astro wins detection over vite when both are present', async () => {
    const dir = await makeProject(
      { ...PKG, devDependencies: { vite: '^6.0.0' } },
      { 'astro.config.mjs': `import { defineConfig } from 'astro/config';\nexport default defineConfig({});\n` },
    );
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'astro.config.mjs');
    expect(config).toContain('optical-center/astro');
  });

  it('creates astro.config.mjs when missing', async () => {
    const dir = await makeProject(PKG);
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'astro.config.mjs');
    expect(config).toContain(`import { defineConfig } from 'astro/config';`);
    expect(config).toContain('integrations: [opticalCenter()]');
  });
});

// ────────────────────────────────────────────────────────────────────
// Tailwind — `npx tailwindcss init -p` output (v3) and v4 (no config)
// ────────────────────────────────────────────────────────────────────

describe('tailwind projects', () => {
  it('tailwind v3 scaffold (`tailwindcss init -p`, CJS): patches both configs', async () => {
    // `tailwindcss init -p` emits exactly these two CJS files.
    const dir = await makeProject(
      { name: 'tw-app', devDependencies: { tailwindcss: '^3.4.0', postcss: '^8.4.0', autoprefixer: '^10.0.0' } },
      {
        'tailwind.config.js': [
          '/** @type {import(\'tailwindcss\').Config} */',
          'module.exports = {',
          '  content: [],',
          '  theme: {',
          '    extend: {},',
          '  },',
          '  plugins: [],',
          '}',
          '',
        ].join('\n'),
        'postcss.config.js': [
          'module.exports = {',
          '  plugins: {',
          '    tailwindcss: {},',
          '    autoprefixer: {},',
          '  },',
          '}',
          '',
        ].join('\n'),
      },
    );
    // object-form postcss → manual snippet → exit 1, tailwind config patched
    expect(await runInit([dir], { ...FLAGS, integration: 'tailwind' })).toBe(1);

    const tailwind = await readAndParse(dir, 'tailwind.config.js');
    expect(tailwind).toContain("const opticalCenter = require('optical-center/tailwind');");
    expect(tailwind).toContain('plugins: [opticalCenter]');
    // postcss object form must NOT be silently mangled
    const postcss = await readFile(join(dir, 'postcss.config.js'), 'utf8');
    expect(postcss).not.toContain('optical-center');
  });

  it('tailwind v3 ESM project with array-form postcss: fully automatic', async () => {
    const dir = await makeProject(
      { type: 'module', devDependencies: { tailwindcss: '^3.4.0' } },
      {
        'tailwind.config.js': `export default {\n  content: ['./src/**/*.html'],\n  plugins: [require('@tailwindcss/forms')],\n};\n`,
        'postcss.config.js': `import tailwindcss from 'tailwindcss';\nimport autoprefixer from 'autoprefixer';\n\nexport default {\n  plugins: [tailwindcss(), autoprefixer()],\n};\n`,
      },
    );
    expect(await runInit([dir], { ...FLAGS, integration: 'tailwind' })).toBe(0);

    const tailwind = await readAndParse(dir, 'tailwind.config.js');
    expect(tailwind).toContain("plugins: [require('@tailwindcss/forms'), opticalCenter]");
    const postcss = await readAndParse(dir, 'postcss.config.js');
    // MUST come after tailwindcss — tailwind emits the directive,
    // optical-center resolves it
    expect(postcss).toContain('plugins: [tailwindcss(), autoprefixer(), opticalCenter()]');
  });

  it('tailwind v4 (no config file): reports the manual path, never invents a config', async () => {
    const dir = await makeProject({
      type: 'module',
      devDependencies: { tailwindcss: '^4.0.0' },
    });
    expect(await runInit([dir], { ...FLAGS, integration: 'tailwind' })).toBe(1);
    expect(existsSync(join(dir, 'tailwind.config.js'))).toBe(false);
    // the postcss half still gets created
    await readAndParse(dir, 'postcss.config.js');
  });
});

// ────────────────────────────────────────────────────────────────────
// Babel — CRA-style configs
// ────────────────────────────────────────────────────────────────────

describe('babel projects', () => {
  it('babel.config.js (CJS, CRA-style): plugin lands FIRST in the array', async () => {
    const dir = await makeProject(
      { devDependencies: { '@babel/core': '^7.26.0' } },
      {
        'babel.config.js': [
          'module.exports = {',
          "  presets: ['@babel/preset-env', '@babel/preset-react'],",
          "  plugins: ['@babel/plugin-transform-runtime'],",
          '};',
          '',
        ].join('\n'),
      },
    );
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'babel.config.js');
    expect(config).toContain(
      "plugins: ['optical-center/babel', '@babel/plugin-transform-runtime']",
    );
  });

  it('.babelrc without a plugins key gains one', async () => {
    const dir = await makeProject(
      { devDependencies: { '@babel/core': '^7.26.0' } },
      { '.babelrc': JSON.stringify({ presets: ['@babel/preset-react'] }, null, 2) },
    );
    expect(await runInit([dir], FLAGS)).toBe(0);
    const rc = JSON.parse(await readFile(join(dir, '.babelrc'), 'utf8')) as {
      presets: string[];
      plugins: string[];
    };
    expect(rc.plugins).toEqual(['optical-center/babel']);
    expect(rc.presets).toEqual(['@babel/preset-react']); // untouched
  });

  it('no babel config at all: creates .babelrc.json', async () => {
    const dir = await makeProject({ devDependencies: { '@babel/core': '^7.26.0' } });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const rc = JSON.parse(await readFile(join(dir, '.babelrc.json'), 'utf8')) as {
      plugins: string[];
    };
    expect(rc.plugins).toEqual(['optical-center/babel']);
  });
});

// ────────────────────────────────────────────────────────────────────
// PostCSS standalone + package-manager / dependency matrix
// ────────────────────────────────────────────────────────────────────

describe('postcss standalone', () => {
  it('CJS package (no "type": "module") gets a require-style postcss.config.cjs', async () => {
    const dir = await makeProject({ devDependencies: { postcss: '^8.4.0' } });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'postcss.config.cjs');
    expect(config).toContain("const opticalCenter = require('optical-center/postcss');");
    expect(config).toContain('module.exports = {');
  });

  it('ESM package gets an import-style postcss.config.js', async () => {
    const dir = await makeProject({ type: 'module', devDependencies: { postcss: '^8.4.0' } });
    expect(await runInit([dir], FLAGS)).toBe(0);
    const config = await readAndParse(dir, 'postcss.config.js');
    expect(config).toContain(`import opticalCenter from 'optical-center/postcss';`);
  });
});

describe('package manager and dependency detection', () => {
  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ])('lockfile %s → %s', async (lockfile, pm) => {
    const dir = await makeProject({ devDependencies: { vite: '^6.0.0' } }, { [lockfile]: '' });
    expect(detectProject(dir).packageManager).toBe(pm);
  });

  it('recognises optical-center already in devDependencies', async () => {
    const dir = await makeProject({
      type: 'module',
      devDependencies: { vite: '^6.0.0', 'optical-center': '^0.2.0' },
    });
    expect(detectProject(dir).hasOpticalCenter).toBe(true);
    // and init reports it instead of trying to install
    const lines: string[] = [];
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(((chunk: string | Uint8Array) => {
        lines.push(String(chunk));
        return true;
      }) as typeof process.stdout.write);
    await runInit([dir], { yes: true });
    spy.mockRestore();
    expect(lines.join('')).toContain('already in package.json');
  });
});

// ────────────────────────────────────────────────────────────────────
// JSON envelope — the agent-facing contract
// ────────────────────────────────────────────────────────────────────

describe('init --json envelope', () => {
  it('emits one NDJSON envelope with the full action report', async () => {
    const dir = await makeProject(
      { type: 'module', devDependencies: { vite: '^6.0.0' } },
      { 'vite.config.ts': `export default { plugins: [] };\n` },
    );
    const lines: string[] = [];
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(((chunk: string | Uint8Array) => {
        lines.push(String(chunk));
        return true;
      }) as typeof process.stdout.write);
    const code = await runInit([dir], { ...FLAGS, json: true });
    spy.mockRestore();

    expect(code).toBe(0);
    const envelope = JSON.parse(lines.join('').trim()) as {
      schemaVersion: number;
      command: string;
      result: {
        integration: string;
        packageManager: string;
        installed: string;
        results: Array<{ file: string; status: string }>;
      };
    };
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.command).toBe('init');
    expect(envelope.result.integration).toBe('vite');
    expect(envelope.result.results).toEqual([{ file: 'vite.config.ts', status: 'patched' }]);
  });

  it('--dry-run --json reports the plan without touching disk', async () => {
    const dir = await makeProject(
      { type: 'module', devDependencies: { vite: '^6.0.0' } },
      { 'vite.config.ts': `export default { plugins: [] };\n` },
    );
    const before = await readFile(join(dir, 'vite.config.ts'), 'utf8');
    const lines: string[] = [];
    const spy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(((chunk: string | Uint8Array) => {
        lines.push(String(chunk));
        return true;
      }) as typeof process.stdout.write);
    const code = await runInit([dir], { ...FLAGS, json: true, 'dry-run': true });
    spy.mockRestore();

    expect(code).toBe(0);
    expect(await readFile(join(dir, 'vite.config.ts'), 'utf8')).toBe(before);
    const envelope = JSON.parse(lines.join('').trim()) as {
      result: { dryRun: boolean; results: Array<{ status: string }> };
    };
    expect(envelope.result.dryRun).toBe(true);
    expect(envelope.result.results[0]!.status).toBe('patched');
  });
});
