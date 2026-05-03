/**
 * The runtime hook bypasses resvg in favor of browser-native canvas
 * rasterization. We test it here by injecting a custom `rasterize`
 * option that reuses the Node-side resvg path — same math, no jsdom.
 */

import { describe, expect, it } from 'vitest';

import { applyOpticalCenter } from '../../src/runtime/apply-optical-center.js';
import { rasterizeSvg } from '../../src/node/rasterize.js';
import { loadIcon } from '../helpers/fixtures.js';

function makeFakeSvg(svgString: string): SVGSVGElement {
  // Minimal stub that satisfies the API surface the hook touches:
  // outerHTML getter + setAttribute / hasAttribute.
  const attrs = new Map<string, string>();
  const stub = {
    get outerHTML() {
      return svgString;
    },
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    hasAttribute(name: string) {
      return attrs.has(name);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
  };
  return stub as unknown as SVGSVGElement;
}

describe('applyOpticalCenter', () => {
  it('rewrites viewBox in-place and sets the breadcrumb attribute', async () => {
    const svg = loadIcon('lucide/play');
    const el = makeFakeSvg(svg);

    const result = await applyOpticalCenter(el, {
      rasterize: async (markup, size) => rasterizeSvg(markup, { size }),
    });

    expect(result).not.toBeNull();
    expect(Math.abs(result!.dxPercent)).toBeGreaterThan(0);
    expect(el.getAttribute('viewBox')).toMatch(/^-?\d/);
    expect(el.hasAttribute('data-optical-center')).toBe(true);
  });

  it('is idempotent — second call short-circuits', async () => {
    const svg = loadIcon('lucide/star');
    const el = makeFakeSvg(svg);
    const r1 = await applyOpticalCenter(el, {
      rasterize: async (m, s) => rasterizeSvg(m, { size: s }),
    });
    const firstViewBox = el.getAttribute('viewBox');

    const r2 = await applyOpticalCenter(el, {
      rasterize: async (m, s) => rasterizeSvg(m, { size: s }),
    });

    expect(r1).not.toBeNull();
    expect(r2).toBeNull();
    expect(el.getAttribute('viewBox')).toBe(firstViewBox);
  });

  it('throws a clear message when no browser env and no rasterize override', async () => {
    const el = makeFakeSvg(loadIcon('lucide/play'));
    await expect(applyOpticalCenter(el)).rejects.toThrow(
      /requires a browser environment/,
    );
  });
});
