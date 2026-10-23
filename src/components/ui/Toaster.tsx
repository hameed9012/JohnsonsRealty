'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type * as React from 'react';
import { Toast, type ToastProps } from './documents';

type Item = ToastProps & { id: number };
const Ctx = createContext<(t: ToastProps) => void>(() => {});

let seq = 0;

/** Mount once per shell. Toasts echo the action ("Listing published") and fade after 5s. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const push = useCallback((t: ToastProps) => {
    const id = ++seq;
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {items.map(({ id, ...t }) => (
          <Toast key={id} {...t} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
