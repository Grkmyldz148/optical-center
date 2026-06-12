import { clsx } from '../../lib/clsx.js';

interface ToggleProps {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}

export function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className="toggle"
      onClick={() => onChange(!value)}
    >
      <span className="toggle__label">{label}</span>
      <span className={clsx('toggle__switch', value && 'toggle__switch--on')} />
    </button>
  );
}
