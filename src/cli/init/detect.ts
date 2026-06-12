/**
 * Project detection for `optical-center init`.
 *
 * Reads the target directory's package.json and config files to work
 * out (a) which integration fits the project, (b) which package
 * manager owns the lockfile, and (c) whether optical-center is
 * already a dependency. Pure filesystem reads — no writes here.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const INTEGRATIONS = ['vite', 'astro', 'postcss', 'tailwind', 'babel'] as const;
export type Integration = (typeof INTEGRATIONS)[number];

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export const CONFIG_CANDIDATES: Readonly<Record<Integration, ReadonlyArray<string>>> = {
  vite: ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs'],
  astro: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'],
  postcss: ['postcss.config.js', 'postcss.config.mjs', 'postcss.config.cjs'],
  tailwind: [
    'tailwind.config.ts',
    'tailwind.config.js',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
  ],
  babel: ['babel.config.js', 'babel.config.mjs', 'babel.config.cjs', '.babelrc', '.babelrc.json'],
};

export interface ProjectDetection {
  /** Absolute project directory the detection ran against. */
  readonly dir: string;
  /** Parsed package.json, or null when the file is missing/invalid. */
  readonly packageJson: Record<string, unknown> | null;
  /** All dependencies + devDependencies names. */
  readonly deps: ReadonlySet<string>;
  /** Is optical-center already declared as a dependency? */
  readonly hasOpticalCenter: boolean;
  /** Is the package ESM (`"type": "module"`)? */
  readonly isEsm: boolean;
  /** Does the project use TypeScript? */
  readonly hasTypeScript: boolean;
  readonly packageManager: PackageManager;
  /** Existing config file (first candidate hit) per integration. */
  readonly configFiles: Readonly<Partial<Record<Integration, string>>>;
  /** Integrations that fit this project, best match first. */
  readonly detected: ReadonlyArray<Integration>;
}

export function detectProject(dir: string): ProjectDetection {
  const packageJson = readPackageJson(dir);
  const deps = collectDeps(packageJson);

  const configFiles: Partial<Record<Integration, string>> = {};
  for (const integration of INTEGRATIONS) {
    for (const candidate of CONFIG_CANDIDATES[integration]) {
      if (existsSync(join(dir, candidate))) {
        configFiles[integration] = candidate;
        break;
      }
    }
  }

  const detected: Integration[] = [];
  if (deps.has('astro') || configFiles.astro !== undefined) detected.push('astro');
  if (deps.has('vite') || configFiles.vite !== undefined) detected.push('vite');
  if (deps.has('tailwindcss') || configFiles.tailwind !== undefined) detected.push('tailwind');
  if (deps.has('postcss') || configFiles.postcss !== undefined) detected.push('postcss');
  if (
    configFiles.babel !== undefined ||
    deps.has('@babel/core') ||
    deps.has('babel-loader')
  ) {
    detected.push('babel');
  }

  return {
    dir,
    packageJson,
    deps,
    hasOpticalCenter: deps.has('optical-center'),
    isEsm: packageJson?.['type'] === 'module',
    hasTypeScript: deps.has('typescript') || existsSync(join(dir, 'tsconfig.json')),
    packageManager: detectPackageManager(dir),
    configFiles,
    detected,
  };
}

export function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun';
  return 'npm';
}

export function installArgs(pm: PackageManager): ReadonlyArray<string> {
  switch (pm) {
    case 'pnpm':
      return ['add', '-D', 'optical-center'];
    case 'yarn':
      return ['add', '-D', 'optical-center'];
    case 'bun':
      return ['add', '-d', 'optical-center'];
    case 'npm':
      return ['install', '-D', 'optical-center'];
  }
}

export function isIntegration(name: string): name is Integration {
  return (INTEGRATIONS as ReadonlyArray<string>).includes(name);
}

function readPackageJson(dir: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(join(dir, 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function collectDeps(packageJson: Record<string, unknown> | null): ReadonlySet<string> {
  const names = new Set<string>();
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const block = packageJson?.[field];
    if (typeof block === 'object' && block !== null) {
      for (const key of Object.keys(block)) names.add(key);
    }
  }
  return names;
}
