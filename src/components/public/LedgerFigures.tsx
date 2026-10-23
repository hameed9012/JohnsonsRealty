'use client';

import { useEffect, useRef, useState } from 'react';

function format(v: number, kind: 'count' | 'money') {
  const n = Math.round(v).toLocaleString('en-US');
  return kind === 'money' ? '$' + n : n;
}

/** A headline figure that counts up once, over 900ms, the first time it scrolls into view. */
function CountUp({ value, kind }: { value: number; kind: 'count' | 'money' }) {
  const [shown, setShown] = useState(value);
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 900);
        setShown(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      setShown(0);
      raf = requestAnimationFrame(step);
    });
    io.observe(node);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return (
    <span ref={el} aria-hidden>
      {format(shown, kind)}
    </span>
  );
}

export function LedgerFigures({ items }: { items: { label: string; value: number; kind: 'count' | 'money' }[] }) {
  const shown = items.filter((i) => i.value > 0);
  if (!shown.length) return null;
  return (
    <dl className="ledger-figures">
      {shown.map((i) => (
        <div key={i.label}>
          <dt className="label">{i.label}</dt>
          <dd className="price-xl">
            <span className="sr-only">{format(i.value, i.kind)}</span>
            <CountUp value={i.value} kind={i.kind} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
