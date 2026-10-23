'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { changeRole, setUserActive } from '@/server/actions/admin';

const LABELS = { admin: 'Admin', agent: 'Agent', client: 'Client' } as const;
type Assignable = keyof typeof LABELS;

export function RoleSelect({ userId, name, role, options }: { userId: string; name: string; role: string; options: Assignable[] }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Assignable | null>(null);
  const toast = useToast();
  const router = useRouter();
  if (!options.length) return <span>{role[0]!.toUpperCase() + role.slice(1)}</span>;
  return (
    <>
      <select
        className="jr-field-input"
        aria-label={`Role for ${name}`}
        value={role}
        disabled={pending}
        onChange={(e) => setConfirm(e.target.value as Assignable)}
      >
        {!options.includes(role as Assignable) ? <option value={role}>{role[0]!.toUpperCase() + role.slice(1)}</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {LABELS[o]}
          </option>
        ))}
      </select>
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Change role"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await changeRole({ userId, role: confirm! });
                  setConfirm(null);
                  if (r?.message) toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
                  router.refresh();
                })
              }
            >
              Make {name} {confirm ? LABELS[confirm] : ''}
            </Button>
          </>
        }
      >
        <p className="body">
          {confirm === 'client'
            ? `${name} will lose portal access. Their listings and client files stay where they are.`
            : `${name} will get portal access as ${confirm === 'admin' ? 'an Admin' : 'an Agent'}.`}
        </p>
      </Modal>
    </>
  );
}

export function ActiveToggle({ userId, name, active }: { userId: string; name: string; active: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant={active ? 'ghost' : 'secondary'}
      loading={pending}
      aria-label={`${active ? 'Deactivate' : 'Reactivate'} ${name}`}
      onClick={() =>
        start(async () => {
          const r = await setUserActive(userId, !active);
          if (r?.message) toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
          router.refresh();
        })
      }
    >
      {active ? 'Deactivate' : 'Reactivate'}
    </Button>
  );
}
