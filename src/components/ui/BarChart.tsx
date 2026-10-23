'use client';

import { useId, useState } from 'react';

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  title: string;
  data: BarDatum[];
  format: (v: number) => string;
  /** Vertical columns (time) or horizontal bars (categories). */
  orientation?: 'vertical' | 'horizontal';
  unit?: string;
}

const W = 640;
const H = 240;
const PAD = { top: 24, right: 8, bottom: 28, left: 8 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * Single-series bar chart in the brand green: thin marks with rounded data ends on the baseline,
 * 2px gaps, a recessive grid, a tooltip on hover and focus, a direct label on the largest bar only,
 * and a table view for screen readers and anyone who prefers numbers.
 */
export function BarChart({ title, data, format, orientation = 'vertical', unit }: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  if (!data.length) return null;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const peak = data.reduce((m, d, i) => (d.value > data[m]!.value ? i : m), 0);
  const ticks = [0, 0.5, 1].map((t) => t * max);

  if (orientation === 'horizontal') {
    const rowH = 32;
    const labelW = 160;
    const h = data.length * rowH + 8;
    const plotW = W - labelW - 80;
    return (
      <figure className="chart" aria-labelledby={`${id}-t`}>
        <figcaption id={`${id}-t`} className="label">
          {title}
        </figcaption>
        <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${title}. ${data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}`} className="chart-svg">
          {data.map((d, i) => {
            const w = Math.max(2, (d.value / max) * plotW);
            const y = i * rowH + 6;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <text x={0} y={y + 14} className="chart-label">
                  {d.label}
                </text>
                <rect x={labelW} y={y} width={w} height={rowH - 12} rx={4} className={hover === null || hover === i ? 'chart-bar' : 'chart-bar chart-bar--dim'} />
                <text x={labelW + w + 8} y={y + 14} className="chart-value">
                  {format(d.value)}
                </text>
                <rect x={0} y={y - 4} width={W} height={rowH} fill="transparent" tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
              </g>
            );
          })}
        </svg>
        <ChartTable title={title} data={data} format={format} unit={unit} />
      </figure>
    );
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(36, slot - 2);
  const yOf = (v: number) => PAD.top + plotH - (v / max) * plotH;
  return (
    <figure className="chart" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="label">
        {title}
      </figcaption>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}`} className="chart-svg">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(t)} y2={yOf(t)} className={t === 0 ? 'chart-base' : 'chart-grid'} />
              {t > 0 ? (
                <text x={W - PAD.right} y={yOf(t) - 4} textAnchor="end" className="chart-tick">
                  {format(t)}
                </text>
              ) : null}
            </g>
          ))}
          {data.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const y = yOf(d.value);
            const h = Math.max(2, PAD.top + plotH - y);
            // Rounded top, square base: a path keeps the data end rounded and the baseline flat.
            const r = Math.min(4, barW / 2, h);
            const path = `M${x},${PAD.top + plotH} V${PAD.top + plotH - h + r} Q${x},${PAD.top + plotH - h} ${x + r},${PAD.top + plotH - h} H${x + barW - r} Q${x + barW},${PAD.top + plotH - h} ${x + barW},${PAD.top + plotH - h + r} V${PAD.top + plotH} Z`;
            return (
              <g key={d.label}>
                <path d={path} className={hover === null || hover === i ? 'chart-bar' : 'chart-bar chart-bar--dim'} />
                {i === peak && hover === null ? (
                  <text x={x + barW / 2} y={PAD.top + plotH - h - 6} textAnchor="middle" className="chart-value">
                    {format(d.value)}
                  </text>
                ) : null}
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="chart-tick">
                  {d.label}
                </text>
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: ${format(d.value)}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null ? (
          <div className="chart-tip" style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, top: `${(yOf(data[hover]!.value) / H) * 100}%` }} role="status">
            <span className="caption">{data[hover]!.label}</span>
            <b className="figure">{format(data[hover]!.value)}</b>
          </div>
        ) : null}
      </div>
      <ChartTable title={title} data={data} format={format} unit={unit} />
    </figure>
  );
}

function ChartTable({ title, data, format, unit }: { title: string; data: BarDatum[]; format: (v: number) => string; unit?: string }) {
  return (
    <details className="chart-table">
      <summary className="body-s">Show as table</summary>
      <table className="jr-ledger">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col">{unit ?? 'Period'}</th>
            <th scope="col" className="right">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td className="num right">{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
