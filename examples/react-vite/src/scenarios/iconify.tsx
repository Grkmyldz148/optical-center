/**
 * Scenario 6: `@iconify/react` + <OpticalIcon> wrapper.
 *
 * Iconify fetches icon data on demand, so the SVG only exists at
 * runtime. `<OpticalIcon>` waits for it to mount, then applies the
 * correction. Pulls icons from any of Iconify's 200K+ available
 * sets — here we exercise four different families to show that
 * format normalization (24-grid vs 256-grid vs 512-grid) is handled.
 */

import { Icon } from '@iconify/react';

import { Section, Row } from '../components/Row.js';
import { OpticalIcon } from '../use-optical-center.js';

const STYLE = { width: 40, height: 40 } as const;

export function IconifyDemo() {
  return (
    <Section
      title="6. @iconify/react (200K+ icons)"
      path="runtime"
      description={
        <>
          Iconify exposes thousands of icon sets through one component.
          The icon data is async — the wrapper handles that the same
          way it handles any rendered <code>&lt;svg&gt;</code>.
        </>
      }
    >
      <Row
        label="mdi:play"
        geometric={<Icon icon="mdi:play" style={STYLE} />}
        optical={
          <OpticalIcon>
            <Icon icon="mdi:play" style={STYLE} />
          </OpticalIcon>
        }
      />
      <Row
        label="ph:triangle-fill"
        geometric={<Icon icon="ph:triangle-fill" style={STYLE} />}
        optical={
          <OpticalIcon>
            <Icon icon="ph:triangle-fill" style={STYLE} />
          </OpticalIcon>
        }
      />
      <Row
        label="tabler:send"
        geometric={<Icon icon="tabler:send" style={STYLE} />}
        optical={
          <OpticalIcon>
            <Icon icon="tabler:send" style={STYLE} />
          </OpticalIcon>
        }
      />
      <Row
        label="material-symbols:arrow-forward-rounded"
        geometric={
          <Icon icon="material-symbols:arrow-forward-rounded" style={STYLE} />
        }
        optical={
          <OpticalIcon>
            <Icon icon="material-symbols:arrow-forward-rounded" style={STYLE} />
          </OpticalIcon>
        }
      />
    </Section>
  );
}
