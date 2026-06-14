// Scenario: directive via Tailwind utility class.
//
//   <div className="optical-center">
//     <Play />
//   </div>
//
// Same end-state as the CSS-class scenario, but the directive
// arrives via a Tailwind utility instead of a hand-written CSS
// rule. The plugin shipped at `optical-center/tailwind` registers
// `.optical-center { optical-center: auto }` as a component, and
// the PostCSS plugin expands it the same way it expands any other
// container rule.

import { Play } from 'lucide-react';

import { BadgeComparison } from '../components/BadgeComparison.js';
import { ScenarioSection } from '../components/ScenarioSection.js';

const RECIPE = `// tailwind.config.js
import opticalCenter from 'optical-center/tailwind';
export default { plugins: [opticalCenter] };

// scenario.tsx
import { Play } from 'lucide-react';

<div className="optical-center">
  <Play />
</div>`;

export function TailwindUtility() {
  return (
    <ScenarioSection
      title="Tailwind utility"
      description={
        <>
          Use <code>optical-center</code> like any other Tailwind
          class. The Tailwind plugin at{' '}
          <code>optical-center/tailwind</code> registers the utility,
          our PostCSS plugin expands it into the same centering
          block + child translate the CSS-class scenario produces.
          No JSX attribute, no hand-written CSS rule.
        </>
      }
      recipe={RECIPE}
    >
      <BadgeComparison
        label={`<div class="optical-center"><Play /></div>`}
        geometric={
          <div className="badge badge-center">
            <Play />
          </div>
        }
        optical={
          <div className="badge optical-center">
            <Play />
          </div>
        }
      />
    </ScenarioSection>
  );
}
