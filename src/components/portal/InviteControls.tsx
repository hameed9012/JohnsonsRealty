'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { acceptInviteAction, createInviteAction, revokeInviteAction } from '@/server/actions/ops';

export function InviteCreator({ canAdmin }: { canAdmin: boolean }) {
  const [role, setRole] = useState<'agent' | 'admin'>('agent');
  const [note, setNote] = useState('');
  const [days, setDays] = useState('7');
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="stack">
      <div className="grid-12">
        <SelectField className="span-4" label="Role" name="role" options={[{ value: 'agent', label: 'Agent' }, ...(canAdmin ? [{ value: 'admin', label: 'Admin' }] : [])]} value={role} onChange={(e) => setRole(e.target.value as 'agent' | 'admin')} />
        <TextField className="span-4" label="Who it’s for (optional)" name="note" value={note} onChange={(e) => setNote(e.target.value)} />
        <SelectField className="span-4" label="Expires after" name="days" options={[{ value: '1', label: '1 day' }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }]} value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      <div className="row">
        <Button
          icon="key"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await createInviteAction({ role, note, days: Number(days) });
              if (r.ok && r.data) {
                setLink(r.data.url);
                router.refresh();
              }
              toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
            })
          }
        >
          Create invite link
        </Button>
      </div>
      {link ? (
        <div className="review-note stack" role="status">
          <span className="label">Share this link once. It works for one person and won’t be shown again.</span>
          <code className="id invite-link">{link}</code>
          <div>
            <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(link); toast({ message: 'Link copied' }); }}>
              Copy link
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => start(async () => { const r = await revokeInviteAction(id); toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' }); router.refresh(); })}>
      Revoke
    </Button>
  );
}

export function AcceptInvite({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="stack">
      {error ? <p className="jr-field-hint" role="alert" style={{ color: 'var(--danger)' }}>{error}</p> : null}
      <div>
        <Button
          withKey
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await acceptInviteAction(token);
              if (!r.ok) return setError(r.message ?? 'Couldn’t accept the invite.');
              router.push('/portal');
              router.refresh();
            })
          }
        >
          Join the team
        </Button>
      </div>
    </div>
  );
}
