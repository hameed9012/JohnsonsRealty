'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Dialog';
import { PipelineCard } from '@/components/ui/documents';
import type { StatusKey } from '@/components/ui/status';
import { useToast } from '@/components/ui/Toaster';
import { cx } from '@/lib/cx';
import { moveDealStage } from '@/server/actions/ops';

export interface BoardDeal {
  id: string;
  stage: string;
  status: StatusKey;
  address: string;
  value: number;
  client?: string;
  due?: string;
  agent?: string;
  canManage: boolean;
}

const COLUMNS = [
  { key: 'active', label: 'Active' },
  { key: 'under_offer', label: 'Under Offer' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'closed', label: 'Closed' },
] as const;
const WORD: Record<string, string> = { active: 'Active', under_offer: 'Under Offer', under_contract: 'Under Contract', settlement: 'Settlement', closed: 'Closed', fallen_through: 'Fallen through' };

/** Pipeline columns. Drag a card to another column (or use its Move menu) and confirm. Closing goes through Record sale. */
export function PipelineBoard({ deals }: { deals: BoardDeal[] }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ deal: BoardDeal; to: string } | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const ask = (dealId: string, to: string) => {
    const d = deals.find((x) => x.id === dealId);
    if (!d || d.stage === to || !d.canManage) return;
    if (to === 'closed') {
      router.push(`/portal/deals/${d.id}#record-sale`);
      return;
    }
    setPendingMove({ deal: d, to });
  };

  return (
    <>
      <div className="board" role="list" aria-label="Deal pipeline">
        {COLUMNS.map((col) => {
          const items = deals.filter((d) => d.stage === col.key);
          return (
            <section
              key={col.key}
              role="listitem"
              aria-label={`${col.label}, ${items.length} deals`}
              className={cx('board-col', over === col.key && 'board-col--over')}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (drag) ask(drag, col.key);
                setDrag(null);
              }}
            >
              <header className="board-head">
                <span className="label">{col.label}</span>
                <span className="figure muted">{items.length}</span>
              </header>
              <ol className="board-list">
                {items.map((d) => (
                  <li key={d.id} draggable={d.canManage} onDragStart={() => setDrag(d.id)} onDragEnd={() => setDrag(null)} className={cx(drag === d.id && 'board-dragging')}>
                    <Link href={`/portal/deals/${d.id}`} className="board-card">
                      <PipelineCard status={d.status} address={d.address} value={d.value} client={d.client} due={d.due} agent={d.agent} />
                    </Link>
                    {d.canManage && d.stage !== 'closed' ? (
                      <select className="jr-field-input board-move" aria-label={`Move ${d.address} to`} value="" onChange={(e) => e.target.value && ask(d.id, e.target.value)}>
                        <option value="">Move to…</option>
                        {[...COLUMNS.map((c) => c.key), 'fallen_through'].filter((k) => k !== d.stage).map((k) => (
                          <option key={k} value={k}>
                            {k === 'closed' ? 'Closed (record sale)' : WORD[k]}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      <Modal
        open={!!pendingMove}
        onClose={() => setPendingMove(null)}
        title="Move this deal?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingMove(null)}>
              Keep it where it is
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                start(async () => {
                  const m = pendingMove!;
                  const r = await moveDealStage(m.deal.id, m.to as never);
                  toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
                  setPendingMove(null);
                  router.refresh();
                })
              }
            >
              Move to {pendingMove ? WORD[pendingMove.to] : ''}
            </Button>
          </>
        }
      >
        {pendingMove ? (
          <p className="body">
            {pendingMove.deal.address} moves from {WORD[pendingMove.deal.stage]} to {WORD[pendingMove.to]}. The listing’s status follows, and the client sees the new stage on their deal page.
          </p>
        ) : null}
      </Modal>
    </>
  );
}
