'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toaster';
import { moveDealStage } from '@/server/actions/ops';

const WORD: Record<string, string> = { active: 'Active', under_offer: 'Under Offer', under_contract: 'Under Contract', settlement: 'Settlement', fallen_through: 'Fell through' };

export function DealStageControl({ id, stage }: { id: string; stage: string }) {
  const [to, setTo] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <select className="jr-field-input" aria-label="Move deal to" value="" onChange={(e) => setTo(e.target.value)} style={{ maxWidth: '220px' }}>
        <option value="">Move deal to…</option>
        {Object.keys(WORD)
          .filter((k) => k !== stage)
          .map((k) => (
            <option key={k} value={k}>
              {WORD[k]}
            </option>
          ))}
      </select>
      <Modal
        open={!!to}
        onClose={() => setTo('')}
        title={`Move to ${WORD[to] ?? ''}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTo('')}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await moveDealStage(id, to as never);
                  toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
                  setTo('');
                  router.refresh();
                })
              }
            >
              Move deal
            </Button>
          </>
        }
      >
        <p className="body">The listing’s status follows the deal, and the client is notified if the deal is shared with them.</p>
      </Modal>
    </>
  );
}
