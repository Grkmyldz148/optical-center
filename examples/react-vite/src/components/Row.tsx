import type { ReactNode } from 'react';

interface RowProps {
  readonly label: string;
  readonly geometric: ReactNode;
  readonly optical: ReactNode;
}

export function Row({ label, geometric, optical }: RowProps) {
  return (
    <div className="row">
      <div className="badge">{geometric}</div>
      <div className="badge">{optical}</div>
      <span className="row-label">{label}</span>
    </div>
  );
}

interface SectionProps {
  readonly title: string;
  readonly description: ReactNode;
  readonly path: 'build-time' | 'runtime';
  readonly children: ReactNode;
}

export function Section({ title, description, path, children }: SectionProps) {
  return (
    <section>
      <header>
        <h2>{title}</h2>
        <span className={`pill pill-${path}`}>{path}</span>
      </header>
      <p>{description}</p>
      <div className="grid">{children}</div>
    </section>
  );
}
