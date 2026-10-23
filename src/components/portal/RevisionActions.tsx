'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { decideRevisionAction } from '@/server/actions/ops';

export function RevisionActions({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await decideRevisionAction(id, approve, notes);
      if (!r.ok && r.fieldErrors?.notes) return setError(r.fieldErrors.notes);
      toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
      if (r.ok) router.push('/portal/review');
    });
  return (
    <div className="row">
      <Button withKey loading={pending} onClick={() => decide(true)}>
        Approve edit
      </Button>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Decline
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Decline this edit"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={pending} onClick={() => decide(false)}>
              Decline edit
            </Button>
          </>
        }
      >
        <TextField label="Notes for the agent" multiline rows={3} value={notes} error={error} onChange={(e) => { setNotes(e.target.value); setError(undefined); }} />
      </Modal>
    </div>
  );
}
