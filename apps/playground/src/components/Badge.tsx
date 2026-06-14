import type { CSSProperties } from 'react';

import type { PlaygroundIcon } from '../icons/registry.js';

interface BadgeProps {
  readonly icon: PlaygroundIcon;
  /** Container size in CSS pixels (square). */
  readonly badgeSize: number;
  /** Icon size as a percent of the container (e.g. 50 = 50%). */
  readonly iconSizePct: number;
  /** Visual shape — circle, rounded square, or square. */
  readonly shape: 'circle' | 'rounded' | 'square';
  /**
   * When `true`, render the icon with the *pre-computed* corrected
   * viewBox baked into the registry. When `false`, render the
   * original viewBox (geometric center).
   *
   * No translate, no CSS magic — the optical correction lives
   * entirely inside the `<svg viewBox=…>` attribute, the same way
   * `optical-center/postcss` and `optical-center/babel` ship a flat
   * pre-corrected asset in production.
   */
  readonly optical: boolean;
  /** Crosshair overlay through the badge centre. */
  readonly crosshair: boolean;
}

export function Badge({
  icon,
  badgeSize,
  iconSizePct,
  shape,
  optical,
  crosshair,
}: BadgeProps) {
  const [x, y, w, h] = optical ? icon.opticalViewBox : icon.viewBox;
  const radius =
    shape === 'circle' ? '50%' : shape === 'rounded' ? '22%' : '0%';
  const style = {
    ['--badge-size' as string]: `${badgeSize}px`,
    ['--badge-radius' as string]: radius,
    ['--icon-size' as string]: `${iconSizePct}%`,
  } as CSSProperties;

  return (
    <div className="badge" data-crosshair={crosshair} style={style}>
      <span
        className="badge__icon"
        data-optical-center={optical ? '' : undefined}
      >
        <svg
          viewBox={`${x} ${y} ${w} ${h}`}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: icon.body }}
        />
      </span>
    </div>
  );
}
