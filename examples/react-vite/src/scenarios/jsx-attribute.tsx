// Scenario: directive as a JSX attribute on a plain wrapper.
//
//   <div optical-center="auto">
//     <Play />
//   </div>
//
// No CSS class on the wrapper, no PostCSS rule, no Tailwind plugin.
// The Babel plugin reads the JSX attribute, resolves `<Play />`
// against the file's `lucide-react` import to find its source SVG,
// computes the perceptual offset at compile time, and injects two
// inline styles:
//
//   <div style={{ display: 'flex' }} data-optical-center="">
//     <Play style={{ margin: 'auto', translate: '4.3365% 2.604%' }} />
//   </div>
//
// Hand-written `<svg>` children work the same way — Babel rewrites
// the `viewBox` in place instead of emitting a translate (see the
// inline-svg scenario for that variant).

import { Play } from 'lucide-react';

import { BadgeComparison } from '../components/BadgeComparison.js';
import { ScenarioSection } from '../components/ScenarioSection.js';

const RECIPE = `import { Play } from 'lucide-react';

<div optical-center="auto">
  <Play />
</div>`;

export function JsxAttribute() {
  return (
    <ScenarioSection
      title="JSX attribute on container"
      description={
        <>
          Drop the directive on a plain wrapper as a JSX attribute.
          The Babel plugin finds the icon child (hand-written{' '}
          <code>&lt;svg&gt;</code> or imported component), computes
          the perceptual offset from its source SVG at compile time,
          and injects centering + translate as inline styles. No CSS
          class, no Tailwind plugin, no PostCSS directive — Babel
          carries the whole scenario.
        </>
      }
      recipe={RECIPE}
    >
      <BadgeComparison
        label={`<div optical-center="auto"><Play /></div>`}
        geometric={
          <div className="badge badge-center">
            <Play />
          </div>
        }
        optical={
          <div className="badge" optical-center="auto">
            <Play />
          </div>
        }
      />
    </ScenarioSection>
  );
}
