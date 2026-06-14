import type { CSSProperties } from 'react';

import { clsx } from '../../lib/clsx.js';

export interface Swatch {
  readonly id: string;
  readonly label: string;
  readonly color: string;
}

interface SwatchRowProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly Swatch[];
  readonly onChange: (id: string) => void;
}

export function SwatchRow({ label, value, options, onChange }: SwatchRowProps) {
  return (
    <div className="field">
      <div className="field__header">
        <span className="field__label">{label}</span>
        <span className="field__value">
          {options.find((o) => o.id === value)?.label ?? value}
        </span>
      </div>
      <div className="swatchrow" role="radiogroup" aria-label={label}>
        {options.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={s.id === value}
            aria-label={s.label}
            title={s.label}
            className={clsx(
              'swatchrow__item',
              s.id === value && 'swatchrow__item--active',
            )}
            style={{ background: s.color } as CSSProperties}
            onClick={() => onChange(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
