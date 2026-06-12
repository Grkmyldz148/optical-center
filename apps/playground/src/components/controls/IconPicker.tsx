import type { PlaygroundIcon } from '../../icons/registry.js';
import { ICONS } from '../../icons/registry.js';
import { clsx } from '../../lib/clsx.js';

interface IconPickerProps {
  readonly value: string;
  readonly onChange: (id: string) => void;
}

/**
 * Grid of icon swatches. Renders each icon's body inline as a
 * preview — the optical-center pipeline doesn't touch these
 * previews (they're just visual hints for the picker, not the
 * subject under test).
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="field">
      <div className="field__header">
        <span className="field__label">Icon</span>
        <span className="field__value">
          {ICONS.find((i) => i.id === value)?.name ?? value}
        </span>
      </div>
      <div className="iconpick" role="radiogroup" aria-label="Icon">
        {ICONS.map((icon) => (
          <button
            key={icon.id}
            type="button"
            role="radio"
            aria-checked={icon.id === value}
            aria-label={icon.name}
            className={clsx(
              'iconpick__swatch',
              icon.id === value && 'iconpick__swatch--active',
            )}
            onClick={() => onChange(icon.id)}
          >
            <IconPreview icon={icon} />
          </button>
        ))}
      </div>
    </div>
  );
}

function IconPreview({ icon }: { icon: PlaygroundIcon }) {
  const [x, y, w, h] = icon.viewBox;
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
