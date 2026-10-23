'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** A timestamp in the viewer's own time zone. The server render shows UTC so nothing shifts on hydration. */
export function LocalTime({ iso, withTime = true }: { iso: string; withTime?: boolean }) {
  const client = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  const text = client ? new Intl.DateTimeFormat('en-US', opts).format(d) : new Intl.DateTimeFormat('en-US', { ...opts, timeZone: 'UTC' }).format(d) + (withTime ? ' UTC' : '');
  return (
    <time dateTime={iso} className="figure">
      {text}
    </time>
  );
}
