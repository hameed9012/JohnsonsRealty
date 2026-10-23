import type { Metadata } from 'next';
import { ValuationForm } from '@/components/public/EnquiryForms';
import { ProcessSteps } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { SalesLedger } from '@/components/ui/SalesLedger';
import { SELLING_STEPS } from '@/lib/copy';
import { areaOptions, getAreas } from '@/server/queries/areas';
import { salesLedger } from '@/server/queries/sales';
import { getActor } from '@/server/session';

export const metadata: Metadata = {
  title: 'Sell with us',
  description: 'Request a free valuation of your home, land or business in Dauphin County, or list it yourself.',
  alternates: { canonical: '/sell' },
};

export default async function SellPage() {
  const [actor, areas, sales] = await Promise.all([getActor(), getAreas(), salesLedger({ purpose: 'sale' }, 5)]);
  return (
    <>
      <section className="cta-band">
        <div className="container cta-inner">
          <div className="stack prose">
            <span className="label hero-eyebrow">Sell</span>
            <h1 className="display-l">What’s your property worth?</h1>
            <p className="body-l">Tell us about it and an agent will suggest a price from recent sales nearby. No obligation.</p>
          </div>
        </div>
      </section>
      <div className="container section">
        <div className="split">
          <section className="panel stack" aria-labelledby="val-h">
            <h2 id="val-h" className="heading-2">
              Request a valuation
            </h2>
            <ValuationForm signedIn={!!actor} areas={areaOptions(areas).map((a) => ({ value: a.value, label: a.label }))} />
          </section>
          <aside className="stack-lg">
            <section className="stack">
              <h2 className="heading-2">Prefer to list it yourself?</h2>
              <p className="body muted">List your home, rental, land or business from your account. It carries a “Listed by Owner” label and our team reviews it before it goes live.</p>
              <div>
                <Button variant="secondary" href="/account/listings/new" withKey>
                  List your property
                </Button>
              </div>
            </section>
            {sales.length ? (
              <section className="stack">
                <h2 className="heading-2">Recent sales</h2>
                <SalesLedger rows={sales} columns={['no', 'date', 'property', 'price']} />
              </section>
            ) : null}
          </aside>
        </div>
      </div>
      <section className="container section stack-lg">
        <h2 className="heading-1">How selling works</h2>
        <ProcessSteps steps={SELLING_STEPS} />
      </section>
    </>
  );
}
