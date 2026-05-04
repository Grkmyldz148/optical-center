/**
 * Scenario 2: inline JSX `<svg optical-center="auto">`.
 *
 * Build-time path. The Babel plugin sees the static <svg> subtree at
 * compile time, rasterizes it, rewrites viewBox before the JSX hits
 * the runtime. Zero runtime cost. Works for SVGs you author or
 * paste from a design tool / icon library's source.
 *
 * The opt-in attribute mirrors the CSS directive 1:1:
 *
 *   CSS:   .icon { optical-center: auto; }
 *   JSX:   <svg optical-center="auto">…</svg>
 *
 * Both the kebab-case form (above, identical to CSS) and the
 * idiomatic JSX camelCase form (`opticalCenter="auto"` /
 * `opticalCenter`) are accepted by the plugin.
 */

import { Section, Row } from '../components/Row.js';

function Recipe() {
  // Build the highlighted recipe as plain text wrapped in
  // dangerouslySetInnerHTML — keeps JSX out of the way of literal
  // angle brackets in CSS/HTML examples.
  const html = [
    `<span class="c">// component.tsx — paste any SVG inline, add one attribute</span>`,
    `<span class="k">&lt;svg</span> <span class="h">optical-center</span><span class="k">=</span><span class="s">"auto"</span> <span class="h">viewBox</span><span class="k">=</span><span class="s">"0 0 24 24"</span><span class="k">&gt;</span>`,
    `  <span class="k">&lt;polygon</span> <span class="h">points</span><span class="k">=</span><span class="s">"6 3 20 12 6 21 6 3"</span> <span class="k">/&gt;</span>`,
    `<span class="k">&lt;/svg&gt;</span>`,
    ``,
    `<span class="c">// equivalent JSX-idiomatic forms:</span>`,
    `<span class="k">&lt;svg</span> <span class="h">opticalCenter</span><span class="k">=</span><span class="s">"auto"</span> <span class="k">...&gt;</span>`,
    `<span class="k">&lt;svg</span> <span class="h">opticalCenter</span> <span class="k">...&gt;</span>   <span class="c">// boolean shorthand</span>`,
  ].join('\n');
  return <pre className="recipe" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Inline() {
  return (
    <Section
      title="2. Inline JSX (Babel plugin)"
      path="build-time"
      description={
        <>
          Static <code>&lt;svg&gt;</code> subtrees authored in JSX —
          icons you paste from a design tool or copy out of a library's
          source. Add <code>optical-center="auto"</code> (or the
          camelCase <code>opticalCenter</code>) to the root and{' '}
          <code>optical-center/babel</code> rewrites it at compile.
          Runtime sees a corrected SVG with no marker attribute.
        </>
      }
    >
      <Recipe />

      <div className="col-head">
        <span>geometric</span>
        <span>optical-center="auto"</span>
        <span>icon</span>
      </div>

      <Row
        label="lucide / play (kebab-case attr)"
        geometric={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        }
        optical={
          <svg optical-center="auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        }
      />
      <Row
        label="lucide / arrow-right (camelCase attr)"
        geometric={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        }
        optical={
          <svg opticalCenter="auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        }
      />
      <Row
        label="lucide / send (boolean shorthand)"
        geometric={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
            <path d="m21.854 2.147-10.94 10.939" />
          </svg>
        }
        optical={
          <svg opticalCenter viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
            <path d="m21.854 2.147-10.94 10.939" />
          </svg>
        }
      />
      <Row
        label="heroicons / play-solid (24x24)"
        geometric={
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
          </svg>
        }
        optical={
          <svg optical-center="auto" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
          </svg>
        }
      />
      <Row
        label="fontawesome / play-solid (non-square 384x512)"
        geometric={
          <svg viewBox="0 0 384 512" fill="currentColor">
            <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
          </svg>
        }
        optical={
          <svg optical-center="auto" viewBox="0 0 384 512" fill="currentColor">
            <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
          </svg>
        }
      />
      <Row
        label="custom / asymmetric triangle (right-bias)"
        geometric={
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 12 L22 4 L22 20 Z" />
          </svg>
        }
        optical={
          <svg optical-center="auto" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 12 L22 4 L22 20 Z" />
          </svg>
        }
      />
    </Section>
  );
}
