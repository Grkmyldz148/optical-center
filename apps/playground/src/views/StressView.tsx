import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { PerfHud } from '../components/PerfHud.js';
import { IconifyFamily } from '../components/IconifyFamily.js';
import { Slider } from '../components/controls/Slider.js';
import { Toggle } from '../components/controls/Toggle.js';
import {
  familyQueueStats,
  subscribeFamilyQueue,
  type FamilyQueueStats,
} from '../lib/familyLoadQueue.js';
import { useCollections } from '../lib/useCollections.js';
import { localIconSetStats } from '../lib/iconifyLocal.js';
import { usePerformance } from '../lib/usePerformance.js';

/**
 * Icons each family renders into the DOM. Fixed (no longer a user control):
 * high enough to stress the build-time correction across a big grid, low
 * enough to keep the page responsive on families with thousands of icons.
 */
const PER_FAMILY_CAP = 120;

/**
 * Stress view — a curated set of Iconify families rendered, family by
 * family.
 *
 * Defaults to a calm initial state: family headers, none expanded. The user
 * clicks a header and the family is imported as a real
 * `@iconify/json/json/<prefix>.json` module — already body-wrapped at
 * build/dev time by `optical-center/vite`. Cell size is the single sizing
 * knob — the grid auto-flows columns based on container width.
 *
 * Optical correction is build-time. The "optical" toggle swaps each cell's
 * body between the corrected one (the plugin's body-wrap) and the source
 * (wrapper stripped back off) — the viewBox never changes. The browser never
 * runs the optical model.
 */
export function StressView() {
  const collections = useCollections();
  const [search, setSearch] = useState('');
  const [cellSize, setCellSize] = useState(96);
  const [cellGap, setCellGap] = useState(8);
  const [optical, setOptical] = useState(true);
  const [hudActive, setHudActive] = useState(true);

  /** Set of currently-expanded prefixes (data may still be loading). */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Per-family cell counter, mirrored to state only for HUD readout.
  const cellCountsRef = useRef<Map<string, number>>(new Map());
  const [cellsInDom, setCellsInDom] = useState(0);

  const handleCellsChange = useCallback(
    (prefix: string) => (count: number) => {
      const prev = cellCountsRef.current.get(prefix) ?? 0;
      if (count === prev) return;
      if (count === 0) cellCountsRef.current.delete(prefix);
      else cellCountsRef.current.set(prefix, count);
      let sum = 0;
      for (const v of cellCountsRef.current.values()) sum += v;
      setCellsInDom(sum);
    },
    [],
  );

  const toggleExpanded = useCallback((prefix: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  }, []);

  // Family fetch queue + local-set load snapshot — sampled for the HUD.
  const perf = usePerformance(hudActive);
  const [familyQ, setFamilyQ] = useState<FamilyQueueStats>(() =>
    familyQueueStats(),
  );
  const [loaded, setLoaded] = useState(() => localIconSetStats());
  useEffect(() => {
    if (!hudActive) return;
    const sync = () => {
      setFamilyQ(familyQueueStats());
      setLoaded(localIconSetStats());
    };
    const unsub = subscribeFamilyQueue(sync);
    const id = window.setInterval(sync, 400);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, [hudActive]);

  // Filter the master collection list by the search box. Order comes from
  // useCollections (already sorted by name).
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collections.list;
    return collections.list.filter(
      (c) =>
        c.prefix.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.category ?? '').toLowerCase().includes(q),
    );
  }, [collections.list, search]);

  const totalIcons = useMemo(
    () => collections.list.reduce((a, c) => a + c.total, 0),
    [collections.list],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="view">
      <aside className="view__sidebar">
        {/* Primary control — pinned to the top so the on/off state is
            always visible, even while the family list scrolls. */}
        <button
          type="button"
          role="switch"
          aria-checked={optical}
          className="opticalstate"
          data-on={optical ? '' : undefined}
          onClick={() => setOptical(!optical)}
        >
          <span className="opticalstate__text">
            <span className="opticalstate__title">Optical center</span>
            <span className="opticalstate__sub">
              {optical ? 'On — showing corrected' : 'Off — showing source'}
            </span>
          </span>
          <span
            className={`toggle__switch${optical ? ' toggle__switch--on' : ''}`}
            aria-hidden="true"
          />
        </button>

        <p className="group__hint">
          {collections.error ? (
            <span style={{ color: 'var(--danger-text)' }}>
              {collections.error}
            </span>
          ) : (
            <>
              <strong>{collections.list.length}</strong> families ·{' '}
              <strong>{totalIcons.toLocaleString()}</strong> icons. Each is a
              real <code>@iconify/json</code> import, body-wrapped at build
              time by <code>optical-center/vite</code>. Click a family to
              expand it.
            </>
          )}
        </p>

        <Group title="Search">
          <div className="field">
            <div className="field__header">
              <span className="field__label">by name</span>
              <span className="field__value">
                {visible.length} / {collections.list.length}
              </span>
            </div>
            <input
              type="search"
              className="textfield"
              placeholder="lucide, material, mdi…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          </div>
        </Group>

        <Group title="Display">
          <Slider
            label="Cell size"
            value={cellSize}
            min={48}
            max={160}
            step={4}
            unit="px"
            onChange={setCellSize}
          />
          <Slider
            label="Cell gap"
            value={cellGap}
            min={0}
            max={16}
            unit="px"
            onChange={setCellGap}
          />
          <p className="group__hint">
            Columns auto-fill by cell size. Each family renders at most{' '}
            {PER_FAMILY_CAP.toLocaleString()} icons into the DOM — keeps the
            page responsive.
          </p>
        </Group>

        <Group title="View">
          <Toggle
            label="Performance HUD"
            value={hudActive}
            onChange={setHudActive}
          />
          <p className="group__hint">
            Optical on: each cell paints the corrected body over a faint
            ghost of the source — the gap is the build-time shift.
          </p>
        </Group>
      </aside>

      <main className="view__main">
        <section className="stress">
          <div className="stress__bar">
            <span>
              <strong>{visible.length}</strong> /{' '}
              {collections.list.length} families · expanded{' '}
              <strong>{expanded.size}</strong> · cells in DOM{' '}
              <strong>{cellsInDom.toLocaleString()}</strong>
            </span>
            <span>
              cap/family{' '}
              <strong>{PER_FAMILY_CAP.toLocaleString()}</strong> · cell{' '}
              <strong>{cellSize}px</strong>
              {familyQ.active + familyQ.waiting > 0 && (
                <>
                  {' '}
                  · queue{' '}
                  <strong>
                    {familyQ.active}+{familyQ.waiting}
                  </strong>
                </>
              )}
            </span>
          </div>

          <div
            className="stress__scroll"
            data-theme="light"
            ref={scrollRef}
          >
            {!collections.ready && (
              <div className="stress__loading">
                loading collections…
              </div>
            )}
            {collections.ready && visible.length === 0 && (
              <div className="stress__loading">
                no collections match the current filter.
              </div>
            )}
            {collections.ready &&
              visible.map((c) => (
                <IconifyFamily
                  key={c.prefix}
                  collection={c}
                  cellSize={cellSize}
                  cellGap={cellGap}
                  optical={optical}
                  expanded={expanded.has(c.prefix)}
                  perFamilyLimit={PER_FAMILY_CAP}
                  onToggle={() => toggleExpanded(c.prefix)}
                  onCellsChange={handleCellsChange(c.prefix)}
                />
              ))}
          </div>

          {hudActive && (
            <PerfHud
              perf={perf}
              families={{ loaded: expanded.size, total: visible.length }}
              cells={cellsInDom}
              loaded={loaded}
              fetch={familyQ}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group">
      <h3 className="group__title">{title}</h3>
      {children}
    </div>
  );
}
