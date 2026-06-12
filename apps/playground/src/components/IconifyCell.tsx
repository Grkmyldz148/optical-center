import { memo } from 'react';

import type { ResolvedIcon } from '../lib/iconifyLocal.js';

interface IconifyCellProps {
  readonly icon: ResolvedIcon;
  /** When true, paint the optically-corrected body instead of the source. */
  readonly optical: boolean;
}

/**
 * One Iconify cell.
 *
 * Both bodies share the same `viewBox` — the optical-center plugin bakes
 * the shift into the icon *body* (an inner `<g transform="translate(…)">`),
 * not the window. So the toggle swaps the body string, never the viewBox:
 *
 *   optical off → `icon.sourceBody`  (wrapper stripped)
 *   optical on  → `icon.body`        (wrapper intact)
 *
 * Exactly what the package ships in production — there is no runtime model
 * on the page; the cell just picks one of two body strings.
 *
 * Ghost layer
 * -----------
 * With `optical` on, the cell paints both: the source body underneath at
 * low opacity, the corrected body on top. The visible gap between the two
 * is the optical shift — without it the median Lucide correction (~2.7% of
 * the viewBox) is sub-pixel at typical cell sizes and the toggle looks like
 * it does nothing.
 */
export const IconifyCell = memo(function IconifyCell({
  icon,
  optical,
}: IconifyCellProps) {
  const viewBox = `${icon.left} ${icon.top} ${icon.width} ${icon.height}`;
  const activeBody = optical ? icon.body : icon.sourceBody;

  return (
    <div
      className="iconifycell"
      data-optical={optical ? '' : undefined}
      title={`${icon.prefix}:${icon.name}`}
      aria-label={`${icon.prefix} ${icon.name}`}
    >
      {optical && (
        <span
          className="iconifycell__ghost"
          aria-hidden="true"
          title="source body (before optical correction)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={viewBox}
            dangerouslySetInnerHTML={{ __html: icon.sourceBody }}
          />
        </span>
      )}
      <span className="iconifycell__svg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={viewBox}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: activeBody }}
        />
      </span>
    </div>
  );
});
