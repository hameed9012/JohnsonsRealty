'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { useToast } from '@/components/ui/Toaster';
import type { SavedScope } from '@/lib/saved-search';
import { deleteSearch, saveSearch, setSearchAlerts } from '@/server/actions/searches';

export function SaveSearchButton({ scope, query, signedIn, returnTo }: { scope: SavedScope; query: string; signedIn: boolean; returnTo: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (!signedIn) {
    return (
      <Button variant="ghost" size="sm" icon="bell" href={`/signin?callbackUrl=${encodeURIComponent(returnTo)}`}>
        Save this search
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      icon="bell"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await saveSearch(scope, query);
          toast({ message: r.message, tone: r.ok ? 'success' : 'danger', action: r.ok ? { label: 'View', onClick: () => router.push('/account/searches') } : undefined });
        })
      }
    >
      Save this search
    </Button>
  );
}

export function SavedSearchRow({ id, alerts: initial }: { id: string; alerts: boolean }) {
  const [alerts, setAlerts] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="row">
      <Toggle
        label="Alerts"
        hint="Notify me about new matches"
        checked={alerts}
        disabled={pending}
        onChange={(e) => {
          const on = e.target.checked;
          setAlerts(on);
          start(async () => {
            const r = await setSearchAlerts(id, on);
            if (!r.ok) setAlerts(!on);
            toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
          });
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteSearch(id);
            toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
            router.refresh();
          })
        }
      >
        Delete
      </Button>
    </div>
  );
}
