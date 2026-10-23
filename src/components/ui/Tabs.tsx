'use client';

import { useId, useRef, useState } from 'react';
import type * as React from 'react';

export interface TabsProps {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  initial?: string;
  label: string;
  onChange?: (id: string) => void;
}

/** WAI-ARIA tabs with arrow-key navigation. */
export function Tabs({ tabs, initial, label, onChange }: TabsProps) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string) {
    setActive(id);
    onChange?.(id);
    refs.current[id]?.focus();
  }

  function onKey(e: React.KeyboardEvent, i: number) {
    const n = tabs.length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % n;
    if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = n - 1;
    if (next >= 0) {
      e.preventDefault();
      select(tabs[next]!.id);
    }
  }

  return (
    <div className="jr-tabs">
      <div role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => select(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={active !== t.id}
          tabIndex={0}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
