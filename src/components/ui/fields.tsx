import type * as React from 'react';
import { cx } from '@/lib/cx';

export type Option = string | { value: string; label: string };

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function normOption(o: Option) {
  return typeof o === 'string' ? { value: o, label: o } : o;
}

type InputLike = React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export interface TextFieldProps extends Omit<InputLike, 'className'> {
  label: string;
  hint?: string;
  error?: string;
  mono?: boolean;
  multiline?: boolean;
  rows?: number;
  className?: string;
}

export function TextField({ label, hint, error, mono, multiline, className, id, ...rest }: TextFieldProps) {
  const fid = id || 'f-' + slug(rest.name ? `${label}-${rest.name}` : label);
  const hintId = hint || error ? fid + '-hint' : undefined;
  const common = {
    id: fid,
    className: cx('jr-field-input', mono && 'jr-mono'),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': hintId,
  };
  return (
    <div className={cx('jr-field', error && 'jr-field--error', className)}>
      <label className="jr-field-label" htmlFor={fid}>
        {label}
      </label>
      {multiline ? (
        <textarea {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} {...common} />
      ) : (
        <input {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} {...common} />
      )}
      {error || hint ? (
        <p className="jr-field-hint" id={hintId}>
          {error || hint}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  placeholder?: string;
  hint?: string;
  error?: string;
}

export function SelectField({ label, options, placeholder, hint, error, className, id, ...rest }: SelectFieldProps) {
  const fid = id || 's-' + slug(rest.name ? `${label}-${rest.name}` : label);
  const hintId = hint || error ? fid + '-hint' : undefined;
  return (
    <div className={cx('jr-field', error && 'jr-field--error', className)}>
      <label className="jr-field-label" htmlFor={fid}>
        {label}
      </label>
      <select {...rest} id={fid} className="jr-field-input" aria-invalid={error ? true : undefined} aria-describedby={hintId}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o, i) => {
          const v = normOption(o);
          return (
            <option key={i} value={v.value}>
              {v.label}
            </option>
          );
        })}
      </select>
      {error || hint ? (
        <p className="jr-field-hint" id={hintId}>
          {error || hint}
        </p>
      ) : null}
    </div>
  );
}
