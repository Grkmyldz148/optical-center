import type { PlaygroundIcon } from '../icons/registry.js';
import { offsetPercent } from '../icons/registry.js';

interface OffsetReadoutProps {
  readonly icon: PlaygroundIcon;
  /** Container size in display px — used for the "display px" cell. */
  readonly badgeSize: number;
  /** Icon size as percent of container — used to convert to absolute icon px. */
  readonly iconSizePct: number;
}

/**
 * Numeric breakdown of the *build-time* optical correction for the
 * currently-displayed curated icon. Everything here is reconstructed from
 * the body-wrap the `optical-center/vite` plugin bakes into `icons.json` —
 * no runtime rasterize, no model, nothing to time.
 */
export function OffsetReadout({
  icon,
  badgeSize,
  iconSizePct,
}: OffsetReadoutProps) {
  const { dxPercent, dyPercent } = offsetPercent(icon);
  const [ox, oy, ow] = icon.viewBox;
  const [px, py] = icon.opticalViewBox;
  const dxUnits = ox - px;
  const dyUnits = oy - py;
  const iconPx = (badgeSize * iconSizePct) / 100;
  const dxDisplayPx = (dxPercent / 100) * iconPx;
  const dyDisplayPx = (dyPercent / 100) * iconPx;

  return (
    <div className="readout">
      <Cell
        label="Source viewBox"
        value={`${icon.viewBox.join(' ')}`}
        sub={`${ow}-unit grid`}
      />
      <Cell
        label="Optical viewBox (build-time)"
        value={`${icon.opticalViewBox.join(' ')}`}
        sub={`shift ${fmt(dxUnits)} × ${fmt(dyUnits)} units`}
        accent
      />
      <Cell
        label="Percent of icon"
        value={`${fmtPct(dxPercent)} × ${fmtPct(dyPercent)}`}
      />
      <Cell
        label={`Display offset @ ${iconPx.toFixed(0)}px icon`}
        value={`${dxDisplayPx.toFixed(2)} × ${dyDisplayPx.toFixed(2)} px`}
        sub="zero runtime cost"
      />
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="readout__cell">
      <span className="readout__label">{label}</span>
      <span
        className={
          accent ? 'readout__value readout__value--accent' : 'readout__value'
        }
      >
        {value}
      </span>
      {sub && <span className="readout__sub">{sub}</span>}
    </div>
  );
}

function fmt(v: number) {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}`;
}
function fmtPct(v: number) {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%`;
}
