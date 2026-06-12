/**
 * Worker-thread pool for batch icon measurement.
 *
 * `getOpticalCenter` is pure JS at ~7ms per icon; correcting a whole
 * Iconify family in the importing thread serialises tens of seconds of
 * CPU behind one module request. The pool spreads measurements across
 * `availableParallelism() - 1` workers, cutting a cold collection
 * correction roughly by the core count.
 *
 * Availability is probed, not assumed: the worker entry is resolved
 * relative to this module (`./measure-worker.js`), which only exists in
 * the compiled `dist/` tree. Under vitest (running TS from `src/`) or any
 * bundler that didn't keep the file, `measurePool()` returns `null` and
 * callers fall back to the in-thread `measureShift` — same math, one
 * thread.
 *
 * Lifecycle: workers spawn lazily on first use and stay for the process
 * lifetime (a dev server corrects families repeatedly), but are `unref`ed
 * whenever idle so they never hold a CLI process open. While jobs are
 * outstanding the busy worker is `ref`ed — otherwise a one-shot build
 * could exit mid-measurement.
 */

import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import type { IconSize, OpticalShift } from './measure.js';
import { measureShift } from './measure.js';
import type { MeasureRequest, MeasureResponse } from './measure-worker.js';

const WORKER_URL = new URL('./measure-worker.js', import.meta.url);

interface PendingJob {
  readonly svg: string;
  readonly size: IconSize;
  readonly resolve: (shift: OpticalShift) => void;
}

class PoolWorker {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingJob>();
  dead = false;

  constructor() {
    // execArgv: [] — workers must not inherit the parent's exec flags.
    // An inherited `--inspect` fights over the debug port and an
    // inherited `--input-type=module` (string-eval hosts) kills the
    // worker on boot.
    this.worker = new Worker(WORKER_URL, { execArgv: [] });
    this.worker.unref();
    this.worker.on('message', (msg: MeasureResponse) => {
      const job = this.pending.get(msg.id);
      if (!job) return;
      this.pending.delete(msg.id);
      if (this.pending.size === 0) this.worker.unref();
      job.resolve({ dx: msg.dx, dy: msg.dy, clipDetected: msg.clipDetected });
    });
    // A crashed worker must not strand its jobs: mark it dead so the
    // pool stops routing to it, and finish what it held in-thread. Same
    // math, just slower — the pool keeps limping on the remaining
    // workers instead of failing the build.
    const settleInThread = () => {
      this.dead = true;
      const orphaned = [...this.pending.values()];
      this.pending.clear();
      this.worker.unref();
      for (const job of orphaned) job.resolve(measureShift(job.svg, job.size));
    };
    this.worker.on('error', settleInThread);
    this.worker.on('exit', settleInThread);
  }

  get load(): number {
    return this.pending.size;
  }

  run(id: number, job: PendingJob): void {
    if (this.dead) {
      job.resolve(measureShift(job.svg, job.size));
      return;
    }
    if (this.pending.size === 0) this.worker.ref();
    this.pending.set(id, job);
    const request: MeasureRequest = {
      id,
      svg: job.svg,
      width: job.size.width,
      height: job.size.height,
    };
    this.worker.postMessage(request);
  }
}

export class MeasurePool {
  private readonly workers: PoolWorker[];
  private nextId = 0;

  constructor(size: number) {
    this.workers = Array.from({ length: size }, () => new PoolWorker());
  }

  measure(svg: string, size: IconSize): Promise<OpticalShift> {
    let least: PoolWorker | null = null;
    for (const w of this.workers) {
      if (w.dead) continue;
      if (least === null || w.load < least.load) least = w;
    }
    if (least === null) {
      // Every worker died — degrade to in-thread measurement.
      return Promise.resolve(measureShift(svg, size));
    }
    const chosen = least;
    return new Promise<OpticalShift>((resolve) => {
      chosen.run(this.nextId++, { svg, size, resolve });
    });
  }
}

const POOL_SIZE = Math.max(1, Math.min(availableParallelism() - 1, 8));

let pool: MeasurePool | null | undefined;

/**
 * The shared process-wide pool, or `null` when worker threads aren't
 * usable here (no compiled worker file). Probed once.
 */
export function measurePool(): MeasurePool | null {
  if (pool !== undefined) return pool;
  try {
    pool = existsSync(fileURLToPath(WORKER_URL))
      ? new MeasurePool(POOL_SIZE)
      : null;
  } catch {
    pool = null;
  }
  return pool;
}
