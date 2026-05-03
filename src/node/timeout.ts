/**
 * Per-file timeout enforcement for the build-time pipeline.
 *
 * Why does this exist?
 *   resvg parses arbitrary user SVGs; a pathological input (`<filter>`
 *   with deeply nested feTurbulence, or a 10⁵-point path) can keep the
 *   Rust binding spinning long enough to grind a CI build to a halt.
 *   We give every transform a wall-clock budget and surface a clean
 *   `OPTICAL_TIMEOUT` warning instead of letting the process hang.
 *
 * Why not `AbortController`?
 *   resvg's render call is synchronous and not abortable. The cleanest
 *   tool we have is to race the work against a timer; the worker keeps
 *   running until it finishes (or the process exits), but the caller
 *   gets a deterministic answer in bounded time. For long-lived dev
 *   servers this would leak — for one-shot CI pipelines it is fine.
 */

import { DEFAULT_TIMEOUT_MS } from '../core/constants.js';

export class TimeoutError extends Error {
  constructor(
    public readonly limitMs: number,
    public readonly location?: string,
  ) {
    super(
      `optical-center: operation exceeded ${limitMs}ms${location ? ` for ${location}` : ''}`,
    );
    this.name = 'TimeoutError';
  }
}

export interface TimeoutOptions {
  /** Wall-clock budget. Default `DEFAULT_TIMEOUT_MS` (10s). */
  readonly limitMs?: number;
  /** File path or identifier used in the resulting error message. */
  readonly location?: string;
}

/**
 * Run an async producer with a hard time budget. The returned promise
 * rejects with `TimeoutError` if the producer hasn't settled by the
 * deadline; the producer itself keeps running but its result is
 * discarded.
 */
export function withTimeout<T>(
  produce: () => Promise<T>,
  options?: TimeoutOptions,
): Promise<T> {
  const limitMs = options?.limitMs ?? DEFAULT_TIMEOUT_MS;
  const location = options?.location;

  return new Promise<T>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new TimeoutError(limitMs, location));
    }, limitMs);
    timer.unref?.();

    produce().then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}
