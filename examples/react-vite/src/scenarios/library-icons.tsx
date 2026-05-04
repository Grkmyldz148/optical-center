/**
 * Headline scenario: real third-party icon packages, mounted via CSS,
 * corrected at build time by the PostCSS plugin.
 *
 * No icon component, no React hook, no runtime. Each icon is a plain
 * `<span class="icon icon-... optical" />` whose CSS class lives in
 * `src/styles/icons.css`. The PostCSS plugin walks every rule that
 * declares `optical-center: auto` and rewrites the `url(...)` inside
 * to a corrected data URI at build time.
 *
 * Three real npm packages, side by side:
 *   - lucide-static (square 24x24)
 *   - heroicons     (square 24x24, different style)
 *   - @fortawesome/fontawesome-free (non-square viewBoxes)
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

function Recipe() {
  return (
    <pre className="recipe">
      <span className="c">{`/* src/styles/icons.css */`}</span>{`
`}<span className="h">.icon-lucide-play</span>{` `}<span className="k">{`{`}</span>{`
  `}<span className="k">-webkit-mask-image:</span>{` `}<span className="k">url(</span><span className="s">'lucide-static/icons/play.svg'</span><span className="k">);</span>{`
          `}<span className="k">mask-image:</span>{` `}<span className="k">url(</span><span className="s">'lucide-static/icons/play.svg'</span><span className="k">);</span>{`
`}<span className="k">{`}`}</span>{`
`}<span className="h">.icon-lucide-play.optical</span>{` `}<span className="k">{`{`}</span>{`
  `}<span className="k">-webkit-mask-image:</span>{` `}<span className="k">url(</span><span className="s">'lucide-static/icons/play.svg'</span><span className="k">);</span>{`
          `}<span className="k">mask-image:</span>{` `}<span className="k">url(</span><span className="s">'lucide-static/icons/play.svg'</span><span className="k">);</span>{`
  `}<span className="k">optical-center:</span>{` `}<span className="s">auto</span><span className="k">;</span>{`   `}<span className="c">{`/* ← only line that differs */`}</span>{`
`}<span className="k">{`}`}</span>{`

`}<span className="c">{`// component:`}</span>{`
`}<span className="k">{`<span className="icon icon-lucide-play optical" />`}</span>
    </pre>
  );
}

export function LibraryIcons() {
  return (
    <Section
      title="1. Real icon packages, CSS + optical-center: auto"
      path="build-time"
      description={
        <>
          Three installed npm packages — <code>lucide-static</code>,{' '}
          <code>heroicons</code>, <code>@fortawesome/fontawesome-free</code> —
          mounted via plain <code>mask-image</code> /{' '}
          <code>background-image</code>. The optical variant adds one
          line: <code>optical-center: auto</code>. The PostCSS plugin
          (registered in <code>postcss.config.js</code>, which Vite
          picks up automatically) rewrites the URL to an inline data
          URI of the corrected SVG at build time. No runtime, no hook,
          no JS at the icon mount point.
        </>
      }
    >
      <Recipe />

      <div className="col-head">
        <span>geometric</span>
        <span>+ optical-center: auto</span>
        <span>npm path</span>
      </div>

      <h3>lucide-static (npm)</h3>
      <IconRow label="lucide-static/icons/play.svg"        className="icon-lucide-play" />
      <IconRow label="lucide-static/icons/arrow-right.svg" className="icon-lucide-arrow-right" />
      <IconRow label="lucide-static/icons/heart.svg"       className="icon-lucide-heart" />
      <IconRow label="lucide-static/icons/send.svg"        className="icon-lucide-send" />

      <h3>heroicons (npm)</h3>
      <IconRow label="heroicons/24/solid/bell.svg"             className="icon-heroicons-bell" />
      <IconRow label="heroicons/24/solid/magnifying-glass.svg" className="icon-heroicons-magnifying-glass" />

      <h3>@fortawesome/fontawesome-free (npm — non-square viewBoxes)</h3>
      <IconRow label="@fortawesome/fontawesome-free/svgs/solid/play.svg"        className="icon-fa-play" />
      <IconRow label="@fortawesome/fontawesome-free/svgs/solid/star.svg"        className="icon-fa-star" />
      <IconRow label="@fortawesome/fontawesome-free/svgs/solid/paper-plane.svg" className="icon-fa-paper-plane" />

      <h3>background-image instead of mask-image (full-color)</h3>
      <IconRow
        label="@fortawesome/fontawesome-free/svgs/solid/flag.svg"
        className="bg-icon-fa-flag"
        mode="background"
      />
    </Section>
  );
}
