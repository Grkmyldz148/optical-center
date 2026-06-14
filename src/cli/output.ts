/**
 * stdout / stderr helpers for the CLI Output Contract.
 *
 *   - stdout = data only (text or NDJSON)
 *   - stderr = log/progress/warning lines
 *   - --silent / --quiet gate stderr; --silent gates stdout too
 *
 * Every JSON record carries a `schemaVersion` so consumers can detect
 * incompatible upgrades without parsing free-form text.
 */

import { ALGORITHM_VERSION } from '../core/version.js';

export const SCHEMA_VERSION = 1;
export const PACKAGE_VERSION = '0.2.0-alpha.0';

export interface OutputOptions {
  readonly json: boolean;
  readonly silent: boolean;
  readonly quiet: boolean;
}

export interface JsonEnvelope<T> {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly command: string;
  readonly result: T;
  readonly version: {
    readonly package: string;
    readonly algorithm: string;
    readonly schema: typeof SCHEMA_VERSION;
  };
}

export function writeStdout(line: string, options: OutputOptions): void {
  if (options.silent) return;
  process.stdout.write(`${line}\n`);
}

export function writeStderr(line: string, options: OutputOptions): void {
  if (options.silent) return;
  if (options.quiet && !line.startsWith('error:')) return;
  process.stderr.write(`${line}\n`);
}

export function writeJson<T>(
  command: string,
  result: T,
  options: OutputOptions,
): void {
  const envelope: JsonEnvelope<T> = {
    schemaVersion: SCHEMA_VERSION,
    command,
    result,
    version: {
      package: PACKAGE_VERSION,
      algorithm: ALGORITHM_VERSION,
      schema: SCHEMA_VERSION,
    },
  };
  writeStdout(JSON.stringify(envelope), options);
}

export function readOutputOptions(
  flags: Readonly<Record<string, string | boolean>>,
): OutputOptions {
  return {
    json: flags['json'] === true,
    silent: flags['silent'] === true,
    quiet: flags['quiet'] === true,
  };
}
