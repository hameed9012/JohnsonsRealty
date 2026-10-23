import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as UI from '@/components/ui';
import { ToastProvider } from '@/components/ui/Toaster';
import { isStaff } from '@/lib/permissions';
import { getActor } from '@/server/session';
import { Interactive } from './Interactive';

export const metadata: Metadata = { title: 'Styleguide', robots: { index: false } };

// Placeholder content shows layouts only ("Example …"); nothing here is real data.
const COLORS = ['green-950', 'green-900', 'green-800', 'green-700', 'green-300', 'green-100', 'brass-700', 'brass-500', 'brass-300', 'brass-100', 'cream', 'paper'];
const SEMANTIC = ['bg', 'surface', 'surface-sunken', 'ink', 'ink-muted', 'line', 'line-strong', 'primary', 'accent', 'accent-text', 'link', 'focus', 'danger'];
const TYPE = ['display-xl', 'display-l', 'display-m', 'heading-1', 'heading-2', 'heading-3', 'label', 'body-l', 'body', 'body-s', 'ui', 'caption', 'price-xl', 'price', 'figure', 'id', 'doc-title', 'form-label', 'form-value', 'signature'];
const EXT = '/styleguide/in-game-exterior-sample.jpg';

function Gallery({ p }: { p: string }) {
  return (
    <div className="stack-lg">
      <section className="stack">
        <h3 className="heading-2">Logo</h3>
        <div className="row">
          <UI.Logo />
          <UI.Logo small subline={false} />
          <UI.Logo variant="mark" />
        </div>
      </section>

      <section className="stack">
        <h3 className="heading-2">Buttons</h3>
        <div className="row">
          <UI.Button withKey>List your property</UI.Button>
          <UI.Button variant="secondary" icon="calendar">
            Book a showing
          </UI.Button>
          <UI.Button variant="ghost" icon="heart">
            Save home
          </UI.Button>
          <UI.Button variant="danger">Withdraw listing</UI.Button>
          <UI.Button size="sm">Publish listing</UI.Button>
          <UI.Button loading>Saving</UI.Button>
          <UI.Button disabled>Submit for review</UI.Button>
        </div>
      </section>

      <section className="stack">
        <h3 className="heading-2">Status</h3>
        <div className="row">
          {(Object.keys(UI.STATUS) as UI.StatusKey[]).map((s) => (
            <UI.StatusPill key={s} status={s} />
          ))}
        </div>
        <div className="row">
          <UI.StatusStamp status="sold" size="lg" />
          <UI.StatusStamp status="under-offer" />
          <UI.StatusStamp status="pending-review" size="sm" />
          <UI.StatusStamp status="just-listed" variant="ribbon" />
          <UI.StatusStamp status="for-lease" variant="ribbon" />
        </div>
      </section>

      <section className="stack">
        <h3 className="heading-2">Fields</h3>
        <div className="grid-12">
          <div style={{ gridColumn: 'span 4' }}>
            <UI.TextField label="Asking price" name={p + '-price'} mono placeholder="365000" hint="Dollars, no cents." />
          </div>
          <div style={{ gridColumn: 'span 4' }}>
            <UI.TextField label="Parcel ID" name={p + '-parcel'} mono error="Enter a parcel ID like 63-018-061." defaultValue="63018" />
          </div>
          <div style={{ gridColumn: 'span 4' }}>
            <UI.SelectField label="Area" name={p + '-area'} placeholder="Any area" options={['Example Area', 'Example District']} />
          </div>
        </div>
        <UI.RadioGroup legend="Purpose" name={p + '-purpose'} defaultValue="sale" options={[{ value: 'sale', label: 'For sale' }, { value: 'rent', label: 'For rent' }]} />
        <UI.FeatureChips
          legend="Features"
          name={p + '-features'}
          defaultSelected={['pool']}
          options={[
            { value: 'pool', label: 'Pool', icon: 'pool' },
            { value: 'gate', label: 'Gated', icon: 'gate' },
            { value: 'office', label: 'Home office', icon: 'office' },
            { value: 'laundry', label: 'Laundry room', icon: 'laundry' },
          ]}
        />
        <div className="row">
          <UI.Toggle label="Email me new matches" hint="In-app alert when a matching listing is approved." defaultChecked />
          <UI.Checkbox label="Include owner listings" defaultChecked />
        </div>
        <UI.SearchBar
          action="/buy"
          fields={[
            { name: 'area', label: 'Area', options: ['Any area', 'Example Area'] },
            { name: 'type', label: 'Type', options: ['Any type', 'House', 'Apartment'] },
            { name: 'max', label: 'Max price', options: ['No max', '$250,000', '$500,000'] },
          ]}
        />
      </section>

      <section className="stack">
        <h3 className="heading-2">Listing cards</h3>
        <div className="card-grid">
          <UI.ListingCard
            address="000 Example Lane"
            area="Example Area"
            price={365000}
            status="just-listed"
            photo={EXT}
            facts={[
              { icon: 'bed', text: '3 bed' },
              { icon: 'bath', text: '2 bath' },
              { icon: 'area', text: '1,850 sq ft' },
            ]}
            saved={false}
          />
          <UI.ListingCard address="000 Example Court, Unit 2" area="Example Area" price={1900} priceKind="rent" status="for-lease" ownerListed facts={[{ icon: 'bed', text: '2 bed' }]} />
          <UI.ListingCard address="Established diner, Example Area" price={340000} previousPrice={365000} priceKind="reduced" status="price-reduced" photo={EXT} />
        </div>
        <UI.ListingCard layout="list" address="000 Example Road" area="Example Area" price={189000} status="under-offer" photo={EXT} facts={[{ icon: 'bed', text: '1 bed' }]} saved />
      </section>

      <section className="stack">
        <h3 className="heading-2">Facts and prices</h3>
        <UI.StatRow
          items={[
            { icon: 'bed', value: 3, label: 'Beds' },
            { icon: 'bath', value: 2, label: 'Baths' },
            { icon: 'area', value: '1,850', label: 'Sq ft' },
            { icon: 'lot', value: '0.22', label: 'Acres' },
            { icon: 'calendar', value: 1994, label: 'Built' },
          ]}
        />
        <div className="row">
          <UI.PriceDisplay amount={365000} size="xl" />
          <UI.PriceDisplay amount={1900} kind="rent" />
          <UI.PriceDisplay amount={350000} kind="reduced" previous={365000} />
          <UI.PriceDisplay amount={360000} kind="sold" />
        </div>
        <div className="row">
          <UI.AreaChip name="Example Area" zip="000" count={4} href="#" />
          <UI.AreaChip name="Example District" />
        </div>
      </section>

      <section className="stack">
        <h3 className="heading-2">People and records</h3>
        <div className="card-grid">
          <UI.AgentCard name="Example Agent" title="Listing agent" handle="ExampleAgent" stats={[{ value: 4, label: 'Listings' }]} href="#" />
          <UI.PipelineCard status="under-contract" address="000 Example Lane" value={365000} client="Example Buyer" due="Oct 30, 2026" agent="Example Agent" />
          <UI.StatTile label="Active listings" value="12" meta="3 this week" trend="up" />
        </div>
        <UI.SalesLedger
          caption="Recent sales"
          columns={['no', 'date', 'property', 'agent', 'status', 'price']}
          rows={[
            { no: 'Sale No. 002', date: 'Oct 20, 2026', address: '000 Example Lane', area: 'Example Area', agent: 'Example Agent', status: 'sold', price: 360000 },
            { no: 'Sale No. 001', date: 'Oct 02, 2026', address: '000 Example Court', area: 'Example District', agent: 'Example Agent', status: 'leased', price: 1900 },
          ]}
          total={361900}
        />
        <UI.DataTable
          caption="Example table"
          rowKey={(r) => r.ref}
          rows={[
            { ref: 'JR-2026-00001', address: '000 Example Lane', status: 'pending-review' as const, price: 365000 },
            { ref: 'JR-2026-00002', address: '000 Example Court', status: 'active' as const, price: 189000 },
          ]}
          columns={[
            { key: 'ref', header: 'Reference', num: true, cell: (r) => r.ref },
            { key: 'address', header: 'Address', cell: (r) => r.address },
            { key: 'status', header: 'Status', cell: (r) => <UI.StatusPill status={r.status} /> },
            { key: 'price', header: 'Price', num: true, align: 'right', cell: (r) => '$' + r.price.toLocaleString('en-US') },
          ]}
        />
        <UI.DataSheet
          rows={[
            { label: 'Full legal name', value: 'Example Seller' },
            { label: 'How title is held', value: 'Sole owner' },
            { label: 'Parcel ID', value: '00-000-000', mono: true },
            { label: 'Mortgage', value: '' },
          ]}
        />
      </section>

      <section className="stack">
        <h3 className="heading-2">Visibility layers</h3>
        <UI.ClientPanel title="Your deal">
          <UI.Timeline
            label="Deal progress"
            steps={[
              { label: 'Active', state: 'done', date: 'Oct 14, 2026' },
              { label: 'Under Offer', state: 'done', date: 'Oct 18, 2026' },
              { label: 'Under Contract', state: 'current' },
              { label: 'Settlement', state: 'upcoming' },
              { label: 'Closed', state: 'upcoming' },
            ]}
          />
        </UI.ClientPanel>
        <div className="card-grid">
          <UI.ConfidentialPanel rows={[{ label: 'Lowest they’ll take', value: '$000,000', mono: true }, { label: 'Negotiation notes', value: 'Example note' }]} />
          <UI.ConfidentialPanel redacted rows={[{ label: 'Lowest they’ll take' }, { label: 'Negotiation notes' }]} />
        </div>
      </section>

      <section className="stack">
        <h3 className="heading-2">Feedback and empty states</h3>
        <div className="card-grid">
          <UI.ReferenceReceipt title="Showing requested" reference="JR-2026-00041" text="Example Agent will confirm your showing." />
          <UI.EmptyState title="No homes match these filters" text="Try a wider price range or another area." action={<UI.Button variant="secondary">Clear filters</UI.Button>} />
        </div>
        <UI.ProcessSteps
          steps={[
            { title: 'Request a valuation', text: 'Tell us about the property.' },
            { title: 'Agree the terms', text: 'Sign the listing contract.' },
            { title: 'Go live', text: 'The Owner reviews and publishes.' },
          ]}
        />
        <div className="row">
          <UI.Toast message="Listing published" tone="success" />
          <UI.Toast message="Couldn’t save. Try again." tone="danger" />
        </div>
        <UI.CardSkeletonGrid count={3} />
        <UI.Pagination page={3} pages={9} href={(n) => `?page=${n}`} />
        <UI.Breadcrumbs items={[{ label: 'Buy', href: '#' }, { label: 'Example Area', href: '#' }, { label: '000 Example Lane' }]} />
      </section>

      <section className="stack">
        <h3 className="heading-2">Documents</h3>
        <div style={{ maxWidth: '860px', background: 'var(--surface)', boxShadow: 'var(--shadow-sheet)' }}>
          <UI.DocumentHeader title="Residential Agreement of Sale" subtitle="Example Buyer and Example Seller" formNo="Form JR-PA-100" contact={[{ label: 'Office', value: 'Example office' }]} />
          <div className="grid-12" style={{ padding: 'var(--space-6)' }}>
            <div style={{ gridColumn: 'span 6' }}>
              <UI.SignatureLine label="Buyer" name="Example Buyer" date="October 21, 2026" />
            </div>
            <div style={{ gridColumn: 'span 6' }}>
              <UI.SignatureLine label="Seller" />
            </div>
          </div>
        </div>
      </section>

      <section className="stack">
        <h3 className="heading-2">Calendar</h3>
        <UI.WeekCalendar
          weekStart={new Date('2026-10-19T00:00:00Z')}
          today={new Date('2026-10-21T00:00:00Z')}
          events={[{ id: '1', start: new Date('2026-10-21T18:00:00Z'), title: '000 Example Lane', meta: 'Example Buyer' }]}
        />
      </section>

      <section className="stack">
        <h3 className="heading-2">Interactive</h3>
        <Interactive />
      </section>

      <section className="stack">
        <h3 className="heading-2">Icons</h3>
        <div className="row">
          {UI.Icon.names.map((n) => (
            <span key={n} className="row caption" style={{ gap: 'var(--space-1)', minWidth: '120px' }}>
              <UI.Icon name={n} size={24} />
              {n}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

export default async function StyleguidePage() {
  if (process.env.NODE_ENV === 'production' && !isStaff(await getActor())) notFound();
  return (
    <ToastProvider>
      <main id="main" className="container section stack-lg">
        <div className="stack">
          <UI.Logo />
          <h1 className="display-m">Styleguide</h1>
          <p className="body-l muted prose">Every component and primitive in the Paper and Portal themes. Content here is placeholder, to show layouts.</p>
        </div>

        <section className="sg-section">
          <h2>Colour</h2>
          <div className="sg-grid">
            {[...COLORS, ...SEMANTIC].map((c) => (
              <div key={c} className="sg-swatch">
                <div style={{ background: `var(--${c})` }} />
                <p>--{c}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="sg-section">
          <h2>Type</h2>
          <div className="stack">
            {TYPE.map((t) => (
              <div key={t} className="row" style={{ alignItems: 'baseline' }}>
                <span className="id muted" style={{ minWidth: '140px' }}>
                  {t}
                </span>
                <span className={t}>{t.startsWith('price') ? '$365,000' : t === 'signature' ? 'Example Signer' : 'Find your way home'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sg-section">
          <h2>Paper theme</h2>
          <div className="sg-theme" data-theme="light">
            <Gallery p="paper" />
          </div>
        </section>

        <section className="sg-section">
          <h2>Portal theme</h2>
          <div className="sg-theme" data-theme="dark">
            <Gallery p="portal" />
          </div>
        </section>
      </main>
    </ToastProvider>
  );
}
