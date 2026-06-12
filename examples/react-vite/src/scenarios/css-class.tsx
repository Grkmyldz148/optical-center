// Scenario: container-side directive on a CSS class.
//
//   .badge-optical { optical-center: auto; }
//
// The PostCSS plugin scans every `.tsx`/`.jsx` once at build time,
// sees `<Play />` (from `lucide-react`) nested inside an element
// that uses `.badge-optical`, maps the class to the package's source
// SVG, computes the perceptual offset, and emits:
//
//   .badge-optical { display: flex; --optical-center: auto; }
//   .badge-optical > * { margin: auto; translate: 4.3365% 2.604%; }
//
// The canonical container-side pattern: directive on the wrapper's
// CSS class, just like `justify-content: center` lives on a flex
// parent.

import { Play } from 'lucide-react';

import { BadgeComparison } from '../components/BadgeComparison.js';
import { ScenarioSection } from '../components/ScenarioSection.js';

const RECIPE = `/* styles/icons.css */
.badge-optical { optical-center: auto; }

/* scenario.tsx */
import { Play } from 'lucide-react';

<div className="badge-optical">
  <Play />
</div>`;

export function CssClass() {
  return (
    <ScenarioSection
      title="CSS class on container"
      description={
        <>
          The canonical container-side pattern. Put{' '}
          <code>optical-center: auto</code> on a CSS class, attach
          that class to the wrapper, drop the icon component inside.
          The PostCSS plugin scans the project's JSX once, links the
          class to the icon's SVG, and emits centering + translate.
          No path lives in the CSS, no markup change at the icon.
        </>
      }
      recipe={RECIPE}
    >
      <BadgeComparison
        label={`<div class="badge-optical"><Play /></div>`}
        geometric={
          <div className="badge badge-center">
            <Play />
          </div>
        }
        optical={
          <div className="badge badge-optical">
            <Play />
          </div>
        }
      />
    </ScenarioSection>
  );
}
