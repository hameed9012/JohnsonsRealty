'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { SelectField, TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { assignEnquiryAction, replyEnquiryAction, setEnquiryStatusAction } from '@/server/actions/ops';

export function InboxControls({ id, status, assigneeId, staff }: { id: string; status: string; assigneeId: string | null; staff: { value: string; label: string }[] }) {
  const [, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const done = (r: { ok: boolean; message?: string }) => {
    toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
    router.refresh();
  };
  return (
    <div className="row">
      <SelectField label="Assigned to" name="assignee" placeholder="Nobody" options={staff} value={assigneeId ?? ''} onChange={(e) => start(async () => done(await assignEnquiryAction(id, e.target.value)))} />
      <SelectField
        label="Status"
        name="status"
        options={[
          { value: 'new', label: 'New' },
          { value: 'open', label: 'Open' },
          { value: 'waiting', label: 'Waiting on them' },
          { value: 'closed', label: 'Closed' },
        ]}
        value={status}
        onChange={(e) => start(async () => done(await setEnquiryStatusAction(id, e.target.value as never)))}
      />
    </div>
  );
}

export function ReplyForm({ id, canReply }: { id: string; canReply: boolean }) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(!canReply);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className="stack panel"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set('body', body);
        if (internal) fd.set('internal', 'on');
        start(async () => {
          const r = await replyEnquiryAction(id, fd);
          if (!r.ok && r.fieldErrors?.body) return setError(r.fieldErrors.body);
          toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
          if (r.ok) {
            setBody('');
            router.refresh();
          }
        });
      }}
    >
      <TextField label={internal ? 'Internal note' : 'Reply'} multiline rows={4} value={body} error={error} onChange={(e) => { setBody(e.target.value); setError(undefined); }} hint={internal ? 'Only staff see notes.' : 'Sent to them as a notification on their account.'} />
      <Toggle label="Internal note (staff only)" checked={internal} disabled={!canReply} onChange={(e) => setInternal(e.target.checked)} />
      <div className="row">
        <Button type="submit" loading={pending} icon="chat">
          {internal ? 'Add note' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}
