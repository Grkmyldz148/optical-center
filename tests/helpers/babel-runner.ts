/**
 * Thin Babel test harness. Runs the optical-center plugin in isolation
 * (no babelrc, no project config) and surfaces emitted warnings as data.
 */

import * as babel from '@babel/core';

import opticalCenter from '../../src/babel/index.js';
import type { WarningCode } from '../../src/core/warnings.js';

export interface RunnerWarning {
  readonly code: WarningCode;
  readonly location?: string;
}

export interface RunnerResult {
  readonly code: string;
  readonly warnings: ReadonlyArray<RunnerWarning>;
}

export interface RunnerOptions {
  readonly emitMetadata?: boolean;
  readonly filename?: string;
}

export function runBabel(input: string, options: RunnerOptions = {}): RunnerResult {
  const warnings: RunnerWarning[] = [];
  const result = babel.transformSync(input, {
    filename: options.filename,
    plugins: [
      [
        opticalCenter,
        {
          emitMetadata: options.emitMetadata ?? false,
          onWarning: (w: RunnerWarning) => warnings.push(w),
        },
      ],
    ],
    parserOpts: { plugins: ['jsx'] },
    babelrc: false,
    configFile: false,
  });
  return { code: result?.code ?? '', warnings };
}
