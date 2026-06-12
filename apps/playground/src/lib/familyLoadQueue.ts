/**
 * Concurrency-limited gate for family-level manifest loads.
 *
 * Manifests are served as same-origin static JSON, but the
 * *browser side* (parse, React re-render, paint) still chokes if
 * we expand ten families in the same frame. This queue caps active
 * loads at `MAX`, lets the rest wait their turn, and notifies
 * subscribers whenever the queue shape changes so the HUD can show
 * pending counts.
 */

const MAX = 2;

type Task<T> = () => Promise<T>;

interface Pending {
  readonly key: string;
  readonly run: () => Promise<void>;
}

const waiting: Pending[] = [];
const active = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

function pump(): void {
  while (active.size < MAX && waiting.length > 0) {
    const next = waiting.shift()!;
    active.add(next.key);
    notify();
    next
      .run()
      .catch(() => {
        /* swallowed — caller's promise still rejects */
      })
      .finally(() => {
        active.delete(next.key);
        notify();
        pump();
      });
  }
}

/**
 * Run `task` under the family-load gate. The returned promise
 * resolves/rejects with whatever the task produces, but the task
 * itself only starts running once a slot is free. `key` is used to
 * label active/waiting entries for HUD reporting and to support
 * `cancel(key)`.
 */
export function runUnderFamilyGate<T>(
  key: string,
  task: Task<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const job: Pending = {
      key,
      run: () => task().then(resolve, reject),
    };
    waiting.push(job);
    notify();
    pump();
  });
}

/** Drop any pending (not yet started) job with the given key. */
export function cancelFamilyJob(key: string): void {
  const idx = waiting.findIndex((j) => j.key === key);
  if (idx >= 0) {
    waiting.splice(idx, 1);
    notify();
  }
}

export interface FamilyQueueStats {
  readonly active: number;
  readonly waiting: number;
  readonly max: number;
}

export function familyQueueStats(): FamilyQueueStats {
  return { active: active.size, waiting: waiting.length, max: MAX };
}

export function subscribeFamilyQueue(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
