/**
 * Scenario 4: `@heroicons/react` + runtime hook.
 *
 * Heroicons React forwards refs to its <svg>, so the same hook works
 * unchanged. The icons import path differs (24/solid, 24/outline, etc.)
 * but optical-center is agnostic to that.
 */

import {
  BellIcon,
  HomeIcon,
  UserIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';

import { Section, Row } from '../components/Row.js';
import { OpticalRef } from '../use-optical-center.js';

const Optical = OpticalRef;

export function HeroiconsDemo() {
  return (
    <Section
      title="4. @heroicons/react + runtime hook"
      path="runtime"
      description={
        <>
          Heroicons solid set (24×24). The hook attaches once,
          measures, and rewrites the rendered SVG's viewBox.
        </>
      }
    >
      <Row
        label="<BellIcon />"
        geometric={<BellIcon style={{ width: 40, height: 40 }} />}
        optical={
          <Optical>
            {(ref) => <BellIcon ref={ref} style={{ width: 40, height: 40 }} />}
          </Optical>
        }
      />
      <Row
        label="<HomeIcon />"
        geometric={<HomeIcon style={{ width: 40, height: 40 }} />}
        optical={
          <Optical>
            {(ref) => <HomeIcon ref={ref} style={{ width: 40, height: 40 }} />}
          </Optical>
        }
      />
      <Row
        label="<UserIcon />"
        geometric={<UserIcon style={{ width: 40, height: 40 }} />}
        optical={
          <Optical>
            {(ref) => <UserIcon ref={ref} style={{ width: 40, height: 40 }} />}
          </Optical>
        }
      />
      <Row
        label="<MagnifyingGlassIcon />"
        geometric={
          <MagnifyingGlassIcon style={{ width: 40, height: 40 }} />
        }
        optical={
          <Optical>
            {(ref) => (
              <MagnifyingGlassIcon
                ref={ref}
                style={{ width: 40, height: 40 }}
              />
            )}
          </Optical>
        }
      />
    </Section>
  );
}
