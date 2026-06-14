// Scenario: directive on a CSS rule whose `mask: url(...svg)` mounts
// the icon. The PostCSS plugin rewrites the URL's viewBox at build
// time and inlines it as a `data:` URI:
//
//   .icon-play {
//     mask: url('lucide-static/icons/play.svg') center / contain no-repeat;
//     optical-center: auto;
//   }
//
//   →
//
//   .icon-play {
//     mask: url('data:image/svg+xml;utf8,…rewritten…') center / contain no-repeat;
//     --optical-center: auto;   /* tracer for DevTools */
//   }
//
// The shift is internal to the mask asset; the element doesn't need
// a `translate`. Centering of the element is the consumer's layout
// concern — here we use the project-wide `.badge-css` container
// directive (PostCSS emits the flex centering for it).

import { BadgeComparison } from '../components/BadgeComparison.js';
import { ScenarioSection } from '../components/ScenarioSection.js';

const RECIPE = `.icon-play {
  display: inline-block;
  width: 24px;
  height: 24px;
  background: currentColor;
  mask: url('lucide-static/icons/play.svg') center / contain no-repeat;
  optical-center: auto;
}`;

export function CssMask() {
  return (
    <ScenarioSection
      title="CSS mask-image"
      description={
        <>
          A utility class mounts the SVG via{' '}
          <code>mask-image</code> and recolours it with{' '}
          <code>currentColor</code>. <code>optical-center: auto</code>{' '}
          on the same rule rewrites the underlying SVG's{' '}
          <code>viewBox</code> at build time and inlines it as a{' '}
          <code>data:image/svg+xml,…</code> URI.
        </>
      }
      recipe={RECIPE}
    >
      <BadgeComparison
        label={`<span class="icon-play" />`}
        geometric={
          <div className="badge badge-center">
            <span className="icon-play-geometric" />
          </div>
        }
        optical={
          <div className="badge badge-css">
            <span className="icon-play" />
          </div>
        }
      />
    </ScenarioSection>
  );
}
