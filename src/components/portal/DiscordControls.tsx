'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { cancelOpenHouseAction, createOpenHouseAction, postListingToDiscordAction, publishAnnouncementAction, retryDiscordPostAction, syncRolesAction, type SimpleResult } from '@/server/actions/discord';

function useAct() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const act = (fn: () => Promise<SimpleResult>, after?: (r: SimpleResult) => void) =>
    start(async () => {
      const r = await fn();
      toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
      after?.(r);
      if (r.ok) router.refresh();
    });
  return { pending, act };
}

export function RetryPostButton({ id }: { id: string }) {
  const { pending, act } = useAct();
  return (
    <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => retryDiscordPostAction(id))}>
      Retry
    </Button>
  );
}

export function SyncRolesButton({ disabled }: { disabled?: boolean }) {
  const { pending, act } = useAct();
  return (
    <Button variant="secondary" disabled={disabled} loading={pending} onClick={() => act(() => syncRolesAction())}>
      Sync roles now
    </Button>
  );
}

export function PostToDiscordButton({ listingId, posted }: { listingId: string; posted: boolean }) {
  const { pending, act } = useAct();
  return (
    <Button variant="ghost" icon="share" loading={pending} onClick={() => (!posted || confirm('This listing was already announced. Post it again?')) && act(() => postListingToDiscordAction(listingId))}>
      {posted ? 'Post to Discord again' : 'Post to Discord'}
    </Button>
  );
}

export function AnnouncementForm() {
  const { pending, act } = useAct();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ping, setPing] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        act(
          () => publishAnnouncementAction({ title, body, pingRole: ping }),
          (r) => {
            setErrors(r.fieldErrors ?? {});
            if (r.ok) {
              setTitle('');
              setBody('');
            }
          },
        );
      }}
    >
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={200} />
      <TextField label="Announcement" multiline rows={6} value={body} onChange={(e) => setBody(e.target.value)} error={errors.body} hint="Plain text. **Bold** works in Discord." maxLength={3500} />
      <Toggle label="Ping Notifications: Announcements" hint="Members who picked announcement pings get notified." checked={ping} onChange={(e) => setPing(e.target.checked)} />
      {title || body ? (
        <div className="dc-preview" aria-label="Preview">
          <div className="dc-embed">
            {title ? <div className="dc-title">{title}</div> : null}
            {body ? <div className="dc-desc">{body}</div> : null}
          </div>
        </div>
      ) : null}
      <div className="row">
        <Button type="submit" loading={pending}>
          Publish to #announcements
        </Button>
      </div>
    </form>
  );
}

export function OpenHouseForm({ listingId }: { listingId: string }) {
  const { pending, act } = useAct();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const iso = (v: FormDataEntryValue | null) => (v ? new Date(String(v)).toISOString() : '');
        act(
          () => createOpenHouseAction({ listingId, startsAt: iso(fd.get('startsAt')), endsAt: iso(fd.get('endsAt')), notes: String(fd.get('notes') ?? '') }),
          (r) => {
            setErrors(r.fieldErrors ?? {});
            if (r.ok) setKey((k) => k + 1);
          },
        );
      }}
    >
      <div className="grid-12">
        <TextField className="span-6" label="Starts" name="startsAt" type="datetime-local" mono error={errors.startsAt} />
        <TextField className="span-6" label="Ends" name="endsAt" type="datetime-local" mono error={errors.endsAt} />
      </div>
      <TextField label="Notes (optional)" name="notes" error={errors.notes} placeholder="e.g. Park on the street, meet at the gate" />
      <div className="row">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          Schedule open house
        </Button>
      </div>
    </form>
  );
}

export function CancelOpenHouseButton({ id }: { id: string }) {
  const { pending, act } = useAct();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => confirm('Cancel this open house?') && act(() => cancelOpenHouseAction(id))}>
      Cancel
    </Button>
  );
}
