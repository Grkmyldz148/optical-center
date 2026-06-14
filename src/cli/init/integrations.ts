/**
 * Per-integration setup plans for `optical-center init`.
 *
 * Each integration knows how to wire optical-center into the project's
 * config: patch an existing file when its shape is recognisable, create
 * a minimal one when it's missing, and fall back to a paste-ready
 * snippet (`status: 'manual'`) when the file exists but can't be edited
 * confidently. `dryRun` computes everything without touching disk.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Integration, ProjectDetection } from './detect.js';
import { insertImport, insertIntoArray } from './patch.js';

export interface PatchResult {
  /** Path relative to the project dir. */
  readonly file: string;
  readonly status: 'patched' | 'created' | 'already' | 'manual';
  /** Paste-ready code for 'manual' results. */
  readonly snippet?: string;
  readonly note?: string;
}

export function applyIntegration(
  integration: Integration,
  detection: ProjectDetection,
  dryRun: boolean,
): PatchResult[] {
  switch (integration) {
    case 'vite':
      return [patchPluginArray(detection, dryRun, VITE)];
    case 'astro':
      return [patchPluginArray(detection, dryRun, ASTRO)];
    case 'postcss':
      return [patchPostcss(detection, dryRun)];
    case 'tailwind':
      // The Tailwind plugin only emits the directive — the PostCSS
      // plugin resolves it, so both configs need wiring.
      return [patchTailwind(detection, dryRun), patchPostcss(detection, dryRun)];
    case 'babel':
      return [patchBabel(detection, dryRun)];
  }
}

/** One-line usage reminder per integration, shown after setup. */
export function nextSteps(integration: Integration): ReadonlyArray<string> {
  switch (integration) {
    case 'vite':
    case 'astro':
      return [
        'CSS:  .icon { optical-center: auto; }',
        'JSX/HTML:  <svg optical-center="auto">…</svg>',
      ];
    case 'postcss':
      return ['CSS:  .icon { background-image: url(\'icons/play.svg\'); optical-center: auto; }'];
    case 'tailwind':
      return ['Markup:  <div class="optical-center"><Play /></div>'];
    case 'babel':
      return ['JSX:  <svg optical-center="auto">…</svg>'];
  }
}

interface PluginArrayTarget {
  readonly integration: 'vite' | 'astro';
  readonly specifier: string;
  readonly arrayKey: 'plugins' | 'integrations';
  readonly defineConfigImport: string;
  readonly createFile: (detection: ProjectDetection) => string;
}

const VITE: PluginArrayTarget = {
  integration: 'vite',
  specifier: 'optical-center/vite',
  arrayKey: 'plugins',
  defineConfigImport: 'vite',
  createFile: (d) => (d.hasTypeScript ? 'vite.config.ts' : 'vite.config.js'),
};

const ASTRO: PluginArrayTarget = {
  integration: 'astro',
  specifier: 'optical-center/astro',
  arrayKey: 'integrations',
  defineConfigImport: 'astro/config',
  createFile: () => 'astro.config.mjs',
};

function patchPluginArray(
  detection: ProjectDetection,
  dryRun: boolean,
  target: PluginArrayTarget,
): PatchResult {
  const existing = detection.configFiles[target.integration];

  if (existing === undefined) {
    const file = target.createFile(detection);
    const content = [
      `import { defineConfig } from '${target.defineConfigImport}';`,
      `import opticalCenter from '${target.specifier}';`,
      '',
      'export default defineConfig({',
      `  ${target.arrayKey}: [opticalCenter()],`,
      '});',
      '',
    ].join('\n');
    if (!dryRun) writeFileSync(join(detection.dir, file), content);
    return { file, status: 'created' };
  }

  const path = join(detection.dir, existing);
  const source = readFileSync(path, 'utf8');
  if (source.includes(target.specifier)) {
    return { file: existing, status: 'already' };
  }

  const importLine = `import opticalCenter from '${target.specifier}';`;
  const anchor = new RegExp(`${target.arrayKey}\\s*:\\s*\\[`);
  let patched = insertIntoArray(source, anchor, 'opticalCenter()', 'start');
  if (patched === null) {
    // No array yet — add one right after `defineConfig({`.
    const opener = /defineConfig\s*\(\s*\{/.exec(source);
    if (opener !== null) {
      const at = opener.index + opener[0].length;
      patched =
        source.slice(0, at) + `\n  ${target.arrayKey}: [opticalCenter()],` + source.slice(at);
    }
  }
  if (patched === null) {
    return {
      file: existing,
      status: 'manual',
      snippet: `${importLine}\n\n// add to the ${target.arrayKey} array:\n${target.arrayKey}: [opticalCenter(), /* … */],`,
      note: `couldn't find a ${target.arrayKey} array to patch`,
    };
  }
  if (!dryRun) writeFileSync(path, insertImport(patched, importLine));
  return { file: existing, status: 'patched' };
}

function patchPostcss(detection: ProjectDetection, dryRun: boolean): PatchResult {
  const existing = detection.configFiles.postcss;

  if (existing === undefined) {
    const cjs = !detection.isEsm;
    const file = cjs ? 'postcss.config.cjs' : 'postcss.config.js';
    const content = cjs
      ? [
          "const opticalCenter = require('optical-center/postcss');",
          '',
          'module.exports = {',
          '  plugins: [opticalCenter()],',
          '};',
          '',
        ].join('\n')
      : [
          "import opticalCenter from 'optical-center/postcss';",
          '',
          'export default {',
          '  plugins: [opticalCenter()],',
          '};',
          '',
        ].join('\n');
    if (!dryRun) writeFileSync(join(detection.dir, file), content);
    return { file, status: 'created' };
  }

  const path = join(detection.dir, existing);
  const source = readFileSync(path, 'utf8');
  if (source.includes('optical-center/postcss')) {
    return { file: existing, status: 'already' };
  }

  const cjs = existing.endsWith('.cjs') || (!detection.isEsm && existing.endsWith('.js'));
  const importLine = cjs
    ? "const opticalCenter = require('optical-center/postcss');"
    : "import opticalCenter from 'optical-center/postcss';";

  // Array form — append at the END so it runs after Tailwind
  // (Tailwind emits the directive, optical-center resolves it).
  const arrayPatched = insertIntoArray(source, /plugins\s*:\s*\[/, 'opticalCenter()', 'end');
  if (arrayPatched !== null) {
    if (!dryRun) writeFileSync(path, insertImport(arrayPatched, importLine));
    return { file: existing, status: 'patched' };
  }

  // Object form (`plugins: { tailwindcss: {} }`) — editing it in place
  // is brittle; hand the user a paste-ready snippet instead.
  if (/plugins\s*:\s*\{/.test(source)) {
    return {
      file: existing,
      status: 'manual',
      snippet: `plugins: {\n  /* …existing plugins… */\n  'optical-center/postcss': {},\n}`,
      note: 'object-form plugins detected — add the string key as the LAST entry',
    };
  }

  return {
    file: existing,
    status: 'manual',
    snippet: `${importLine}\n\n// add as the LAST entry of the plugins array:\nplugins: [/* … */, opticalCenter()],`,
    note: "couldn't find a plugins array to patch",
  };
}

function patchTailwind(detection: ProjectDetection, dryRun: boolean): PatchResult {
  const existing = detection.configFiles.tailwind;
  const snippet =
    "import opticalCenter from 'optical-center/tailwind';\n\n// add to the plugins array (no call — it's a plugin object):\nplugins: [opticalCenter],";

  if (existing === undefined) {
    // Tailwind v4 has no config file by default — the utility comes from
    // the PostCSS side; nothing to create here.
    return {
      file: 'tailwind.config.*',
      status: 'manual',
      snippet,
      note: 'no tailwind config found — if you are on Tailwind v3, add the plugin yourself',
    };
  }

  const path = join(detection.dir, existing);
  const source = readFileSync(path, 'utf8');
  if (source.includes('optical-center/tailwind')) {
    return { file: existing, status: 'already' };
  }

  const cjs = existing.endsWith('.cjs') || (!detection.isEsm && existing.endsWith('.js'));
  const importLine = cjs
    ? "const opticalCenter = require('optical-center/tailwind');"
    : "import opticalCenter from 'optical-center/tailwind';";

  const patched = insertIntoArray(source, /plugins\s*:\s*\[/, 'opticalCenter', 'end');
  if (patched === null) {
    return { file: existing, status: 'manual', snippet, note: "couldn't find a plugins array" };
  }
  if (!dryRun) writeFileSync(path, insertImport(patched, importLine));
  return { file: existing, status: 'patched' };
}

function patchBabel(detection: ProjectDetection, dryRun: boolean): PatchResult {
  const existing = detection.configFiles.babel;

  if (existing === undefined) {
    const content = JSON.stringify({ plugins: ['optical-center/babel'] }, null, 2) + '\n';
    if (!dryRun) writeFileSync(join(detection.dir, '.babelrc.json'), content);
    return { file: '.babelrc.json', status: 'created' };
  }

  const path = join(detection.dir, existing);
  const source = readFileSync(path, 'utf8');
  if (source.includes('optical-center/babel')) {
    return { file: existing, status: 'already' };
  }

  // JSON configs — parse, prepend, re-emit.
  if (existing === '.babelrc' || existing.endsWith('.json')) {
    try {
      const parsed: unknown = JSON.parse(source);
      if (typeof parsed === 'object' && parsed !== null) {
        const config = parsed as Record<string, unknown>;
        const plugins = Array.isArray(config['plugins']) ? config['plugins'] : [];
        config['plugins'] = ['optical-center/babel', ...plugins];
        if (!dryRun) writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
        return { file: existing, status: 'patched' };
      }
    } catch {
      // fall through to manual
    }
    return {
      file: existing,
      status: 'manual',
      snippet: '"plugins": ["optical-center/babel"]',
      note: "couldn't parse the JSON config",
    };
  }

  // JS configs — prepend to the plugins array (must run before presets,
  // which Babel already guarantees for plugins).
  const patched = insertIntoArray(source, /plugins\s*:\s*\[/, "'optical-center/babel'", 'start');
  if (patched === null) {
    return {
      file: existing,
      status: 'manual',
      snippet: "plugins: ['optical-center/babel', /* … */],",
      note: "couldn't find a plugins array",
    };
  }
  if (!dryRun) writeFileSync(path, patched);
  return { file: existing, status: 'patched' };
}
