import { ALGORITHM_VERSION } from 'optical-center';

import { clsx } from '../lib/clsx.js';

export type ViewKey = 'playground' | 'stress';

interface TopBarProps {
  readonly active: ViewKey;
  readonly onChange: (next: ViewKey) => void;
}

export function TopBar({ active, onChange }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__brand-mark" aria-hidden="true" />
        <span className="topbar__brand-name">optical-center</span>
        <span className="topbar__brand-version">playground</span>
      </div>

      <nav className="topbar__tabs" role="tablist" aria-label="Sections">
        {(
          [
            ['playground', 'Playground'],
            ['stress', 'Stress test'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            className={clsx(
              'topbar__tab',
              active === key && 'topbar__tab--active',
            )}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="topbar__spacer" />

      <div className="topbar__meta">
        <span>
          model <strong>{ALGORITHM_VERSION}</strong>
        </span>
        <a
          href="https://opticalcenter.dev/docs"
          target="_blank"
          rel="noreferrer"
        >
          docs ↗
        </a>
      </div>
    </header>
  );
}
