/**
 * Three React helpers over `optical-center/runtime`:
 *
 *   - useOpticalCenterRef<SVGSVGElement>() — returns a ref you attach
 *     directly to an <svg>. Works with libs that forwardRef
 *     (lucide-react, @heroicons/react).
 *
 *   - <OpticalRef>{(ref) => …}</OpticalRef> — render-prop sugar around
 *     the ref hook so the example markup stays declarative.
 *
 *   - <OpticalIcon>{children}</OpticalIcon> — wrapper component that
 *     queries for the first <svg> inside and applies the correction.
 *     Works with any library, including ones that don't forward refs
 *     (react-icons, some FontAwesome wrappers). Trade-off: an extra
 *     <span> element in the DOM.
 */

import { useEffect, useRef } from 'react';
import type { ReactNode, Ref, RefObject } from 'react';
import { applyOpticalCenter } from 'optical-center/runtime';

export function useOpticalCenterRef<
  T extends SVGSVGElement = SVGSVGElement,
>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    void applyOpticalCenter(el).catch(warn);
  }, []);
  return ref;
}

interface OpticalRefProps {
  readonly children: (ref: Ref<SVGSVGElement>) => ReactNode;
}

export function OpticalRef({ children }: OpticalRefProps) {
  const ref = useOpticalCenterRef();
  return <>{children(ref)}</>;
}

interface OpticalIconProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function OpticalIcon({ children, className }: OpticalIconProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const svg = ref.current?.querySelector('svg');
    if (svg) void applyOpticalCenter(svg as SVGSVGElement).catch(warn);
  }, []);
  return (
    <span ref={ref} className={className} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  );
}

function warn(err: unknown): void {
  // eslint-disable-next-line no-console
  console.warn('[optical-center] runtime apply failed:', err);
}
