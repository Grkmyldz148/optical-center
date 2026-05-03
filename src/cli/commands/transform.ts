/**
 * `optical-center transform <input> [output]`
 *
 * Walks a folder of SVGs, runs the build-time pipeline through the cache,
 * and writes results either back in place or to a mirror directory.
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { applyTransformToSvg } from '../../core/apply-to-svg.js';
import { TransformCache, computeCacheKey } from '../../cache/index.js';
import { DEFAULT_TIMEOUT_MS } from '../../core/constants.js';
import { transformViewBoxFromSvg } from '../../node/transform-viewbox-from-svg.js';
import { isTimeoutError, withTimeout } from '../../node/timeout.js';
import { buildWarning } from '../../core/warnings.js';
import type { WarningRecord } from '../../core/warnings.js';

import { getBoolFlag, getStringFlag } from '../argv.js';
import {
  readOutputOptions,
  writeJson,
  writeStderr,
  writeStdout,
} from '../output.js';
import type { OutputOptions } from '../output.js';

interface CachedTransform {
  readonly viewBox: string;
  readonly offset: { readonly dxPercent: number; readonly dyPercent: number };
  readonly clipDetected: boolean;
}

interface FileReport {
  readonly file: string;
  readonly status: 'transformed' | 'cached' | 'unchanged' | 'failed';
  readonly viewBox?: string;
  readonly offset?: CachedTransform['offset'];
  readonly clipDetected?: boolean;
  readonly warning?: WarningRecord;
  readonly cacheHit?: 'l1' | 'l2' | null;
}

interface Summary {
  readonly inputCount: number;
  readonly transformed: number;
  readonly failed: number;
  readonly clipDetected: number;
  readonly durationMs: number;
  readonly cache: {
    readonly l1Hits: number;
    readonly l2Hits: number;
    readonly misses: number;
    readonly writes: number;
    readonly writeFailures: number;
  };
}

export async function runTransform(
  positionals: ReadonlyArray<string>,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  const output = readOutputOptions(flags);
  const inputArg = positionals[0];
  if (!inputArg) {
    writeStderr('error: transform requires an <input> path', output);
    return 3;
  }
  const outputArg = positionals[1] ?? inputArg;
  const useCache = !getBoolFlag(flags, 'no-cache');
  const strict = getBoolFlag(flags, 'strict');
  const emitMetadata = getBoolFlag(flags, 'emit-metadata');
  const cacheDir = getStringFlag(flags, 'cache-dir');
  const timeoutMs = parseTimeout(getStringFlag(flags, 'timeout'));

  const cache = useCache
    ? new TransformCache<CachedTransform>(
        cacheDir !== undefined ? { dir: cacheDir } : undefined,
      )
    : null;

  const inputRoot = resolve(inputArg);
  const outputRoot = resolve(outputArg);

  let svgFiles: string[];
  try {
    svgFiles = await collectSvgFiles(inputRoot);
  } catch (error) {
    writeStderr(`error: cannot read input ${inputRoot}: ${describe(error)}`, output);
    return 3;
  }

  const reports: FileReport[] = [];
  const t0 = performance.now();

  for (const file of svgFiles) {
    const report = await processFile(file, {
      inputRoot,
      outputRoot,
      cache,
      emitMetadata,
      timeoutMs,
      output,
    });
    reports.push(report);
    emitProgress(report, output);
  }

  const summary = buildSummary(reports, performance.now() - t0, cache);

  if (output.json) {
    writeJson('transform', { summary, files: reports }, output);
  } else {
    writeStdout(formatSummary(summary), output);
  }

  return chooseExitCode(reports, strict);
}

interface ProcessContext {
  readonly inputRoot: string;
  readonly outputRoot: string;
  readonly cache: TransformCache<CachedTransform> | null;
  readonly emitMetadata: boolean;
  readonly timeoutMs: number;
  readonly output: OutputOptions;
}

async function processFile(
  file: string,
  ctx: ProcessContext,
): Promise<FileReport> {
  const relPath = relative(ctx.inputRoot, file);
  let svg: string;
  try {
    svg = await readFile(file, 'utf8');
  } catch (error) {
    return {
      file: relPath,
      status: 'failed',
      warning: buildWarning('OPTICAL_RASTERIZE_FAILED', {
        message: `read failed: ${describe(error)}`,
        location: relPath,
      }),
    };
  }

  let cached: CachedTransform | null = null;
  let cacheHit: 'l1' | 'l2' | null = null;

  if (ctx.cache) {
    const before = ctx.cache.stats;
    const l1Before = before.l1Hits;
    const l2Before = before.l2Hits;
    const lookup = await ctx.cache.get(svg);
    cached = lookup.value;
    if (cached) {
      cacheHit = ctx.cache.stats.l1Hits > l1Before ? 'l1' : ctx.cache.stats.l2Hits > l2Before ? 'l2' : null;
    }
  }

  let result: CachedTransform;
  let breadcrumb: { viewBox: string; breadcrumb: ReturnType<typeof transformViewBoxFromSvg>['breadcrumb'] };

  if (cached) {
    // Recompute breadcrumb here (option-dependent); math comes from cache.
    const recomputed = transformViewBoxFromSvg(svg, {
      emitMetadata: ctx.emitMetadata,
    });
    result = cached;
    breadcrumb = { viewBox: cached.viewBox, breadcrumb: recomputed.breadcrumb };
  } else {
    let transformed: ReturnType<typeof transformViewBoxFromSvg>;
    try {
      transformed = await withTimeout(
        () =>
          Promise.resolve(
            transformViewBoxFromSvg(svg, { emitMetadata: ctx.emitMetadata }),
          ),
        { limitMs: ctx.timeoutMs, location: relPath },
      );
    } catch (error) {
      const code = isTimeoutError(error)
        ? 'OPTICAL_TIMEOUT'
        : 'OPTICAL_RASTERIZE_FAILED';
      return {
        file: relPath,
        status: 'failed',
        warning: buildWarning(code, {
          message: describe(error),
          location: relPath,
        }),
      };
    }
    result = {
      viewBox: transformed.viewBox,
      offset: {
        dxPercent: transformed.offset.dxPercent,
        dyPercent: transformed.offset.dyPercent,
      },
      clipDetected: transformed.clipDetected,
    };
    breadcrumb = { viewBox: transformed.viewBox, breadcrumb: transformed.breadcrumb };

    if (ctx.cache) {
      await ctx.cache.set(svg, result);
    }
  }

  const next = applyTransformToSvg(svg, breadcrumb);
  const target = join(ctx.outputRoot, relPath);
  try {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, next);
  } catch (error) {
    return {
      file: relPath,
      status: 'failed',
      warning: buildWarning('OPTICAL_CACHE_WRITE_FAIL', {
        message: `write failed: ${describe(error)}`,
        location: relPath,
      }),
    };
  }

  const report: FileReport = result.clipDetected
    ? {
        file: relPath,
        status: cacheHit ? 'cached' : 'transformed',
        viewBox: result.viewBox,
        offset: result.offset,
        clipDetected: true,
        cacheHit,
        warning: buildWarning('OPTICAL_CLIP_DETECTED', { location: relPath }),
      }
    : {
        file: relPath,
        status: cacheHit ? 'cached' : 'transformed',
        viewBox: result.viewBox,
        offset: result.offset,
        clipDetected: false,
        cacheHit,
      };

  return report;
}

async function collectSvgFiles(root: string): Promise<string[]> {
  const stats = await stat(root);
  if (stats.isFile()) {
    return root.toLowerCase().endsWith('.svg') ? [root] : [];
  }

  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectSvgFiles(full)));
    } else if (extname(entry.name).toLowerCase() === '.svg') {
      out.push(full);
    }
  }
  return out;
}

function buildSummary(
  reports: ReadonlyArray<FileReport>,
  durationMs: number,
  cache: TransformCache<CachedTransform> | null,
): Summary {
  return {
    inputCount: reports.length,
    transformed: reports.filter((r) => r.status === 'transformed' || r.status === 'cached').length,
    failed: reports.filter((r) => r.status === 'failed').length,
    clipDetected: reports.filter((r) => r.clipDetected).length,
    durationMs,
    cache: cache
      ? {
          l1Hits: cache.stats.l1Hits,
          l2Hits: cache.stats.l2Hits,
          misses: cache.stats.misses,
          writes: cache.stats.writes,
          writeFailures: cache.stats.writeFailures,
        }
      : { l1Hits: 0, l2Hits: 0, misses: 0, writes: 0, writeFailures: 0 },
  };
}

function chooseExitCode(reports: ReadonlyArray<FileReport>, strict: boolean): number {
  if (reports.some((r) => r.status === 'failed')) return 2;
  if (reports.some((r) => r.warning !== undefined)) return strict ? 2 : 1;
  return 0;
}

function emitProgress(report: FileReport, output: OutputOptions): void {
  if (output.json) return;
  if (report.status === 'failed') {
    writeStderr(`error: ${report.file}: ${report.warning?.message ?? 'unknown'}`, output);
    return;
  }
  if (report.warning) {
    writeStderr(`warn: ${report.file}: ${report.warning.code}`, output);
  } else {
    writeStderr(`ok:   ${report.file}`, output);
  }
}

function formatSummary(summary: Summary): string {
  return [
    `transformed ${summary.transformed}/${summary.inputCount} svg files in ${summary.durationMs.toFixed(0)}ms`,
    `clip warnings: ${summary.clipDetected}, failures: ${summary.failed}`,
    `cache: l1=${summary.cache.l1Hits} l2=${summary.cache.l2Hits} miss=${summary.cache.misses} write=${summary.cache.writes}`,
  ].join('\n');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseTimeout(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

// keep the unused-import linter happy; computeCacheKey is part of the
// public cache API and surfaces in `info` / `analyze` as well.
void computeCacheKey;
