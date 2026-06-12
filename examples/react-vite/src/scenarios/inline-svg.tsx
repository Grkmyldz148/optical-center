// Scenario: hand-written `<svg>` inside a JSX-attribute wrapper.
//
//   <div optical-center="auto">
//     <svg viewBox="0 0 24 24" …>
//       <polygon points="6 3 20 12 6 21 6 3" />
//     </svg>
//   </div>
//
// Babel finds the first descendant `<svg>` and rewrites its
// `viewBox` so the perceptual shift is baked into the asset itself
// (rather than applied via `translate` on the element). No
// component lookup is needed — the SVG is literal JSX in this file.
//
// IMPORTANT: the `<svg>` subtree must be FULLY STATIC. No spread
// attributes, no `{expression}` children, no fragments. That's why
// the polygon below is duplicated verbatim across the two badge
// cells instead of being extracted into a shared constant or
// helper — pulling it through any indirection trips Babel's
// static-subtree validation and the viewBox rewrite silently
// declines.

import { BadgeComparison } from '../components/BadgeComparison.js';
import { ScenarioSection } from '../components/ScenarioSection.js';

const RECIPE = `<div optical-center="auto">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
</div>`;

export function InlineSvg() {
  return (
    <ScenarioSection
      title="Hand-written inline SVG"
      description={
        <>
          A static <code>&lt;svg&gt;</code> subtree authored
          directly in JSX. Wrap it in a container with{' '}
          <code>optical-center="auto"</code> and Babel rewrites the{' '}
          <code>viewBox</code> at compile time — the perceptual
          shift is baked into the asset, no <code>translate</code>{' '}
          on the element. The subtree must be fully static.
        </>
      }
      recipe={RECIPE}
    >
      <BadgeComparison
        label={`<div optical-center="auto"><svg /></div>`}
        geometric={
          <div className="badge badge-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </div>
        }
        optical={
          <div className="badge badge-inline" optical-center="auto">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </div>
        }
      />
    </ScenarioSection>
  );
}
