/**
 * `optical-center version` — package + algorithm + schema versions.
 * Designed to be the cheapest possible call agents can make to verify
 * they're talking to the right binary.
 */

import { banner } from '../caret/components/banner.js';
import { keyValue } from '../caret/components/key-value.js';
import { ALGORITHM_VERSION } from '../../core/version.js';

import {
  PACKAGE_VERSION,
  SCHEMA_VERSION,
  readOutputOptions,
  writeJson,
  writeStdout,
} from '../output.js';
import { pickMode } from '../render.js';

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

  const mode = pickMode(output);
  if (mode === 'json') {
    writeJson('version', result, output);
    return 0;
  }
  if (mode === 'tty') {
    banner({
      title: 'Optical Center',
      subtitle: `v${PACKAGE_VERSION}`,
    });
    keyValue({
      rows: [
        { key: 'package', value: PACKAGE_VERSION },
        { key: 'algorithm', value: ALGORITHM_VERSION },
        { key: 'schema', value: SCHEMA_VERSION },
      ],
      highlightKeys: true,
    });
    return 0;
  }
  writeStdout(
    `optical-center ${PACKAGE_VERSION} (algorithm ${ALGORITHM_VERSION}, schema ${SCHEMA_VERSION})`,
    output,
  );
  return 0;
}
