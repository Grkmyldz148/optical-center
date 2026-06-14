import type { CSSProperties } from 'react';

interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly unit?: string;
  /** Formatter for the value pill — defaults to `${value}${unit}`. */
  readonly format?: (value: number) => string;
  readonly onChange: (value: number) => void;
}

/**
 * Range slider with an integrated label + live value readout. The
 * accent-coloured fill is driven by a CSS custom property
 * (`--slider-pct`) computed from the current value, so the visual
 * "how full" tracks the input without an extra DOM node.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  format,
  onChange,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : `${value}${unit}`;
  return (
    <div className="field">
      <div className="field__header">
        <span className="field__label">{label}</span>
        <span className="field__value">{display}</span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        style={{ ['--slider-pct' as string]: `${pct}%` } as CSSProperties}
      />
    </div>
  );
}
