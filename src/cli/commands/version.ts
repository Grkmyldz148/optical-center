/**
 * `optical-center version` — package + algorithm + schema versions.
 * Designed to be the cheapest possible call agents can make to verify
 * they're talking to the right binary.
 */

import { ALGORITHM_VERSION } from '../../version.js';

import {
  PACKAGE_VERSION,
  SCHEMA_VERSION,
  readOutputOptions,
  writeJson,
  writeStdout,
} from '../output.js';

export async function runVersion(
  _positionals: ReadonlyArray<string>,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  const output = readOutputOptions(flags);
  const result = {
    package: PACKAGE_VERSION,
    algorithm: ALGORITHM_VERSION,
    schema: SCHEMA_VERSION,
  };

  if (output.json) {
    writeJson('version', result, output);
  } else {
    writeStdout(
      `optical-center ${PACKAGE_VERSION} (algorithm ${ALGORITHM_VERSION}, schema ${SCHEMA_VERSION})`,
      output,
    );
  }
  return 0;
}
