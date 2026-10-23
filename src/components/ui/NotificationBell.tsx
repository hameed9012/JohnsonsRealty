'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Icon } from './Icon';

export interface BellItem {
  id: string;
  title: string;
  body?: string | null;
  link?: string | null;
  createdAt: string;
  unread: boolean;
}

export interface BellData {
  unread: number;
  items: BellItem[];
}

export interface NotificationBellProps {
  initial: BellData;
  load: () => Promise<BellData>;
  markAllRead: () => Promise<void>;
}

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Unread count refreshes on navigation and every 60 seconds. */
export function NotificationBell({ initial, load, markAllRead }: NotificationBellProps) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const pathname = usePathname();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => load().then((d) => alive && setData(d)).catch(() => {});
    refresh();
    const t = setInterval(refresh, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname, load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = data.unread ? `Notifications, ${data.unread} unread` : 'Notifications';
  return (
    <div className="bell" ref={wrap}>
      <button type="button" className="bell-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" size={20} />
        {data.unread ? (
          <span className="bell-count" aria-hidden>
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="bell-pop" role="dialog" aria-label="Notifications">
          <header>
            <span className="label">Notifications</span>
            {data.unread ? (
              <button
                type="button"
                className="jr-btn jr-btn--ghost jr-btn--sm"
                onClick={() =>
                  start(async () => {
                    await markAllRead();
                    setData((d) => ({ unread: 0, items: d.items.map((i) => ({ ...i, unread: false })) }));
                  })
                }
              >
                Mark all read
              </button>
            ) : null}
          </header>
          {data.items.length ? (
            <ul>
              {data.items.map((n) => (
                <li key={n.id} data-unread={n.unread}>
                  <Link href={n.link || '#'} onClick={() => setOpen(false)}>
                    <b>
                      {n.unread ? <span className="sr-only">Unread: </span> : null}
                      {n.title}
                    </b>
                    {n.body ? <span>{n.body}</span> : null}
                    <time dateTime={n.createdAt}>{WHEN.format(new Date(n.createdAt))}</time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bell-empty">Nothing new. We’ll let you know when something needs you.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
