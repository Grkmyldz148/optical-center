/**
 * Scenario 3: real third-party icon packages, mounted via CSS.
 *
 * No icon component, no React hook, no runtime. Each icon is a plain
 * `<span class="icon icon-... optical" />` whose CSS class lives in
 * `src/styles/icons.css`. The PostCSS plugin walks every rule that
 * declares `optical-center: auto` and rewrites the `url(...)` inside
 * to a corrected data URI at build time.
 *
 * Three real npm icon packages, side by side:
 *   - lucide-static (square 24x24)
 *   - heroicons     (square 24x24, different style)
 *   - @fortawesome/fontawesome-free (non-square viewBoxes)
 *
 * The point: optical centering happens entirely in CSS. Whoever writes
 * the markup never sees the pipeline.
 */

import { Section, Row } from '../components/Row.js';

interface IconRowProps {
  readonly label: string;
  readonly className: string;
  readonly mode?: 'mask' | 'background';
}

function IconRow({ label, className, mode = 'mask' }: IconRowProps) {
  const baseClass = mode === 'mask' ? 'icon' : 'bg-icon';
  return (
    <Row
      label={label}
      geometric={<span className={`${baseClass} ${className}`} />}
      optical={<span className={`${baseClass} ${className} optical`} />}
    />
  );
}

export function LibraryIcons() {
  return (
    <Section
      title="3. Third-party icon packages, CSS-mounted"
      path="build-time"
      description={
        <>
          Real installed npm packages — <code>lucide-static</code>,{' '}
          <code>heroicons</code>, <code>@fortawesome/fontawesome-free</code>.
          Each icon is a plain <code>&lt;span&gt;</code>; the optical
          variants add one class (<code>.optical</code>). The PostCSS
          plugin sees <code>optical-center: auto</code> in those rules
          and rewrites the masked SVG at build time. No runtime, no
          React hook, no JS at the icon mount point.
        </>
      }
    >
      <h3>lucide-static</h3>
      <IconRow label=".icon-lucide-play"        className="icon-lucide-play" />
      <IconRow label=".icon-lucide-arrow-right" className="icon-lucide-arrow-right" />
      <IconRow label=".icon-lucide-heart"       className="icon-lucide-heart" />
      <IconRow label=".icon-lucide-send"        className="icon-lucide-send" />

      <h3>heroicons</h3>
      <IconRow label=".icon-heroicons-bell"             className="icon-heroicons-bell" />
      <IconRow label=".icon-heroicons-magnifying-glass" className="icon-heroicons-magnifying-glass" />

      <h3>@fortawesome/fontawesome-free (non-square viewBoxes)</h3>
      <IconRow label=".icon-fa-play"        className="icon-fa-play" />
      <IconRow label=".icon-fa-star"        className="icon-fa-star" />
      <IconRow label=".icon-fa-paper-plane" className="icon-fa-paper-plane" />

      <h3>background-image (full-color, FA flag)</h3>
      <IconRow
        label=".bg-icon-fa-flag (background-image)"
        className="bg-icon-fa-flag"
        mode="background"
      />
    </Section>
  );
}
