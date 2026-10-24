'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { addZoneAction, deleteZoneAction, saveZoneAction, setSoldDaysAction, type MapActionResult } from '@/server/actions/map';

export interface ZoneRow {
  code: string;
  label: string;
  x: number;
  y: number;
  areaId: string | null;
}

/**
 * The Owner's map editor: every postal zone as a dot on the map. Drag a dot (or select it and use the arrow
 * keys) to move it; edit its name and area beside the map. Changes save per zone.
 */
export function ZoneEditor({ src, width, height, zones: initial, areas, soldDays, add }: { src: string; width: number; height: number; zones: ZoneRow[]; areas: { value: string; label: string }[]; soldDays: number; add?: string }) {
  const [zones, setZones] = useState(initial);
  const [sel, setSel] = useState<string | null>(add && initial.some((z) => z.code === add) ? add : null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const selected = zones.find((z) => z.code === sel) ?? null;
  const areaName = (id: string | null) => areas.find((a) => a.value === id)?.label ?? 'No area (state park)';

  const run = (fn: () => Promise<MapActionResult>, after?: (r: MapActionResult) => void) =>
    start(async () => {
      const r = await fn();
      toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
      setErrors(r.fieldErrors ?? {});
      after?.(r);
      if (r.ok) router.refresh();
    });

  const patch = (code: string, p: Partial<ZoneRow>) => {
    setZones((zs) => zs.map((z) => (z.code === code ? { ...z, ...p } : z)));
    setDirty((d) => new Set(d).add(code));
  };
  const move = (clientX: number, clientY: number) => {
    const r = frame.current!.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100));
    patch(drag.current!, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  };

  return (
    <div className="zone-editor">
      <div
        ref={frame}
        className="pmap-frame zone-frame"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerMove={(e) => drag.current && move(e.clientX, e.clientY)}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the uploaded map image the zones are placed on */}
        <img src={src} alt="Map of the playable area" className="pmap-img" draggable={false} />
        {zones.map((z) => (
          <button
            key={z.code}
            type="button"
            className={`zone-dot${z.code === sel ? ' zone-dot--on' : ''}${z.areaId ? '' : ' zone-dot--park'}`}
            style={{ left: `${z.x}%`, top: `${z.y}%` }}
            aria-label={`Postal ${z.code}, ${z.label}, ${areaName(z.areaId)}. Arrow keys move it.`}
            aria-pressed={z.code === sel}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              drag.current = z.code;
              setSel(z.code);
            }}
            onClick={() => setSel(z.code)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 2 : 0.25;
              const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
              if (!d[e.key]) return;
              e.preventDefault();
              patch(z.code, { x: Math.min(100, Math.max(0, z.x + d[e.key]![0])), y: Math.min(100, Math.max(0, z.y + d[e.key]![1])) });
            }}
          >
            {z.code}
          </button>
        ))}
      </div>

      <div className="stack zone-side">
        {selected ? (
          <section className="panel stack" aria-labelledby="zone-h">
            <h2 id="zone-h" className="heading-3">
              Postal {selected.code}
            </h2>
            <TextField label="Name" value={selected.label} onChange={(e) => patch(selected.code, { label: e.target.value })} error={errors.label} />
            <SelectField label="Area" placeholder="No area (state park)" options={areas} value={selected.areaId ?? ''} onChange={(e) => patch(selected.code, { areaId: e.target.value || null })} hint="Choosing this postal code on a listing fills in this area." />
            <p className="body-s muted">
              Position {selected.x.toFixed(1)}% across, {selected.y.toFixed(1)}% down.
            </p>
            <div className="row">
              <Button size="sm" loading={pending} disabled={!dirty.has(selected.code)} onClick={() => run(() => saveZoneAction(selected), (r) => r.ok && setDirty((d) => { const n = new Set(d); n.delete(selected.code); return n; }))}>
                Save zone
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(`Remove postal ${selected.code} from the map? Listings using it will disappear from the map until it's added back.`) && run(() => deleteZoneAction(selected.code), (r) => r.ok && setSel(null))}>
                Remove
              </Button>
            </div>
          </section>
        ) : (
          <p className="body-s muted">Select a zone on the map to move, rename or re-assign it. {dirty.size ? `${dirty.size} unsaved.` : ''}</p>
        )}

        <section className="panel stack" aria-labelledby="add-h">
          <h2 id="add-h" className="heading-3">
            Add a zone
          </h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const code = String(fd.get('code') ?? '');
              run(() => addZoneAction({ code, label: String(fd.get('label') ?? ''), areaId: String(fd.get('areaId') ?? '') || null }), (r) => r.ok && setSel(code));
            }}
          >
            <div className="grid-12">
              <TextField className="span-4" label="Postal" name="code" mono inputMode="numeric" defaultValue={add && !initial.some((z) => z.code === add) ? add : ''} error={errors.code} />
              <TextField className="span-8" label="Name" name="label" placeholder="e.g. Fairview Heights" error={errors.label} />
            </div>
            <SelectField label="Area" name="areaId" placeholder="No area (state park)" options={areas} />
            <p className="body-s muted">It appears in the middle of the map; drag it into place, then save.</p>
            <div className="row">
              <Button type="submit" size="sm" variant="secondary" loading={pending}>
                Add zone
              </Button>
            </div>
          </form>
        </section>

        <section className="panel stack" aria-labelledby="sold-h">
          <h2 id="sold-h" className="heading-3">
            Sold listings
          </h2>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => setSoldDaysAction(Number(new FormData(e.currentTarget).get('days'))));
            }}
          >
            <TextField label="Days they stay on the map" name="days" type="number" min={0} max={365} defaultValue={String(soldDays)} />
            <Button type="submit" size="sm" variant="secondary" loading={pending}>
              Save
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
