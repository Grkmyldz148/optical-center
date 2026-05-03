/**
 * `optical-center info <svg>` — single-file inspection. Reports the
 * computed offset, the rewritten viewBox, and whether the shift would
 * clip rendered pixels.
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { transformViewBoxFromSvg } from '../../node/transform-viewbox-from-svg.js';
import { parseViewBoxFromSvg } from '../../parse-viewbox.js';

import { readOutputOptions, writeJson, writeStderr, writeStdout } from '../output.js';

export async function runInfo(
  positionals: ReadonlyArray<string>,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  const output = readOutputOptions(flags);
  const target = positionals[0];
  if (!target) {
    writeStderr('error: info requires a <svg> path', output);
    return 3;
  }

  const path = resolve(target);
  try {
    const stats = await stat(path);
    if (!stats.isFile()) {
      writeStderr(`error: ${path} is not a file`, output);
      return 3;
    }
  } catch (error) {
    writeStderr(`error: cannot stat ${path}: ${describe(error)}`, output);
    return 3;
  }

  const svg = await readFile(path, 'utf8');
  const { viewBox: original, source } = parseViewBoxFromSvg(svg);

  let result: ReturnType<typeof transformViewBoxFromSvg>;
  try {
    result = transformViewBoxFromSvg(svg, { emitMetadata: true });
  } catch (error) {
    writeStderr(`error: pipeline failed: ${describe(error)}`, output);
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

  if (output.json) {
    writeJson('info', payload, output);
  } else {
    writeStdout(formatInfo(payload), output);
  }

  return result.clipDetected ? 1 : 0;
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

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
