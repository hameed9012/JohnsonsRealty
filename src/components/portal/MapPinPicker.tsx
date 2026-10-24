'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MapPin } from '@/components/listing/MapPin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { setListingPin } from '@/server/actions/ops';

/**
 * Click the brokerage map to place this listing's pin. Keyboard users can nudge it with the arrow keys once placed.
 * The position is only ever what a person chose; nothing is guessed from the address.
 */
export function MapPinPicker({ id, src, initial, title }: { id: string; src: string; initial: { x: number; y: number } | null; title: string }) {
  const [pin, setPin] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const dirty = JSON.stringify(pin) !== JSON.stringify(initial);
  const save = (next: typeof pin) =>
    start(async () => {
      const r = await setListingPin(id, next);
      if (r.message) toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
      if (r.ok) router.refresh();
    });
  const nudge = (dx: number, dy: number) => pin && setPin({ x: Math.min(100, Math.max(0, pin.x + dx)), y: Math.min(100, Math.max(0, pin.y + dy)) });
  return (
    <div className="stack">
      <div
        className="map-pick"
        tabIndex={0}
        role="application"
        aria-label={`Map. ${pin ? `Pin at ${pin.x.toFixed(1)}% across, ${pin.y.toFixed(1)}% down. Arrow keys move it.` : 'Click to place the pin.'}`}
        onClick={(e) => {
          const r = (e.currentTarget.querySelector('.map-frame') as HTMLElement).getBoundingClientRect();
          setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 2 : 0.5;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          if (moves[e.key]) {
            e.preventDefault();
            if (!pin) setPin({ x: 50, y: 50 });
            else nudge(...moves[e.key]!);
          }
        }}
      >
        <MapPin src={src} pins={pin ? [{ ...pin, label: title }] : []} />
      </div>
      <div className="row">
        <Button size="sm" loading={pending} disabled={!dirty || !pin} onClick={() => save(pin)}>
          Save pin
        </Button>
        {initial ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setPin(null);
              save(null);
            }}
          >
            Remove pin
          </Button>
        ) : null}
        <span className="body-s muted">{pin ? 'Shown on the public page once saved.' : 'No pin yet. The public page shows no map until you place one.'}</span>
      </div>
    </div>
  );
}
