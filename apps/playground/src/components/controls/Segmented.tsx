import { clsx } from '../../lib/clsx.js';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SegmentedProps<T extends string> {
  readonly label?: string;
  readonly value: T;
  readonly options: readonly SegmentedOption<T>[];
  readonly onChange: (value: T) => void;
}

/**
 * Pill-style radio group. Two to four options work best;
 * anything more should become a dropdown.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="field">
      {label !== undefined && (
        <div className="field__header">
          <span className="field__label">{label}</span>
        </div>
      )}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={opt.value === value}
            className={clsx(
              'segmented__option',
              opt.value === value && 'segmented__option--active',
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
