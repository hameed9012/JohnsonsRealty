'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
export type SaveResult = { ok: boolean; message?: string; fieldErrors?: Record<string, string> };

const AUTOSAVE_MS = 2500;

/**
 * Step state with debounced autosave. `flush` saves now (used by Back, Next and step links) and
 * resolves to false when the server rejected the values, so navigation can stay put and show errors.
 */
export function useStepForm<T extends object>(initial: T, save: (values: T) => Promise<SaveResult>, opts: { initiallyDirty?: boolean } = {}) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<SaveStatus>('idle');
  const latest = useRef(values);
  // Prefilled steps that have never been saved start dirty, so Next saves them even if nothing was typed.
  const dirty = useRef(!!opts.initiallyDirty);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);

  const run = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inflight.current) await inflight.current;
    if (!dirty.current) return true;
    dirty.current = false;
    setStatus('saving');
    const p = save(latest.current).then((r) => {
      setErrors(r.fieldErrors ?? {});
      setStatus(r.ok ? 'saved' : 'error');
      if (!r.ok) dirty.current = true;
      return r.ok;
    });
    inflight.current = p;
    const ok = await p;
    inflight.current = null;
    return ok;
  }, [save]);

  const set = useCallback(
    <K extends keyof T>(key: K, v: T[K]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: v };
        latest.current = next;
        return next;
      });
      dirty.current = true;
      setStatus('dirty');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), AUTOSAVE_MS);
    },
    [run],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  /** Props for a TextField/SelectField bound to a string key. */
  const bind = (key: keyof T & string) => ({
    name: key,
    value: (values[key] as unknown as string) ?? '',
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as T[typeof key]),
    error: errors[key],
  });

  return { values, set, bind, errors, status, flush: run, setErrors };
}

export function statusText(s: SaveStatus): string {
  return { idle: '', dirty: 'Unsaved changes', saving: 'Saving…', saved: 'Draft saved', error: 'Not saved. Check the highlighted fields.' }[s];
}
