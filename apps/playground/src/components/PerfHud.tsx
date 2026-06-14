import type { PerfSample } from '../lib/usePerformance.js';
import type { FamilyQueueStats } from '../lib/familyLoadQueue.js';

interface LoadedStats {
  readonly loadedPrefixes: number;
  readonly loadedIcons: number;
}

interface PerfHudProps {
  readonly perf: PerfSample;
  readonly families: { readonly loaded: number; readonly total: number };
  readonly cells: number;
  readonly loaded: LoadedStats;
  readonly fetch?: FamilyQueueStats;
}

/**
 * Bottom-right floating overlay. Surfaces the live state of the
 * page: rAF fps + frame, expanded family count, cells in DOM, the
 * family-fetch queue, and how many icon manifests have been
 * pulled into memory so far. Optical correction is applied at
 * build time — there is no client-side model to count.
 */
export function PerfHud({
  perf,
  families,
  cells,
  loaded,
  fetch,
}: PerfHudProps) {
  const { fps, frameMs } = perf;
  const fpsTone =
    fps === 0
      ? ''
      : fps >= 55
        ? ''
        : fps >= 30
          ? 'hud__value--warn'
          : 'hud__value--danger';
  return (
    <div
      className="hud"
      role="status"
      aria-label="Performance metrics"
      title="Live render-loop counters + manifest load progress"
    >
      <div className="hud__title">
        <span className="hud__title-dot" />
        <span>Performance</span>
        <span className="hud__title-sub">live</span>
      </div>

      <span className="hud__label" title="Render-loop frames per second">
        fps
      </span>
      <span className={`hud__value ${fpsTone}`}>
        {fps === 0 ? '—' : fps.toFixed(0)}
      </span>

      <span
        className="hud__label"
        title="Wall-clock ms between rendered frames"
      >
        frame
      </span>
      <span className="hud__value">
        {frameMs === 0 ? '—' : `${frameMs.toFixed(2)} ms`}
      </span>

      <span
        className="hud__label"
        title="Expanded families / matching families in view"
      >
        families
      </span>
      <span className="hud__value">
        {families.loaded}
        <span className="hud__sub">/ {families.total}</span>
      </span>

      <span
        className="hud__label"
        title="Total Iconify cells currently mounted in the DOM"
      >
        cells
      </span>
      <span className="hud__value hud__value--accent">
        {cells.toLocaleString()}
      </span>

      {fetch && (
        <>
          <span
            className="hud__label"
            title="Family manifest fetches — active + waiting (queue cap 2)"
          >
            fetch
          </span>
          <span className="hud__value">
            {fetch.active}
            <span className="hud__sub">+{fetch.waiting}</span>
          </span>
        </>
      )}

      <span
        className="hud__label"
        title="Bundled icon manifests pulled into memory so far"
      >
        loaded
      </span>
      <span className="hud__value">
        {loaded.loadedPrefixes}
        <span className="hud__sub">
          {loaded.loadedIcons > 0
            ? `· ${loaded.loadedIcons.toLocaleString()} icons`
            : '· build-time'}
        </span>
      </span>
    </div>
  );
}
