import type * as React from 'react';
import { Button } from './Button';
import { normOption, type Option } from './fields';

export interface SearchField {
  name: string;
  label: string;
  options: Option[];
  value?: string;
}

export interface SearchBarProps {
  fields: SearchField[];
  onSearch?: (e: React.FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  /** Where the plain GET form submits when there is no onSearch handler. */
  action?: string;
}

export function SearchBar({ fields, onSearch, submitLabel, action }: SearchBarProps) {
  return (
    <form
      className="jr-search"
      role="search"
      method="get"
      action={action}
      onSubmit={
        onSearch
          ? (e) => {
              e.preventDefault();
              onSearch(e);
            }
          : undefined
      }
    >
      {fields.map((f, i) => {
        const id = 'q-' + (f.name || i);
        return (
          <div className="jr-search-seg" key={id}>
            <label htmlFor={id}>{f.label}</label>
            <select id={id} name={f.name} defaultValue={f.value}>
              {f.options.map((o, j) => {
                const v = normOption(o);
                return (
                  <option key={j} value={v.value}>
                    {v.label}
                  </option>
                );
              })}
            </select>
          </div>
        );
      })}
      <Button type="submit" icon="search">
        {submitLabel || 'Search'}
      </Button>
    </form>
  );
}
