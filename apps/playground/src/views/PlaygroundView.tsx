import { useMemo, useState } from 'react';

import { Badge } from '../components/Badge.js';
import { OffsetReadout } from '../components/OffsetReadout.js';
import { IconPicker } from '../components/controls/IconPicker.js';
import { Segmented } from '../components/controls/Segmented.js';
import { Slider } from '../components/controls/Slider.js';
import { SwatchRow } from '../components/controls/SwatchRow.js';
import { Toggle } from '../components/controls/Toggle.js';
import { getIcon, offsetPercent } from '../icons/registry.js';
import { palette } from '../lib/theme.js';

type CompareMode = 'split' | 'optical';
type Shape = 'circle' | 'rounded' | 'square';
type CanvasTheme = 'light' | 'dark';

const SHAPE_OPTIONS = [
  { value: 'circle', label: 'circle' },
  { value: 'rounded', label: 'rounded' },
  { value: 'square', label: 'square' },
] as const;

const COMPARE_OPTIONS = [
  { value: 'split', label: 'split' },
  { value: 'optical', label: 'single' },
] as const;

const THEME_OPTIONS = [
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
] as const;

const CANVAS_SWATCHES = [
  { id: 'light', label: 'paper', color: palette.neutral['50'] },
  { id: 'dark', label: 'ink', color: palette.neutral['950'] },
];

/**
 * Main playground. Pick an icon, drag sliders for badge size / icon
 * size, flip shape + canvas theme. The stage shows a geometric vs
 * optical pair (or a single optical badge) and the bottom strip
 * spells out the pre-computed viewBox the build emits.
 *
 * Every offset on this view is *build-time*: the `optical-center/vite`
 * plugin body-wraps `icons.json` (an Iconify-shaped set) like any other
 * icon data, and `registry.ts` reconstructs the corrected viewBox from that
 * wrap. No precompute script, no committed offset file. This curated demo
 * shows the viewBox-rewrite surface (what the Babel / inline-SVG / CSS paths
 * emit); the runtime path never touches the model.
 */
export function PlaygroundView() {
  const [iconId, setIconId] = useState<string>('play');
  const [badgeSize, setBadgeSize] = useState(220);
  const [iconSize, setIconSize] = useState(55); // percent of container
  const [shape, setShape] = useState<Shape>('circle');
  const [compare, setCompare] = useState<CompareMode>('split');
  const [theme, setTheme] = useState<CanvasTheme>('light');
  const [crosshair, setCrosshair] = useState(true);

  const icon = useMemo(() => getIcon(iconId), [iconId]);
  const offset = useMemo(() => offsetPercent(icon), [icon]);

  const badgesMode = compare === 'split' ? 'split' : 'single';

  return (
    <div className="view">
      <aside className="view__sidebar">
        <Group title="Icon">
          <IconPicker value={iconId} onChange={setIconId} />
        </Group>

        <Group title="Container">
          <Slider
            label="Badge size"
            value={badgeSize}
            min={80}
            max={480}
            step={4}
            unit="px"
            onChange={setBadgeSize}
          />
          <Segmented
            label="Shape"
            value={shape}
            options={SHAPE_OPTIONS}
            onChange={setShape}
          />
        </Group>

        <Group title="Icon scale">
          <Slider
            label="Icon size"
            value={iconSize}
            min={10}
            max={100}
            unit="%"
            onChange={setIconSize}
          />
        </Group>

        <Group title="View">
          <Segmented
            label="Comparison"
            value={compare}
            options={COMPARE_OPTIONS}
            onChange={setCompare}
          />
          <SwatchRow
            label="Canvas"
            value={theme}
            options={CANVAS_SWATCHES}
            onChange={(id) => setTheme(id as CanvasTheme)}
          />
          <Segmented
            label="Theme tokens"
            value={theme}
            options={THEME_OPTIONS}
            onChange={setTheme}
          />
          <Toggle
            label="Show crosshair"
            value={crosshair}
            onChange={setCrosshair}
          />
        </Group>

        <p className="group__hint">
          The optical badge ships a pre-corrected{' '}
          <code>&lt;svg viewBox=…&gt;</code> — exactly what the package's{' '}
          <code>optical-center/babel</code> +{' '}
          <code>optical-center/postcss</code> emit in production. No
          runtime model, no canvas, no compute on the page.
        </p>
      </aside>

      <main className="view__main">
        <section className="stage">
          <div className="stage__bar">
            <span>
              icon: <strong>{icon.name}</strong> &nbsp;·&nbsp; badge:{' '}
              <strong>
                {badgeSize}px {shape}
              </strong>{' '}
              &nbsp;·&nbsp; mode:{' '}
              <strong>
                {compare === 'split' ? 'geometric / optical' : 'optical'}
              </strong>
            </span>
            <span className="stage__bar-tag">
              <span className="stage__bar-tag-dot" />
              pre-compiled
            </span>
          </div>

          <div className="stage__canvas" data-theme={theme}>
            <div className="badges" data-mode={badgesMode}>
              {compare === 'split' && (
                <div className="badge-col">
                  <Badge
                    icon={icon}
                    badgeSize={badgeSize}
                    iconSizePct={iconSize}
                    shape={shape}
                    optical={false}
                    crosshair={crosshair}
                  />
                  <span className="badge-col__caption">
                    <span className="badge-col__caption-tag">geometric</span>
                    {icon.viewBox.join(' ')}
                  </span>
                </div>
              )}
              <div className="badge-col">
                <Badge
                  icon={icon}
                  badgeSize={badgeSize}
                  iconSizePct={iconSize}
                  shape={shape}
                  optical
                  crosshair={crosshair}
                />
                <span className="badge-col__caption">
                  <span className="badge-col__caption-tag badge-col__caption-tag--optical">
                    optical
                  </span>
                  {offset.dxPercent.toFixed(2)}% × {offset.dyPercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <OffsetReadout
            icon={icon}
            badgeSize={badgeSize}
            iconSizePct={iconSize}
          />
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
