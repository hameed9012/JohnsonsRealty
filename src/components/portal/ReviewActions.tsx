'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { Modal } from '@/components/ui/Dialog';
import { SelectField, TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { decideListing } from '@/server/actions/listings';

type Decision = 'approved' | 'changes_requested' | 'rejected';

export function ReviewActions({ id, ownerListing, agents, currentAgentId, rent }: { id: string; ownerListing: boolean; agents: { id: string; name: string | null }[]; currentAgentId: string | null; rent: boolean }) {
  const [open, setOpen] = useState<Decision | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [comingSoon, setComingSoon] = useState(false);
  const [agentId, setAgentId] = useState(currentAgentId ?? '');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const submit = (decision: Decision) =>
    start(async () => {
      const r = await decideListing(id, { decision, notes, comingSoon, ...(ownerListing ? { agentId: agentId || null } : {}) });
      if (!r.ok) {
        setError(r.fieldErrors?.notes ?? r.fieldErrors?.agentId);
        toast({ message: r.message ?? 'Couldn’t save the decision.', tone: 'danger' });
        return;
      }
      setOpen(null);
      toast({ message: r.message ?? 'Saved', tone: 'success' });
      router.push('/portal/review');
      router.refresh();
    });

  const titles: Record<Decision, string> = { approved: 'Approve and publish', changes_requested: 'Request changes', rejected: 'Reject listing' };

  return (
    <div className="stack">
      <div className="row">
        <Button withKey onClick={() => setOpen('approved')}>
          Approve
        </Button>
        <Button variant="secondary" onClick={() => setOpen('changes_requested')}>
          Request changes
        </Button>
        <Button variant="danger" onClick={() => setOpen('rejected')}>
          Reject
        </Button>
      </div>
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? titles[open] : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            {open ? (
              <Button variant={open === 'rejected' ? 'danger' : 'primary'} loading={pending} onClick={() => submit(open)}>
                {open === 'approved' ? 'Publish listing' : open === 'changes_requested' ? 'Send notes' : 'Reject listing'}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="stack">
          {open === 'approved' ? (
            <>
              <p className="body">It goes live on the public site as {rent ? 'For Lease' : 'Active'} and the submitter is notified.</p>
              <Toggle label="Publish as Coming Soon" hint="Shows on the site before launch." checked={comingSoon} onChange={(e) => setComingSoon(e.target.checked)} />
              {ownerListing ? (
                <SelectField
                  label="Brokerage contact (optional)"
                  name="agentId"
                  placeholder="No agent; the owner handles enquiries"
                  options={agents.map((a) => ({ value: a.id, label: a.name ?? 'Agent' }))}
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  hint="Shown beside “Listed by Owner” on the listing."
                />
              ) : null}
            </>
          ) : null}
          <TextField
            label={open === 'approved' ? 'Note to the submitter (optional)' : 'Notes for the submitter'}
            name="notes"
            multiline
            rows={4}
            value={notes}
            error={error}
            onChange={(e) => {
              setNotes(e.target.value);
              setError(undefined);
            }}
            hint={open === 'changes_requested' ? 'Say what to change. They can edit and resubmit.' : open === 'rejected' ? 'Say why. The listing won’t go public.' : undefined}
          />
        </div>
      </Modal>
    </div>
  );
}
