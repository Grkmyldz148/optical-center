import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { IconifyCell } from './IconifyCell.js';
import type { CollectionEntry } from '../lib/useCollections.js';
import {
  loadIconSet,
  type ResolvedIcon,
} from '../lib/iconifyLocal.js';
import { runUnderFamilyGate } from '../lib/familyLoadQueue.js';
import { clsx } from '../lib/clsx.js';

type Status = 'collapsed' | 'queued' | 'fetching' | 'ready' | 'error';

interface IconifyFamilyProps {
  readonly collection: CollectionEntry;
  readonly cellSize: number;
  readonly cellGap: number;
  readonly optical: boolean;
  readonly expanded: boolean;
  readonly perFamilyLimit: number;
  readonly onToggle: () => void;
  readonly onCellsChange?: (count: number) => void;
}

/**
 * One family section.
 *
 * State machine
 * -------------
 *   collapsed → user clicks chevron
 *   queued    → waiting for a family-queue slot
 *   fetching  → the set module imports; cells stream in via rAF chunks
 *   ready     → all icons in DOM
 *   error     → import failed; user can retry
 *
 * The set is a real `import('@iconify/json/json/<prefix>.json')`, already
 * body-wrapped at build/dev time by `optical-center/vite`. Each cell carries
 * both the corrected body and the source body (the wrapper stripped back
 * off) so the toggle is an instant swap. Once `ready`, collapsing keeps
 * icons in memory — re-expand is an instant CSS toggle, no re-import.
 */
export const IconifyFamily = memo(function IconifyFamily({
  collection,
  cellSize,
  cellGap,
  optical,
  expanded,
  perFamilyLimit,
  onToggle,
  onCellsChange,
}: IconifyFamilyProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [icons, setIcons] = useState<ResolvedIcon[]>([]);
  const [status, setStatus] = useState<Status>('collapsed');
  const [error, setError] = useState<string | null>(null);
  const [estimatedRows, setEstimatedRows] = useState(1);

  useEffect(() => {
    if (!expanded) return;
    if (icons.length > 0) return;
    if (status === 'fetching' || status === 'queued') return;
    let cancelled = false;
    setStatus('queued');
    setError(null);
    runUnderFamilyGate(collection.prefix, async () => {
      if (cancelled) return;
      setStatus('fetching');
      try {
        const set = await loadIconSet(collection.prefix);
        if (cancelled) return;
        if (!set) {
          setError('manifest missing');
          setStatus('error');
          return;
        }
        const slice = set.names.slice(0, perFamilyLimit);
        const resolved: ResolvedIcon[] = [];
        for (const name of slice) {
          const icon = set.icons.get(name);
          if (icon) resolved.push(icon);
        }
        await rafChunkedCommit(resolved, setIcons, () => cancelled);
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus('error');
        }
        throw err;
      }
    }).catch(() => {
      /* swallowed — error already routed via setError */
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, collection.prefix, perFamilyLimit]);

  useEffect(() => {
    if (!expanded) return;
    const el = ref.current?.querySelector<HTMLElement>('.ifam__body');
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    const colsEst = Math.max(
      1,
      Math.floor((width + cellGap) / (cellSize + cellGap)),
    );
    const cap = Math.min(collection.total, perFamilyLimit);
    setEstimatedRows(Math.ceil(cap / colsEst));
  }, [expanded, cellSize, cellGap, perFamilyLimit, collection.total]);

  useEffect(() => {
    onCellsChange?.(expanded ? icons.length : 0);
  }, [icons.length, expanded, onCellsChange]);

  const style = useMemo(
    () =>
      ({
        ['--cell-size' as string]: `${cellSize}px`,
        ['--cell-gap' as string]: `${cellGap}px`,
      }) as CSSProperties,
    [cellSize, cellGap],
  );

  const placeholderHeight =
    expanded && icons.length === 0
      ? estimatedRows * (cellSize + cellGap) + cellGap
      : 0;

  const headerStatusLabel = headerStatus(status, icons.length);

  return (
    <section
      ref={ref}
      className={clsx('ifam', expanded && 'ifam--expanded')}
      style={style}
    >
      <button
        type="button"
        className="ifam__header"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`ifam-body-${collection.prefix}`}
      >
        <svg
          className="ifam__chevron"
          viewBox="0 0 16 16"
          aria-hidden="true"
          width="16"
          height="16"
        >
          <path
            d="M6 4 L10 8 L6 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="ifam__head-main">
          <span className="ifam__title">{collection.name}</span>
          <span className="ifam__prefix">{collection.prefix}</span>
        </span>
        <span className="ifam__head-meta">
          {headerStatusLabel && (
            <span className="ifam__status">{headerStatusLabel}</span>
          )}
          <span className="ifam__count">
            {icons.length > 0 && expanded
              ? `${icons.length.toLocaleString()} / ${collection.total.toLocaleString()}`
              : collection.total.toLocaleString()}
          </span>
          {collection.license && (
            <span
              className="ifam__license"
              title={collection.spdx ?? collection.license}
            >
              {collection.license}
            </span>
          )}
        </span>
      </button>

      {expanded && (
        <div
          id={`ifam-body-${collection.prefix}`}
          className="ifam__body"
          style={
            placeholderHeight > 0
              ? ({ minHeight: `${placeholderHeight}px` } as CSSProperties)
              : undefined
          }
        >
          {status === 'error' && (
            <div className="ifam__error">
              failed to load: {error}
              <button
                type="button"
                className="ifam__retry"
                onClick={() => {
                  setIcons([]);
                  setError(null);
                  setStatus('collapsed');
                }}
              >
                retry
              </button>
            </div>
          )}

          {status !== 'error' && (
            <div className="ifam__grid">
              {icons.map((icon) => (
                <IconifyCell
                  key={`${icon.prefix}/${icon.name}`}
                  icon={icon}
                  optical={optical}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
});

function headerStatus(status: Status, loadedCount: number): string | null {
  if (status === 'queued') return 'queued';
  if (status === 'fetching' && loadedCount === 0) return 'fetching…';
  if (status === 'fetching') return 'loading…';
  if (status === 'error') return 'error';
  return null;
}

function rafChunkedCommit(
  list: readonly ResolvedIcon[],
  setter: (next: ResolvedIcon[]) => void,
  isCancelled: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    const CHUNK = 60;
    let pos = 0;
    const step = () => {
      if (isCancelled()) {
        resolve();
        return;
      }
      pos = Math.min(pos + CHUNK, list.length);
      setter(list.slice(0, pos));
      if (pos < list.length) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}
