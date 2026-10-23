'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { staffShowingAction } from '@/server/actions/ops';

export function ShowingStaffControls({ id, refNo, status }: { id: string; refNo: string; status: string }) {
  const [confirming, setConfirming] = useState(false);
  const [when, setWhen] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const act = (action: 'confirm' | 'complete' | 'no_show' | 'cancel', at?: string) =>
    start(async () => {
      const r = await staffShowingAction(id, action, at);
      toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
      if (r.ok) {
        setConfirming(false);
        router.refresh();
      }
    });
  if (status !== 'requested' && status !== 'confirmed') return null;
  return (
    <div className="row">
      <Button size="sm" onClick={() => setConfirming(true)} loading={pending}>
        {status === 'confirmed' ? 'Change time' : 'Confirm'}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => act('complete')} loading={pending}>
        Mark done
      </Button>
      <Button size="sm" variant="ghost" onClick={() => act('no_show')} loading={pending}>
        No show
      </Button>
      <Button size="sm" variant="ghost" onClick={() => act('cancel')} loading={pending}>
        Cancel
      </Button>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Confirm ${refNo}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Back
            </Button>
            <Button loading={pending} onClick={() => act('confirm', when ? new Date(when).toISOString() : undefined)}>
              Confirm showing
            </Button>
          </>
        }
      >
        <TextField label="Time (leave blank to keep the requested time)" type="datetime-local" mono value={when} onChange={(e) => setWhen(e.target.value)} hint="In your local time. The client is notified." />
      </Modal>
    </div>
  );
}
