'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { cancelShowing, rescheduleShowing } from '@/server/actions/showings';

export function ShowingControls({ id, refNo }: { id: string; refNo: string }) {
  const [open, setOpen] = useState<'move' | 'cancel' | null>(null);
  const [when, setWhen] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const done = (r: { ok: boolean; message: string; fieldError?: string }) => {
    if (r.fieldError) return setError(r.fieldError);
    toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
    if (r.ok) {
      setOpen(null);
      router.refresh();
    }
  };
  return (
    <div className="row">
      <Button size="sm" variant="secondary" icon="calendar" onClick={() => setOpen('move')}>
        Reschedule
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen('cancel')}>
        Cancel showing
      </Button>
      <Modal
        open={open === 'move'}
        onClose={() => setOpen(null)}
        title={`Reschedule ${refNo}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Keep the current time
            </Button>
            <Button loading={pending} onClick={() => start(async () => done(await rescheduleShowing(id, when ? new Date(when).toISOString() : '')))}>
              Request this time
            </Button>
          </>
        }
      >
        <TextField label="New time" type="datetime-local" mono value={when} onChange={(e) => { setWhen(e.target.value); setError(undefined); }} hint="In your local time. The agent confirms it." error={error} />
      </Modal>
      <Modal
        open={open === 'cancel'}
        onClose={() => setOpen(null)}
        title="Cancel this showing?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={pending} onClick={() => start(async () => done(await cancelShowing(id)))}>
              Cancel showing
            </Button>
          </>
        }
      >
        <p className="body">We’ll let the agent know. You can book another time from the listing.</p>
      </Modal>
    </div>
  );
}
