/**
 * Scenario 3: `lucide-react` (component library) + runtime hook.
 *
 * lucide-react emits its <svg> at render time, so the Babel plugin
 * never sees it. The runtime hook attaches via ref and applies the
 * correction once the element is in the DOM.
 *
 * Same pattern works for any icon library that forwards refs to its
 * underlying <svg> — Lucide does, so a single `useOpticalCenter()`
 * ref attachment is all it takes.
 */

import { Play, ArrowRight, Heart, Star, Search, Send } from 'lucide-react';

import { Section, Row } from '../components/Row.js';
import { OpticalRef } from '../use-optical-center.js';

const Optical = OpticalRef;

export function LucideReactDemo() {
  return (
    <Section
      title="3. lucide-react + runtime hook"
      path="runtime"
      description={
        <>
          Component library that emits <code>&lt;svg&gt;</code> at
          render time. The build-time path can't see it, so the runtime
          hook fires <code>applyOpticalCenter</code> on mount.
        </>
      }
    >
      <Row
        label="<Play />"
        geometric={<Play size={40} />}
        optical={<Optical>{(ref) => <Play ref={ref} size={40} />}</Optical>}
      />
      <Row
        label="<ArrowRight />"
        geometric={<ArrowRight size={40} />}
        optical={<Optical>{(ref) => <ArrowRight ref={ref} size={40} />}</Optical>}
      />
      <Row
        label="<Heart />"
        geometric={<Heart size={40} />}
        optical={<Optical>{(ref) => <Heart ref={ref} size={40} />}</Optical>}
      />
      <Row
        label="<Star />"
        geometric={<Star size={40} />}
        optical={<Optical>{(ref) => <Star ref={ref} size={40} />}</Optical>}
      />
      <Row
        label="<Search />"
        geometric={<Search size={40} />}
        optical={<Optical>{(ref) => <Search ref={ref} size={40} />}</Optical>}
      />
      <Row
        label="<Send />"
        geometric={<Send size={40} />}
        optical={<Optical>{(ref) => <Send ref={ref} size={40} />}</Optical>}
      />
    </Section>
  );
}
