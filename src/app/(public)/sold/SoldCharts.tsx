'use client';

import { BarChart, type BarDatum } from '@/components/ui/BarChart';

const usd = (v: number) => (v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`);

export function SoldCharts({ volume, areas }: { volume: BarDatum[]; areas: BarDatum[] }) {
  if (!volume.length && !areas.length) return null;
  return (
    <div className="charts-row">
      {volume.length ? <BarChart title="Sales volume by month" data={volume} format={usd} unit="Month" /> : null}
      {areas.length ? <BarChart title="Sales by area" data={areas} format={(v) => String(v)} orientation="horizontal" unit="Area" /> : null}
    </div>
  );
}
