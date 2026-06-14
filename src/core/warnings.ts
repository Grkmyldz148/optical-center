/**
 * Warning Code Registry — every adapter (CLI, Babel plugin, Vite plugin)
 * uses these stable codes so consumers can grep, filter, and `--strict` on
 * them without parsing free-form text.
 *
 * Severity:
 *   - `info`  : informational, never blocks
 *   - `warn`  : succeeds with caveats (`OPTICAL_CLIP_DETECTED`, etc.)
 *   - `error` : the icon was not transformed
 */

export type WarningSeverity = 'info' | 'warn' | 'error';

export interface WarningDefinition {
  readonly code: string;
  readonly severity: WarningSeverity;
  readonly summary: string;
}

export interface WarningRecord extends WarningDefinition {
  readonly message: string;
  readonly location?: string;
}

/** Registry of every stable warning code emitted by the pipeline. */
export const WARNINGS = {
  OPTICAL_DYNAMIC_SVG: {
    code: 'OPTICAL_DYNAMIC_SVG',
    severity: 'warn',
    summary: 'JSX child or viewBox is a dynamic expression — transform skipped.',
  },
  OPTICAL_SPREAD_PROPS: {
    code: 'OPTICAL_SPREAD_PROPS',
    severity: 'warn',
    summary:
      '<svg> uses JSX spread; cannot statically detect opticalCenter — transform skipped.',
  },
  OPTICAL_MISSING_VIEWBOX: {
    code: 'OPTICAL_MISSING_VIEWBOX',
    severity: 'warn',
    summary: 'SVG has no viewBox and no width/height — transform skipped.',
  },
  OPTICAL_VIEWBOX_DERIVED: {
    code: 'OPTICAL_VIEWBOX_DERIVED',
    severity: 'info',
    summary: 'viewBox derived from width/height attributes.',
  },
  OPTICAL_CLIP_DETECTED: {
    code: 'OPTICAL_CLIP_DETECTED',
    severity: 'warn',
    summary: 'viewBox shift may clip rendered pixels — review the icon.',
  },
  OPTICAL_RASTERIZE_FAILED: {
    code: 'OPTICAL_RASTERIZE_FAILED',
    severity: 'error',
    summary: 'resvg-js could not rasterize the SVG — transform skipped.',
  },
  OPTICAL_CACHE_WRITE_FAIL: {
    code: 'OPTICAL_CACHE_WRITE_FAIL',
    severity: 'warn',
    summary: 'Cache write failed; recomputed result is still valid.',
  },
  OPTICAL_VERSION_MISMATCH: {
    code: 'OPTICAL_VERSION_MISMATCH',
    severity: 'info',
    summary: 'Cached entry algorithm version mismatched; recomputed.',
  },
  OPTICAL_INPUT_TOO_LARGE: {
    code: 'OPTICAL_INPUT_TOO_LARGE',
    severity: 'error',
    summary: 'SVG input exceeded MAX_INPUT_BYTES — transform skipped.',
  },
  OPTICAL_TIMEOUT: {
    code: 'OPTICAL_TIMEOUT',
    severity: 'error',
    summary: 'Per-file timeout exceeded — transform skipped.',
  },
} as const satisfies Record<string, WarningDefinition>;

export type WarningCode = keyof typeof WARNINGS;

export interface BuildWarningOptions {
  readonly message?: string;
  readonly location?: string;
}

/**
 * Build a fully-shaped WarningRecord from a code, with an optional caller-
 * supplied message. Adapters use this to keep warning shapes consistent
 * regardless of where in the pipeline they originate.
 */
export function buildWarning(
  code: WarningCode,
  options?: BuildWarningOptions,
): WarningRecord {
  const def = WARNINGS[code];
  if (options?.location !== undefined) {
    return {
      code: def.code,
      severity: def.severity,
      summary: def.summary,
      message: options.message ?? def.summary,
      location: options.location,
    };
  }
  return {
    code: def.code,
    severity: def.severity,
    summary: def.summary,
    message: options?.message ?? def.summary,
  };
}
