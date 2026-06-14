/**
 * Cheap FPS / frame-time monitor for the stress view.
 *
 * Uses a rAF loop to count frames per second and average frame
 * duration over a sliding window. The hook is opt-in (call site
 * passes `active`) so the rAF loop is only running while the
 * stress view is mounted and the user wants the HUD.
 *
 * Why not pin to React state for every frame: setState on every
 * frame would tank the very metric we're trying to measure. We
 * batch updates to a 4Hz tick via `setState` to keep the HUD
 * readable without flooding React.
 */

import { useEffect, useRef, useState } from 'react';

export interface PerfSample {
  readonly fps: number;
  readonly frameMs: number;
  /** Number of samples folded into the current value. */
  readonly samples: number;
}

const INITIAL: PerfSample = { fps: 0, frameMs: 0, samples: 0 };

export function usePerformance(active: boolean): PerfSample {
  const [sample, setSample] = useState<PerfSample>(INITIAL);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef({
    lastT: 0,
    accumMs: 0,
    frames: 0,
    lastFlush: 0,
  });

  useEffect(() => {
    if (!active) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setSample(INITIAL);
      stateRef.current = { lastT: 0, accumMs: 0, frames: 0, lastFlush: 0 };
      return;
    }

    const tick = (t: number) => {
      const s = stateRef.current;
      if (s.lastT) {
        const dt = t - s.lastT;
        s.accumMs += dt;
        s.frames += 1;
      } else {
        s.lastFlush = t;
      }
      s.lastT = t;

      // Flush HUD ~4× per second.
      if (t - s.lastFlush >= 250 && s.frames > 0) {
        const fps = (s.frames / s.accumMs) * 1000;
        const frameMs = s.accumMs / s.frames;
        setSample({ fps, frameMs, samples: s.frames });
        s.frames = 0;
        s.accumMs = 0;
        s.lastFlush = t;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active]);

  return sample;
}
