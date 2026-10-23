'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Drawer, Modal } from '@/components/ui/Dialog';
import { FilterChip } from '@/components/ui/FilterChip';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toaster';
import { TextField } from '@/components/ui/fields';

const BELL = {
  unread: 2,
  items: [
    { id: '1', title: 'Listing waiting for review', body: 'Example Lane, submitted by Example Agent', link: '#', createdAt: '2026-10-21T15:00:00Z', unread: true },
    { id: '2', title: 'Showing requested', body: 'Example Court, tomorrow 6:00 PM', link: '#', createdAt: '2026-10-21T13:00:00Z', unread: true },
  ],
};

export function Interactive() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [chips, setChips] = useState<string[]>(['pool']);
  const toast = useToast();
  return (
    <div className="stack">
      <div className="row">
        <Button variant="secondary" onClick={() => setModal(true)}>
          Open modal
        </Button>
        <Button variant="secondary" onClick={() => setDrawer(true)} icon="filter">
          Open drawer
        </Button>
        <Button variant="secondary" onClick={() => toast({ message: 'Listing published', tone: 'success', action: { label: 'View', onClick: () => {} } })}>
          Show toast
        </Button>
        <NotificationBell initial={BELL} load={async () => BELL} markAllRead={async () => {}} />
      </div>
      <div className="row">
        {['pool', 'gate', 'office'].map((c) => (
          <FilterChip key={c} selected={chips.includes(c)} count={3} onClick={() => setChips((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))}>
            {c[0]!.toUpperCase() + c.slice(1)}
          </FilterChip>
        ))}
      </div>
      <Tabs
        label="Example tabs"
        tabs={[
          { id: 'a', label: 'Overview', content: <p className="body">Tab content in body style.</p> },
          { id: 'b', label: 'Photos', content: <p className="body">Second panel.</p> },
          { id: 'c', label: 'Seller', content: <p className="body">Third panel.</p> },
        ]}
      />
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Request changes"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModal(false)}>Send notes</Button>
          </>
        }
      >
        <TextField label="Notes for the submitter" multiline rows={4} hint="Say what to change and why." />
      </Modal>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Filters" footer={<Button onClick={() => setDrawer(false)}>Show 12 homes</Button>}>
        <p className="body muted">On phones this is a bottom sheet.</p>
      </Drawer>
    </div>
  );
}
