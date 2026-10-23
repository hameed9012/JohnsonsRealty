'use client';

import { useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { saveProfile } from '@/server/actions/profile';

export interface ProfileFormProps {
  defaults: { displayName: string; robloxUsername: string; chirperHandle: string };
  callbackUrl?: string;
  submitLabel: string;
}

export function ProfileForm({ defaults, callbackUrl, submitLabel }: ProfileFormProps) {
  const [state, action, pending] = useActionState(saveProfile, null);
  const toast = useToast();
  useEffect(() => {
    if (state?.ok && state.message) toast({ message: state.message, tone: 'success' });
  }, [state, toast]);
  const err = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="stack" noValidate>
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <TextField
        label="Roblox username"
        name="robloxUsername"
        required
        autoComplete="off"
        defaultValue={defaults.robloxUsername}
        hint="Agents use this to find you in-game."
        error={err?.robloxUsername}
      />
      <TextField
        label="Chirper handle (optional)"
        name="chirperHandle"
        autoComplete="off"
        defaultValue={defaults.chirperHandle}
        placeholder="KeysWithJohnson"
        error={err?.chirperHandle}
      />
      <TextField label="Display name" name="displayName" defaultValue={defaults.displayName} hint="Shown to agents. Defaults to your Discord name." error={err?.displayName} />
      {state && !state.ok && state.message ? <p className="jr-field-hint" role="alert">{state.message}</p> : null}
      <div className="row">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
