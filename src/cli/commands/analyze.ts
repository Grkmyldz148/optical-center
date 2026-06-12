/**
 * `optical-center analyze <folder>` — aggregate report across a directory.
 *
 * Useful for icon-set authors who want to see, at a glance, which of
 * their icons need the most correction (i.e. are the most asymmetric).
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

import { transformViewBoxFromSvg } from '../../node/transform-viewbox-from-svg.js';

import { banner } from '../caret/components/banner.js';
import { divider } from '../caret/components/divider.js';
import { error as caretError } from '../caret/components/error.js';
import { keyValue } from '../caret/components/key-value.js';
import { table } from '../caret/components/table.js';
import { warning as caretWarning } from '../caret/components/message.js';
import { readOutputOptions, writeJson, writeStderr, writeStdout } from '../output.js';
import type { OutputOptions } from '../output.js';
import { pickMode } from '../render.js';

interface FileSample {
  readonly file: string;
  readonly dxPercent: number;
  readonly dyPercent: number;
  readonly magnitude: number;
  readonly clipDetected: boolean;
}

export async function runAnalyze(
  positionals: ReadonlyArray<string>,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  const output = readOutputOptions(flags);
  const target = positionals[0];
  if (target === undefined) {
    emitError('analyze requires a <folder> path', output, {
      hint: 'optical-center analyze path/to/icons',
    });
    return 3;
  }

  const root = resolve(target);
  let files: string[];
  try {
    files = await collectSvgFiles(root);
  } catch (err) {
    emitError(`cannot read ${root}: ${describe(err)}`, output);
    return 3;
  }

  const samples: FileSample[] = [];
  let failed = 0;

  for (const file of files) {
    try {
      const svg = await readFile(file, 'utf8');
      const result = transformViewBoxFromSvg(svg);
      const dx = result.offset.dxPercent;
      const dy = result.offset.dyPercent;
      samples.push({
        file: relative(root, file),
        dxPercent: dx,
        dyPercent: dy,
        magnitude: Math.hypot(dx, dy),
        clipDetected: result.clipDetected,
      });
    } catch (err) {
      failed++;
      emitWarning(`${relative(root, file)}: ${describe(err)}`, output);
    }
  }

  samples.sort((a, b) => b.magnitude - a.magnitude);

  const summary = {
    folder: root,
    count: samples.length,
    failed,
    avgMagnitude: avg(samples.map((s) => s.magnitude)),
    maxMagnitude: samples[0]?.magnitude ?? 0,
    clipDetectedCount: samples.filter((s) => s.clipDetected).length,
    topByMagnitude: samples.slice(0, 10),
  };

  const mode = pickMode(output);
  if (mode === 'json') {
    writeJson('analyze', summary, output);
  } else if (mode === 'tty') {
    renderTty(summary);
  } else {
    writeStdout(formatSummary(summary), output);
  }

  return failed > 0 ? 2 : summary.clipDetectedCount > 0 ? 1 : 0;
}

function renderTty(summary: {
  folder: string;
  count: number;
  failed: number;
  avgMagnitude: number;
  maxMagnitude: number;
  clipDetectedCount: number;
  topByMagnitude: ReadonlyArray<FileSample>;
}): void {
  banner({ title: 'optical-center analyze', subtitle: summary.folder });
  process.stdout.write('\n');

  keyValue({
    rows: [
      { key: 'count', value: summary.count },
      { key: 'failed', value: summary.failed },
      { key: 'avg offset', value: `${summary.avgMagnitude.toFixed(3)}%` },
      { key: 'max offset', value: `${summary.maxMagnitude.toFixed(3)}%` },
      { key: 'clip count', value: summary.clipDetectedCount },
    ],
    highlightKeys: true,
  });

  if (summary.topByMagnitude.length === 0) return;
  process.stdout.write('\n');
  divider({ label: 'Top by magnitude', align: 'left' });
  table({
    columns: [
      {
        header: 'OFFSET',
        accessor: (r: FileSample) => `${r.magnitude.toFixed(3)}%`,
        align: 'right',
      },
      {
        header: 'CLIP',
        accessor: (r: FileSample) => (r.clipDetected ? 'yes' : ''),
      },
      { header: 'FILE', accessor: (r: FileSample) => r.file },
    ],
    rows: summary.topByMagnitude,
    borders: true,
  });
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

function avg(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function formatSummary(summary: {
  folder: string;
  count: number;
  failed: number;
  avgMagnitude: number;
  maxMagnitude: number;
  clipDetectedCount: number;
  topByMagnitude: ReadonlyArray<FileSample>;
}): string {
  const lines = [
    `folder:      ${summary.folder}`,
    `count:       ${summary.count}`,
    `failed:      ${summary.failed}`,
    `avg offset:  ${summary.avgMagnitude.toFixed(3)}%`,
    `max offset:  ${summary.maxMagnitude.toFixed(3)}%`,
    `clip count:  ${summary.clipDetectedCount}`,
    '',
    'top by magnitude:',
  ];
  for (const s of summary.topByMagnitude) {
    lines.push(
      `  ${s.magnitude.toFixed(3).padStart(7)}% — ${s.file}${s.clipDetected ? ' [clip]' : ''}`,
    );
  }
  return lines.join('\n');
}

function emitError(
  message: string,
  output: OutputOptions,
  options: { hint?: string } = {},
): void {
  if (pickMode(output) === 'tty') {
    const opts: Parameters<typeof caretError>[1] = {};
    if (options.hint !== undefined) opts.hint = options.hint;
    caretError(message, opts);
    return;
  }
  writeStderr(`error: ${message}`, output);
}

function emitWarning(message: string, output: OutputOptions): void {
  if (pickMode(output) === 'tty') {
    caretWarning(message);
    return;
  }
  writeStderr(`warn: ${message}`, output);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
