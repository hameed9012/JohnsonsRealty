import type * as React from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export interface ToggleProps extends InputProps {
  label: string;
  hint?: string;
}

/** A switch backed by a native checkbox, so it works in plain forms. */
export function Toggle({ label, hint, className, ...rest }: ToggleProps) {
  return (
    <label className={cx('jr-toggle', className)}>
      <input type="checkbox" role="switch" {...rest} />
      <span className="jr-toggle-track" aria-hidden />
      <span className="jr-toggle-text">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

export interface CheckboxProps extends InputProps {
  label: React.ReactNode;
}

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx('jr-check', className)}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export interface RadioGroupProps {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  hint?: string;
  error?: string;
  required?: boolean;
}

export function RadioGroup({ legend, name, options, value, defaultValue, onChange, hint, error, required }: RadioGroupProps) {
  return (
    <fieldset className={cx('jr-fieldset', error && 'jr-fieldset--error')} aria-invalid={error ? true : undefined}>
      <legend>{legend}</legend>
      <div className="jr-options">
        {options.map((o) => (
          <label key={o.value} className="jr-check">
            <input
              type="radio"
              name={name}
              value={o.value}
              required={required}
              checked={value !== undefined ? value === o.value : undefined}
              defaultChecked={value === undefined ? defaultValue === o.value : undefined}
              onChange={onChange ? () => onChange(o.value) : undefined}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error || hint ? <p className="jr-field-hint">{error || hint}</p> : null}
    </fieldset>
  );
}

export interface FeatureChipsProps {
  legend: string;
  name: string;
  options: { value: string; label: string; icon?: IconName }[];
  selected?: string[];
  defaultSelected?: string[];
  onToggle?: (value: string, on: boolean) => void;
}

/** Multi-select chips (features, areas) backed by native checkboxes. */
export function FeatureChips({ legend, name, options, selected, defaultSelected, onToggle }: FeatureChipsProps) {
  return (
    <fieldset className="jr-fieldset">
      <legend>{legend}</legend>
      <div className="jr-featurechips">
        {options.map((o) => (
          <label key={o.value} className="jr-featurechip">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={selected ? selected.includes(o.value) : undefined}
              defaultChecked={selected ? undefined : defaultSelected?.includes(o.value)}
              onChange={onToggle ? (e) => onToggle(o.value, e.target.checked) : undefined}
            />
            <span>
              {o.icon ? <Icon name={o.icon} size={16} /> : null}
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
