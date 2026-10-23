'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toaster';
import type { ActionState } from '@/lib/action-result';

/** useActionState plus the house toast on success. Returns field errors for TextField `error` props. */
export function useFormAction(action: (prev: ActionState, fd: FormData) => Promise<ActionState>) {
  const [state, formAction, pending] = useActionState(action, null);
  const toast = useToast();
  const last = useRef<ActionState>(null);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok && state.message) toast({ message: state.message, tone: 'success' });
    if (!state.ok && state.message) toast({ message: state.message, tone: 'danger' });
  }, [state, toast]);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return { state, formAction, pending, errors };
}
