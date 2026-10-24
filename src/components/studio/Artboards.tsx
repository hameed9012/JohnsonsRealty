// Marketing graphics from surfaces.md. Each artboard is laid out at half its output size with the design tokens,
// then exported at 2×, so the PNGs come out exactly 1080×1350, 1080×1080, 1500×500 and 1050×600.
import { Logo, Mark } from '@/components/ui/Logo';
import { cx } from '@/lib/cx';

export const FORMATS = {
  brochure: { label: 'Brochure', w: 540, h: 675, out: '1080×1350' },
  square: { label: 'Square post', w: 540, h: 540, out: '1080×1080' },
  banner: { label: 'Banner', w: 750, h: 250, out: '1500×500' },
  'card-front': { label: 'Business card · front', w: 525, h: 300, out: '1050×600' },
  'card-back': { label: 'Business card · back', w: 525, h: 300, out: '1050×600' },
} as const;
export type Format = keyof typeof FORMATS;

/** The ribbon on the photo. Tone is decorative; the word always says the status. */
export const STAMPS = {
  listed: { label: 'Just Listed', kicker: 'Now available', price: 'Asking', tone: 'cream' },
  reduced: { label: 'Price Reduced', kicker: 'New price', price: 'Now asking', tone: 'cream' },
  open: { label: 'Open House', kicker: 'Open house', price: 'Asking', tone: 'cream' },
  contract: { label: 'Under Contract', kicker: 'Under contract', price: 'Listed at', tone: 'amber' },
  sold: { label: 'Sold', kicker: 'Sold', price: 'Sold for', tone: 'brass' },
  lease: { label: 'For Lease', kicker: 'Available to rent', price: 'Rent', tone: 'sage' },
  leased: { label: 'Leased', kicker: 'Leased', price: 'Leased at', tone: 'brass' },
  bsold: { label: 'Business Sold', kicker: 'Sold', price: 'Sold for', tone: 'brass' },
} as const;
export type Stamp = keyof typeof STAMPS;

export interface StudioData {
  stamp: Stamp;
  date: string;
  address: string;
  areaLine: string;
  stats: { value: string; label: string }[];
  blurb: string;
  price: string;
  showPrice: boolean;
  represented: string;
  photos: string[];
  agent: { name: string; title: string; chirper: string; contact: string };
  brokerage: { subline: string; tagline: string; chirper: string };
}

function prettyDate(d: string) {
  return d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
}

function Photos({ d, multi = true }: { d: StudioData; multi?: boolean }) {
  const list = d.photos.filter(Boolean).slice(0, multi ? 3 : 1);
  const s = STAMPS[d.stamp];
  return (
    <div className={cx('sb-photo', list.length > 1 && 'sb-photo--multi')}>
      {list.length ? (
        // eslint-disable-next-line @next/next/no-img-element -- exported to PNG; next/image wrappers break html-to-image
        list.map((src, i) => <img key={src + i} src={src} alt="" crossOrigin="anonymous" className={cx('sb-p', i === 0 && 'sb-p--main')} />)
      ) : (
        <div className="sb-empty">Choose a photo of the property</div>
      )}
      <div className={`sb-stamp sb-stamp--${s.tone}`}>{s.label}</div>
    </div>
  );
}

function Band({ d }: { d: StudioData }) {
  return (
    <header className="sb-band">
      <Logo tone="dark" subline={d.brokerage.subline} />
      {d.brokerage.tagline ? <div className="sb-tag">{d.brokerage.tagline}</div> : null}
    </header>
  );
}

function Stats({ d }: { d: StudioData }) {
  const stats = d.stats.filter((x) => x.value || x.label);
  if (!stats.length) return null;
  return (
    <div className="sb-stats">
      {stats.map((x, i) => (
        <div key={i} className="sb-stat">
          <b>{x.value || '—'}</b>
          <span>{x.label}</span>
        </div>
      ))}
    </div>
  );
}

function PriceBlock({ d }: { d: StudioData }) {
  const s = STAMPS[d.stamp];
  const closed = d.stamp === 'sold' || d.stamp === 'bsold' || d.stamp === 'leased';
  return d.showPrice && d.price ? (
    <div className="sb-price">
      <small>{s.price}</small>
      <b>{d.price}</b>
    </div>
  ) : (
    <div className="sb-price">
      <small>{closed ? 'Another happy client' : 'Private showings available'}</small>
      <b className="sb-price-contact">Contact {d.agent.name.split(' ')[0] || 'us'}</b>
    </div>
  );
}

function AgentFoot({ d }: { d: StudioData }) {
  return (
    <footer className="sb-foot">
      <div className="sb-agent">
        {d.agent.name}
        <span>{d.agent.title}</span>
      </div>
      <div className="sb-contact">
        {d.agent.contact ? (
          <div>
            <i>Contact</i> {d.agent.contact}
          </div>
        ) : null}
        {d.agent.chirper || d.brokerage.chirper ? (
          <div>
            <i>Chirper</i> @{d.agent.chirper || d.brokerage.chirper}
          </div>
        ) : null}
      </div>
    </footer>
  );
}

function kicker(d: StudioData) {
  const date = prettyDate(d.date);
  return date ? `${STAMPS[d.stamp].kicker} · ${date}` : STAMPS[d.stamp].kicker;
}

export function Brochure({ d }: { d: StudioData }) {
  return (
    <article className="sb sb--brochure" data-theme="light">
      <Band d={d} />
      <Photos d={d} />
      <div className="sb-body">
        <div className="sb-kicker">{kicker(d)}</div>
        <h2 className="sb-addr">{d.address || 'Property address'}</h2>
        {d.areaLine ? <div className="sb-area">{d.areaLine}</div> : null}
        <Stats d={d} />
        {d.blurb ? <p className="sb-blurb">{d.blurb}</p> : null}
        <div className="sb-deal">
          <PriceBlock d={d} />
          {d.represented ? (
            <div className="sb-meta">
              Represented
              <strong>{d.represented}</strong>
            </div>
          ) : null}
        </div>
      </div>
      <AgentFoot d={d} />
    </article>
  );
}

export function Square({ d }: { d: StudioData }) {
  return (
    <article className="sb sb--square" data-theme="light">
      <Band d={d} />
      <Photos d={d} multi={false} />
      <div className="sb-body">
        <div className="sb-kicker">{kicker(d)}</div>
        <h2 className="sb-addr sb-addr--s">{d.address || 'Property address'}</h2>
        <Stats d={d} />
        <div className="sb-deal">
          <PriceBlock d={d} />
          <div className="sb-meta">
            <strong>{d.agent.name}</strong>
            {d.agent.chirper ? `@${d.agent.chirper}` : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function Banner({ d, figures }: { d: StudioData; figures: { value: string; label: string }[] }) {
  return (
    <article className="sb sb--banner" data-theme="light">
      <Logo tone="dark" subline={d.brokerage.subline} size={56} />
      <div className="sb-ledger">
        {figures.map((f) => (
          <div key={f.label}>
            <b>{f.value}</b>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function CardFront({ d }: { d: StudioData }) {
  return (
    <article className="sb sb--card-front" data-theme="light">
      <Mark tone="dark" size={72} decorative />
      <div className="sb-card-word">Johnson’s Realty</div>
      {d.brokerage.tagline ? <div className="sb-card-tag">{d.brokerage.tagline}</div> : null}
    </article>
  );
}

export function CardBack({ d }: { d: StudioData }) {
  return (
    <article className="sb sb--card-back" data-theme="light">
      <div className="sb-card-name">{d.agent.name || 'Your name'}</div>
      <div className="sb-card-title">{d.agent.title}</div>
      <div className="sb-card-lines">
        {d.agent.chirper ? <div>@{d.agent.chirper}</div> : null}
        {d.agent.contact ? <div>{d.agent.contact}</div> : null}
      </div>
      <Mark tone="light" size={36} decorative />
    </article>
  );
}

export function Artboard({ format, d, figures = [] }: { format: Format; d: StudioData; figures?: { value: string; label: string }[] }) {
  switch (format) {
    case 'brochure':
      return <Brochure d={d} />;
    case 'square':
      return <Square d={d} />;
    case 'banner':
      return <Banner d={d} figures={figures} />;
    case 'card-front':
      return <CardFront d={d} />;
    case 'card-back':
      return <CardBack d={d} />;
  }
}

/** Exports an artboard element to PNG at 2×. */
export async function exportPng(node: HTMLElement, filename: string) {
  const { toPng } = await import('html-to-image');
  if (document.fonts?.ready) await document.fonts.ready;
  const url = await toPng(node, { pixelRatio: 2, cacheBust: true, width: node.offsetWidth, height: node.offsetHeight, style: { transform: 'none' } });
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
  a.click();
}
