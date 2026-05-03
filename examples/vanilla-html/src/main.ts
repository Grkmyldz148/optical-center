/**
 * Vanilla runtime — finds every iconify-icon with class="optical" and
 * applies the correction once the web component has rendered. The
 * Iconify custom element fires a `load` event after fetching its
 * data; we listen for that and reach into the shadow root for the
 * <svg> child.
 */

import { applyOpticalCenter } from 'optical-center/runtime';

function applyToIconifyIcon(host: Element): void {
  // Iconify renders into its element's open shadow root; the <svg>
  // is the first child once the icon data resolves.
  const root = (host as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  const svg = (root ?? host).querySelector('svg') as SVGSVGElement | null;
  if (!svg) return;
  void applyOpticalCenter(svg).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[optical-center] vanilla apply failed:', err);
  });
}

document.querySelectorAll('iconify-icon.optical').forEach((host) => {
  // Iconify dispatches `load` once the icon SVG is in the DOM.
  host.addEventListener('load', () => applyToIconifyIcon(host), { once: true });
  // In case it already rendered before the listener attached:
  if ((host as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot?.querySelector('svg')) {
    applyToIconifyIcon(host);
  }
});
