'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/fields';
import { LocalTime } from '@/components/ui/LocalTime';
import { useToast } from '@/components/ui/Toaster';
import { cx } from '@/lib/cx';
import { sendDealMessage } from '@/server/actions/messages';

export interface ThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  authorId: string | null;
  author: string | null;
  staff: boolean;
}

/** The deal thread between the client and their agent. Refreshes every 30 seconds while open. */
export function MessageThread({ dealId, messages, meId }: { dealId: string; messages: ThreadMessage[]; meId: string }) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <section className="thread stack" aria-label="Messages">
      <ol className="thread-list" aria-live="polite">
        {messages.length === 0 ? <li className="body-s muted">No messages yet. Say hello to your agent.</li> : null}
        {messages.map((m) => (
          <li key={m.id} className={cx('thread-msg', m.authorId === meId && 'thread-msg--me')}>
            <div className="thread-meta">
              <b className="ui">{m.authorId === meId ? 'You' : (m.author ?? 'Former member')}</b>
              {m.staff && m.authorId !== meId ? <span className="label">Agent</span> : null}
              <LocalTime iso={m.createdAt} />
            </div>
            <p className="body">{m.body}</p>
          </li>
        ))}
      </ol>
      <div ref={end} />
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await sendDealMessage(dealId, body);
            if (r.error) return setError(r.error);
            if (!r.ok) return toast({ message: r.message ?? 'Couldn’t send that.', tone: 'danger' });
            setBody('');
            router.refresh();
          });
        }}
      >
        <TextField
          label="Message"
          multiline
          rows={3}
          value={body}
          error={error}
          onChange={(e) => {
            setBody(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
          }}
        />
        <div className="row">
          <Button type="submit" loading={pending} icon="chat">
            Send message
          </Button>
          <span className="caption muted">Ctrl + Enter sends</span>
        </div>
      </form>
    </section>
  );
}
