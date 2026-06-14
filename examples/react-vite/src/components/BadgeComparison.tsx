import type { ReactNode } from 'react';

interface BadgeComparisonProps {
  /**
   * Geometric badge JSX — fully assembled (the wrapper `<div>` plus
   * the icon inside). Lives in the caller so the PostCSS plugin's
   * JSX scanner can resolve container className → icon descendant
   * inside a single file. Cross-component wiring (e.g.
   * `<BadgeComparison optical={<Play />} />`) is invisible to the
   * scanner — that's why this component takes whole subtrees, not
   * just the icon.
   */
  readonly geometric: ReactNode;
  /** Optical badge JSX — same shape, but using the directive under demo. */
  readonly optical: ReactNode;
  /** Short label describing the markup pattern (rendered to the right of the badges). */
  readonly label: string;
}

/**
 * Three-column row that lines up a geometric badge, an
 * optical-centered badge, and a markup label. Layout-only — no
 * `optical-center` rules, no flex/grid centering of icons. Each
 * badge subtree is responsible for centering itself via whichever
 * mechanism its scenario demonstrates.
 */
export function BadgeComparison({
  geometric,
  optical,
  label,
}: BadgeComparisonProps) {
  return (
    <div className="badge-row">
      {geometric}
      {optical}
      <span className="badge-row__label">{label}</span>
    </div>
  );
}
