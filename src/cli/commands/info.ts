/**
 * `optical-center info <svg>` — single-file inspection. Reports the
 * computed offset, the rewritten viewBox, and whether the shift would
 * clip rendered pixels.
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { transformViewBoxFromSvg } from '../../node/transform-viewbox-from-svg.js';
import { parseViewBoxFromSvg } from '../../core/parse-viewbox.js';

import { banner } from '../caret/components/banner.js';
import { error as caretError } from '../caret/components/error.js';
import { keyValue } from '../caret/components/key-value.js';
import { readOutputOptions, writeJson, writeStderr, writeStdout } from '../output.js';
import type { OutputOptions } from '../output.js';
import { pickMode } from '../render.js';

export async function runInfo(
  positionals: ReadonlyArray<string>,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  const output = readOutputOptions(flags);
  const target = positionals[0];
  if (target === undefined) {
    emitError('info requires a <svg> path', output, {
      hint: 'optical-center info path/to/icon.svg',
    });
    return 3;
  }

  const path = resolve(target);
  try {
    const stats = await stat(path);
    if (!stats.isFile()) {
      emitError(`${path} is not a file`, output);
      return 3;
    }
  } catch (err) {
    emitError(`cannot stat ${path}: ${describe(err)}`, output);
    return 3;
  }

  const svg = await readFile(path, 'utf8');
  const { viewBox: original, source } = parseViewBoxFromSvg(svg);

  let result: ReturnType<typeof transformViewBoxFromSvg>;
  try {
    result = transformViewBoxFromSvg(svg, { emitMetadata: true });
  } catch (err) {
    emitError(`pipeline failed: ${describe(err)}`, output);
    return 2;
  }

  const payload = {
    file: path,
    originalViewBox: { x: original.x, y: original.y, w: original.w, h: original.h, source },
    newViewBox: result.viewBox,
    offset: result.offset,
    clipDetected: result.clipDetected,
    breadcrumb: result.breadcrumb,
  };

  const mode = pickMode(output);
  if (mode === 'json') {
    writeJson('info', payload, output);
  } else if (mode === 'tty') {
    renderTty(payload);
  } else {
    writeStdout(formatInfo(payload), output);
  }

  return result.clipDetected ? 1 : 0;
}

function renderTty(payload: {
  file: string;
  originalViewBox: { x: number; y: number; w: number; h: number; source: string };
  newViewBox: string;
  offset: { dxPercent: number; dyPercent: number };
  clipDetected: boolean;
}): void {
  banner({ title: 'optical-center info', subtitle: payload.file });
  process.stdout.write('\n');
  const o = payload.originalViewBox;
  keyValue({
    rows: [
      { key: 'viewBox source', value: o.source },
      { key: 'original', value: `${o.x} ${o.y} ${o.w} ${o.h}` },
      { key: 'new', value: payload.newViewBox },
      {
        key: 'offset',
        value: `dx=${payload.offset.dxPercent.toFixed(4)}%, dy=${payload.offset.dyPercent.toFixed(4)}%`,
      },
      { key: 'clip detected', value: payload.clipDetected ? 'yes' : 'no' },
    ],
    highlightKeys: true,
    width: 88,
  });
}

function formatInfo(payload: {
  file: string;
  originalViewBox: { x: number; y: number; w: number; h: number; source: string };
  newViewBox: string;
  offset: { dxPercent: number; dyPercent: number };
  clipDetected: boolean;
}): string {
  const o = payload.originalViewBox;
  return [
    `file:           ${payload.file}`,
    `viewBox source: ${o.source}`,
    `original:       ${o.x} ${o.y} ${o.w} ${o.h}`,
    `new:            ${payload.newViewBox}`,
    `offset:         dx=${payload.offset.dxPercent.toFixed(4)}%, dy=${payload.offset.dyPercent.toFixed(4)}%`,
    `clip detected:  ${payload.clipDetected ? 'yes' : 'no'}`,
  ].join('\n');
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

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
