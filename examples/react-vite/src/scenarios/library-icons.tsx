/**
 * Headline scenario: lucide-react-style icon components with
 * CSS-only optical centering.
 *
 * The named exports — Play, Heart, ArrowRight, Bell, FaStar, …
 * (defined in `../components/icons.tsx`) — are plain `<span>`
 * wrappers around the CSS classes in `src/styles/icons.css`. Each
 * class mounts the underlying SVG via `mask-image` /
 * `background-image` from a real installed icon package
 * (`lucide-static`, `heroicons`, `@fortawesome/fontawesome-free`)
 * and adds `optical-center: auto` so the PostCSS plugin rewrites
 * the URL to a corrected data URI at build time.
 *
 * The DX is identical to what you'd write with lucide-react:
 *
 *   import { Play, Heart, ArrowRight } from './components/icons';
 *   <Play />
 *   <Heart />
 *
 * Implementation is 100% CSS. No runtime, no React hook, no JS at
 * the icon mount point.
 */

import {
  ArrowRight,
  Bell,
  FaFlag,
  FaPaperPlane,
  FaPlay,
  FaStar,
  Heart,
  MagnifyingGlass,
  Play,
  Send,
} from '../components/icons.js';
import { Section, Row } from '../components/Row.js';

function Recipe() {
  const html = [
    `<span class="c">// components/icons.tsx — one helper, one line per icon</span>`,
    `<span class="k">const</span> <span class="h">make</span> <span class="k">=</span> (cls) <span class="k">=&gt;</span> () <span class="k">=&gt;</span> <span class="k">&lt;span</span> <span class="h">className</span><span class="k">=</span><span class="s">{\`icon \${cls} optical\`}</span><span class="k">/&gt;</span>;`,
    `<span class="k">export const</span> <span class="h">Play</span>       <span class="k">=</span> <span class="h">make</span>(<span class="s">'icon-lucide-play'</span>);`,
    `<span class="k">export const</span> <span class="h">Heart</span>      <span class="k">=</span> <span class="h">make</span>(<span class="s">'icon-lucide-heart'</span>);`,
    `<span class="k">export const</span> <span class="h">ArrowRight</span> <span class="k">=</span> <span class="h">make</span>(<span class="s">'icon-lucide-arrow-right'</span>);`,
    ``,
    `<span class="c">// component.tsx — lucide-react DX, CSS-only centering</span>`,
    `<span class="k">import</span> { <span class="h">Play, Heart, ArrowRight</span> } <span class="k">from</span> <span class="s">'./components/icons'</span>;`,
    `<span class="k">&lt;Play</span> <span class="k">/&gt;</span>   <span class="c">// → &lt;span class="icon icon-lucide-play optical"/&gt;</span>`,
    `<span class="k">&lt;Heart</span> <span class="k">/&gt;</span>`,
    ``,
    `<span class="c">/* styles/icons.css — the only place SVG paths are mentioned */</span>`,
    `<span class="h">.icon-lucide-play.optical</span> <span class="k">{</span>`,
    `  <span class="k">-webkit-mask-image:</span> <span class="k">url(</span><span class="s">'lucide-static/icons/play.svg'</span><span class="k">);</span>`,
    `          <span class="k">mask-image:</span> <span class="k">url(</span><span class="s">'lucide-static/icons/play.svg'</span><span class="k">);</span>`,
    `  <span class="k">optical-center:</span> <span class="s">auto</span><span class="k">;</span>   <span class="c">/* ← only line that differs from non-optical */</span>`,
    `<span class="k">}</span>`,
  ].join('\n');
  return <pre className="recipe" dangerouslySetInnerHTML={{ __html: html }} />;
}

interface IconRowProps {
  readonly label: string;
  readonly Geo: React.ComponentType<{ optical?: boolean }>;
  readonly Opt?: React.ComponentType<{ optical?: boolean }>;
}

function IconRow({ label, Geo, Opt }: IconRowProps) {
  const Optical = Opt ?? Geo;
  return (
    <Row
      label={label}
      geometric={<Geo optical={false} />}
      optical={<Optical />}
    />
  );
}

export function LibraryIcons() {
  return (
    <Section
      title="1. Real icon components, CSS-only optical centering"
      path="build-time"
      description={
        <>
          <code>{`<Play />`}</code> / <code>{`<Heart />`}</code> /{' '}
          <code>{`<ArrowRight />`}</code> — same DX as
          <code>lucide-react</code>, different implementation. Each
          named export is a plain <code>{`<span>`}</code> with a CSS
          class. The class mounts the SVG from an installed npm
          package (<code>lucide-static</code>, <code>heroicons</code>,{' '}
          <code>@fortawesome/fontawesome-free</code>) via{' '}
          <code>mask-image</code> and adds{' '}
          <code>optical-center: auto</code>. The PostCSS plugin (Vite
          picks up <code>postcss.config.js</code> automatically)
          rewrites that URL to a corrected data URI at build time.
        </>
      }
    >
      <Recipe />

      <div className="col-head">
        <span>geometric</span>
        <span>optical-center: auto</span>
        <span>component</span>
      </div>

      <h3>lucide-static (npm) — &lt;Play /&gt; style imports</h3>
      <IconRow label="<Play />"        Geo={Play} />
      <IconRow label="<ArrowRight />"  Geo={ArrowRight} />
      <IconRow label="<Heart />"       Geo={Heart} />
      <IconRow label="<Send />"        Geo={Send} />

      <h3>heroicons (npm)</h3>
      <IconRow label="<Bell />"            Geo={Bell} />
      <IconRow label="<MagnifyingGlass />" Geo={MagnifyingGlass} />

      <h3>@fortawesome/fontawesome-free (npm — non-square viewBoxes)</h3>
      <IconRow label="<FaPlay />"       Geo={FaPlay} />
      <IconRow label="<FaStar />"       Geo={FaStar} />
      <IconRow label="<FaPaperPlane />" Geo={FaPaperPlane} />

      <h3>background-image (full-color FA flag)</h3>
      <IconRow label="<FaFlag />" Geo={FaFlag} />
    </Section>
  );
}
