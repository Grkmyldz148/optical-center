/**
 * `optical-center init [dir]` — wire optical-center into a project.
 *
 * Detects the project's framework (Vite, Astro, Tailwind, PostCSS,
 * Babel) and package manager, installs the dependency, and patches the
 * relevant config file. Two driving modes, same engine:
 *
 *   - Flags:        `optical-center init --integration vite --yes`
 *   - Interactive:  bare `optical-center init` in a TTY prompts with a
 *                   select (detected integration preselected) and a
 *                   confirm before installing.
 *
 * Flags:
 *   --integration=<vite|astro|postcss|tailwind|babel>
 *   --yes         Accept the detected defaults — never prompt.
 *   --no-install  Skip the package-manager install step.
 *   --pm=<npm|pnpm|yarn|bun>  Override lockfile detection.
 *   --dry-run     Report what would change without writing anything.
 *
 * Exit codes: 0 fully wired · 1 finished but a manual paste is needed
 * (snippet printed) · 2 install failed or nothing detected · 3 invalid
 * flag values.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { error as caretError } from '../caret/components/error.js';
import { keyValue } from '../caret/components/key-value.js';
import { success as caretSuccess, warning as caretWarning } from '../caret/components/message.js';
import { paragraph } from '../caret/components/paragraph.js';
import { select } from '../caret/components/select.js';
import { capability } from '../caret/lib/capability.js';

import { getStringFlag, getBoolFlag } from '../argv.js';
import {
  INTEGRATIONS,
  detectProject,
  installArgs,
  isIntegration,
  type Integration,
  type PackageManager,
  type ProjectDetection,
} from '../init/detect.js';
import { applyIntegration, nextSteps, type PatchResult } from '../init/integrations.js';
import { readOutputOptions, writeJson, writeStderr, writeStdout } from '../output.js';
import { pickMode } from '../render.js';

const INTEGRATION_HINTS: Readonly<Record<Integration, string>> = {
  vite: 'Vite plugin — covers CSS, JSX/TSX, and index.html.',
  astro: 'Astro integration — wraps the Vite plugin + .astro templates.',
  postcss: 'PostCSS plugin — bundler-agnostic CSS directive.',
  tailwind: 'Tailwind plugin — `optical-center` utility class (+ PostCSS).',
  babel: 'Babel plugin — JSX attribute without Vite.',
};

export async function runInit(
  positionals: ReadonlyArray<string>,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  const output = readOutputOptions(flags);
  const mode = pickMode(output);
  const yes = getBoolFlag(flags, 'yes');
  const dryRun = getBoolFlag(flags, 'dry-run');
  const noInstall = getBoolFlag(flags, 'no-install');
  const interactive = mode === 'tty' && capability().isStdinTTY && !yes;

  const dir = resolve(positionals[0] ?? process.cwd());
  if (!existsSync(join(dir, 'package.json'))) {
    fail(`no package.json found in ${dir}`, 'run init inside a project, or pass the directory: optical-center init ./my-app', output);
    return 2;
  }

  const detection = detectProject(dir);

  // ── pick the integration ──────────────────────────────────────────
  const flagIntegration = getStringFlag(flags, 'integration');
  if (flagIntegration !== undefined && !isIntegration(flagIntegration)) {
    fail(
      `unknown integration '${flagIntegration}'`,
      `valid values: ${INTEGRATIONS.join(', ')}`,
      output,
    );
    return 3;
  }

  let integration: Integration | undefined = flagIntegration;
  if (integration === undefined) {
    if (interactive) {
      const picked = await promptIntegration(detection);
      if (picked === null) return 0; // cancelled
      integration = picked;
    } else {
      integration = detection.detected[0];
      if (integration === undefined) {
        fail(
          'could not detect a framework to set up',
          `pass one explicitly: optical-center init --integration <${INTEGRATIONS.join('|')}>`,
          output,
        );
        return 2;
      }
    }
  }

  // ── install the dependency ────────────────────────────────────────
  const pmFlag = getStringFlag(flags, 'pm');
  if (pmFlag !== undefined && !isPackageManager(pmFlag)) {
    fail(`unknown package manager '${pmFlag}'`, 'valid values: npm, pnpm, yarn, bun', output);
    return 3;
  }
  const pm: PackageManager = pmFlag ?? detection.packageManager;

  let installed: 'installed' | 'already' | 'skipped' | 'failed' = 'skipped';
  if (detection.hasOpticalCenter) {
    installed = 'already';
  } else if (!noInstall && !dryRun) {
    let proceed = true;
    if (interactive) {
      const answer = await select({
        message: `Install optical-center with ${pm}?`,
        choices: [
          { label: 'yes', value: true, hint: `${pm} ${installArgs(pm).join(' ')}` },
          { label: 'no', value: false, hint: 'I will add the dependency myself.' },
        ],
      });
      if (answer === null) return 0; // cancelled
      proceed = answer;
    }
    if (proceed) {
      installed = runInstall(pm, dir, output, mode) ? 'installed' : 'failed';
    }
  }

  // ── patch the config files ────────────────────────────────────────
  const results = applyIntegration(integration, detection, dryRun);

  // ── report ────────────────────────────────────────────────────────
  const manual = results.filter((r) => r.status === 'manual');
  const exitCode = installed === 'failed' ? 2 : manual.length > 0 ? 1 : 0;

  if (mode === 'json') {
    writeJson(
      'init',
      { dir, integration, packageManager: pm, dryRun, installed, results },
      output,
    );
    return exitCode;
  }

  if (mode === 'tty') {
    reportTty(integration, pm, installed, results, dryRun);
  } else {
    reportText(integration, pm, installed, results, dryRun, output);
  }
  return exitCode;
}

async function promptIntegration(detection: ProjectDetection): Promise<Integration | null> {
  const best = detection.detected[0];
  const choices = INTEGRATIONS.map((name) => ({
    label: name,
    value: name,
    hint:
      INTEGRATION_HINTS[name] + (detection.detected.includes(name) ? '  (detected)' : ''),
  }));
  return select({
    message: 'Which integration should be set up?',
    choices,
    initial: best === undefined ? 0 : INTEGRATIONS.indexOf(best),
  });
}

function runInstall(
  pm: PackageManager,
  dir: string,
  output: ReturnType<typeof readOutputOptions>,
  mode: ReturnType<typeof pickMode>,
): boolean {
  const args = installArgs(pm);
  writeStderr(`installing optical-center via ${pm}…`, output);
  const child = spawnSync(pm, [...args], {
    cwd: dir,
    stdio: mode === 'tty' ? 'inherit' : 'pipe',
    encoding: 'utf8',
  });
  if (child.error !== undefined || child.status !== 0) {
    const detail =
      child.error?.message ?? child.stderr?.toString().trim().split('\n').slice(-3).join('\n');
    if (mode === 'tty') {
      caretWarning(`install failed — run \`${pm} ${args.join(' ')}\` yourself`);
      if (detail !== undefined && detail !== '') {
        process.stderr.write(indentBlock(detail) + '\n');
      }
    } else {
      writeStderr(`error: install failed: ${detail ?? 'unknown'}`, output);
    }
    return false;
  }
  return true;
}

function reportTty(
  integration: Integration,
  pm: PackageManager,
  installed: string,
  results: ReadonlyArray<PatchResult>,
  dryRun: boolean,
): void {
  process.stdout.write('\n');
  keyValue({
    rows: [
      { key: 'integration', value: integration },
      { key: 'package manager', value: pm },
      { key: 'dependency', value: installLabel(installed) },
      ...results.map((r) => ({ key: r.file, value: statusLabel(r, dryRun) })),
    ],
    highlightKeys: true,
  });

  for (const r of results) {
    if (r.status === 'manual' && r.snippet !== undefined) {
      process.stdout.write('\n');
      caretWarning(`${r.file}: ${r.note ?? 'manual step required'}`);
      process.stdout.write(indentBlock(r.snippet) + '\n');
    }
  }

  process.stdout.write('\n');
  if (dryRun) {
    paragraph('dry run — nothing was written. Re-run without --dry-run to apply.', {
      indent: 2,
    });
    return;
  }
  caretSuccess(`optical-center is wired into ${integration}. Use the directive:`);
  for (const line of nextSteps(integration)) {
    process.stdout.write(`    ${line}\n`);
  }
}

function reportText(
  integration: Integration,
  pm: PackageManager,
  installed: string,
  results: ReadonlyArray<PatchResult>,
  dryRun: boolean,
  output: ReturnType<typeof readOutputOptions>,
): void {
  writeStdout(`integration: ${integration}`, output);
  writeStdout(`package manager: ${pm}`, output);
  writeStdout(`dependency: ${installLabel(installed)}`, output);
  for (const r of results) {
    writeStdout(`${r.file}: ${statusLabel(r, dryRun)}`, output);
    if (r.status === 'manual' && r.snippet !== undefined) {
      writeStdout(indentBlock(r.snippet), output);
    }
  }
  if (dryRun) writeStdout('dry run — nothing was written', output);
}

function statusLabel(r: PatchResult, dryRun: boolean): string {
  const verb =
    r.status === 'patched'
      ? dryRun
        ? 'would patch'
        : 'patched'
      : r.status === 'created'
        ? dryRun
          ? 'would create'
          : 'created'
        : r.status === 'already'
          ? 'already configured'
          : `manual step — ${r.note ?? 'see snippet'}`;
  return verb;
}

function installLabel(installed: string): string {
  switch (installed) {
    case 'installed':
      return 'installed';
    case 'already':
      return 'already in package.json';
    case 'failed':
      return 'install FAILED — add it manually';
    default:
      return 'skipped';
  }
}

function indentBlock(text: string): string {
  return text
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');
}

function isPackageManager(name: string): name is PackageManager {
  return name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun';
}

function fail(
  message: string,
  hint: string,
  output: ReturnType<typeof readOutputOptions>,
): void {
  if (pickMode(output) === 'tty') {
    caretError(message, { hint });
  } else {
    writeStderr(`error: ${message}`, output);
    writeStderr(hint, output);
  }
}
