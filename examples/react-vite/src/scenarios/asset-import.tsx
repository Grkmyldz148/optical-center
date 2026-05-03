/**
 * Scenario 2: SVG asset import with the `?optical` query.
 *
 * Build-time path via the Vite plugin's `load` hook. The same .svg
 * file is imported twice — once raw, once with `?optical` — and the
 * plugin rewrites the viewBox of the second variant. Useful for
 * design-system asset folders.
 *
 * Files come from the shared `fixtures/icons/` pool — same SVGs the
 * test suite exercises.
 */

import { Section, Row } from '../components/Row.js';

import lucidePlayRaw from '../../../../fixtures/icons/lucide/play.svg?raw';
import lucidePlayOpt from '../../../../fixtures/icons/lucide/play.svg?optical';
import lucideArrowRaw from '../../../../fixtures/icons/lucide/arrow-right.svg?raw';
import lucideArrowOpt from '../../../../fixtures/icons/lucide/arrow-right.svg?optical';
import asymmRaw from '../../../../fixtures/icons/edge-cases/asymmetric-triangle.svg?raw';
import asymmOpt from '../../../../fixtures/icons/edge-cases/asymmetric-triangle.svg?optical';

interface InlineSvgProps {
  readonly markup: string;
}

function InlineSvg({ markup }: InlineSvgProps) {
  return <span dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function AssetImport() {
  return (
    <Section
      title="2. Asset import (?optical)"
      path="build-time"
      description={
        <>
          <code>import play from './play.svg?optical'</code> — the Vite
          plugin's <code>load</code> hook returns the rewritten SVG as
          a JS module. Drop in for sprite/asset workflows.
        </>
      }
    >
      <Row
        label="lucide / play"
        geometric={<InlineSvg markup={lucidePlayRaw} />}
        optical={<InlineSvg markup={lucidePlayOpt} />}
      />
      <Row
        label="lucide / arrow-right"
        geometric={<InlineSvg markup={lucideArrowRaw} />}
        optical={<InlineSvg markup={lucideArrowOpt} />}
      />
      <Row
        label="edge-case / asymmetric-triangle"
        geometric={<InlineSvg markup={asymmRaw} />}
        optical={<InlineSvg markup={asymmOpt} />}
      />
    </Section>
  );
}
