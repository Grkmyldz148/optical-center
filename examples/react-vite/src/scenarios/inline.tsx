/**
 * Scenario 1: Inline `<svg opticalCenter>` JSX.
 *
 * Build-time path. The Babel plugin sees the static <svg> subtree,
 * rasterizes it, rewrites viewBox before the JSX hits the runtime.
 * Zero runtime cost. Works for SVGs you author or copy-paste.
 */

import { Section, Row } from '../components/Row.js';

export function Inline() {
  return (
    <Section
      title="1. Inline JSX (Babel plugin)"
      path="build-time"
      description={
        <>
          Static <code>&lt;svg opticalCenter&gt;</code> subtrees in JSX
          source. Rewritten by <code>optical-center/babel</code> at
          build; runtime sees no marker.
        </>
      }
    >
      <Row
        label="lucide / play"
        geometric={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        }
        optical={
          <svg opticalCenter viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        }
      />
      <Row
        label="lucide / arrow-right"
        geometric={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        }
        optical={
          <svg opticalCenter viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        }
      />
      <Row
        label="edge-case / asymmetric-triangle"
        geometric={
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 12 L22 4 L22 20 Z" />
          </svg>
        }
        optical={
          <svg opticalCenter viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 12 L22 4 L22 20 Z" />
          </svg>
        }
      />
    </Section>
  );
}
