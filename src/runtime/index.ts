/**
 * Browser runtime layer for component libraries that emit <svg> at
 * render time (lucide-react, @heroicons/react, @iconify/react,
 * react-icons, FontAwesome React, etc.).
 *
 * Framework-agnostic; React/Vue/Solid wrappers live in user code.
 * No Node-only deps here — safe to bundle for the browser.
 */

export {
  applyOpticalCenter,
} from './apply-optical-center.js';
export type {
  ApplyOpticalCenterOptions,
} from './apply-optical-center.js';
