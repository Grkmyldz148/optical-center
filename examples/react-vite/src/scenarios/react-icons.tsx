/**
 * Scenario 5: `react-icons/fa` (FontAwesome) + <OpticalIcon> wrapper.
 *
 * react-icons doesn't `forwardRef` to the inner <svg>, so the
 * direct-ref approach (lucide-react / heroicons) wouldn't work. The
 * <OpticalIcon> wrapper queries for the first <svg> child after
 * mount — it makes any icon library work, at the cost of one extra
 * <span> in the DOM.
 *
 * Same pattern handles @fortawesome/react-fontawesome,
 * react-bootstrap-icons, simple-icons-react, anything else that
 * doesn't expose a ref.
 */

import {
  FaStar,
  FaCheckCircle,
  FaPlay,
  FaHeart,
  FaCog,
} from 'react-icons/fa';

import { Section, Row } from '../components/Row.js';
import { OpticalIcon } from '../use-optical-center.js';

const ICON_PROPS = { size: 40, color: 'currentColor' } as const;

export function ReactIconsDemo() {
  return (
    <Section
      title="5. react-icons (FontAwesome) + <OpticalIcon>"
      path="runtime"
      description={
        <>
          react-icons doesn't forward refs, so we wrap the icon in{' '}
          <code>&lt;OpticalIcon&gt;</code>. Same pattern works for{' '}
          <code>@fortawesome/react-fontawesome</code> and any other
          library that hides its <code>&lt;svg&gt;</code>.
        </>
      }
    >
      <Row
        label="<FaStar />"
        geometric={<FaStar {...ICON_PROPS} />}
        optical={
          <OpticalIcon>
            <FaStar {...ICON_PROPS} />
          </OpticalIcon>
        }
      />
      <Row
        label="<FaCheckCircle />"
        geometric={<FaCheckCircle {...ICON_PROPS} />}
        optical={
          <OpticalIcon>
            <FaCheckCircle {...ICON_PROPS} />
          </OpticalIcon>
        }
      />
      <Row
        label="<FaPlay />"
        geometric={<FaPlay {...ICON_PROPS} />}
        optical={
          <OpticalIcon>
            <FaPlay {...ICON_PROPS} />
          </OpticalIcon>
        }
      />
      <Row
        label="<FaHeart />"
        geometric={<FaHeart {...ICON_PROPS} />}
        optical={
          <OpticalIcon>
            <FaHeart {...ICON_PROPS} />
          </OpticalIcon>
        }
      />
      <Row
        label="<FaCog />"
        geometric={<FaCog {...ICON_PROPS} />}
        optical={
          <OpticalIcon>
            <FaCog {...ICON_PROPS} />
          </OpticalIcon>
        }
      />
    </Section>
  );
}
