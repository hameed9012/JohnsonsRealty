import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { AreaChip } from '@/components/ui/AreaChip';
import { EmptyState } from '@/components/ui/blocks';
import { Mark } from '@/components/ui/Logo';
import { areaListingCounts, getAreas } from '@/server/queries/areas';
import { mediaSrc } from '@/server/queries/media';

export const metadata: Metadata = {
  title: 'Areas',
  description: 'Harrisburg, Swatara Township and Susquehanna Township: the neighbourhoods we list in, with what’s on the market.',
  alternates: { canonical: '/areas' },
};

export default async function AreasIndex() {
  const [all, counts] = await Promise.all([getAreas(), areaListingCounts()]);
  const towns = all.filter((a) => !a.parentId);
  const heroes = await Promise.all(towns.map((t) => mediaSrc(t.heroMediaId)));
  return (
    <div className="container section stack-lg">
      <header className="stack prose">
        <span className="label label--brass">Dauphin County</span>
        <h1 className="display-m">Areas</h1>
        <p className="body-l muted">Every listing sits in one of these neighbourhoods. Pick one to see what’s on the market and what’s sold.</p>
      </header>
      {towns.length === 0 ? (
        <EmptyState icon="area" title="No areas yet" text="Areas appear here once they’re set up." />
      ) : (
        <div className="town-grid">
          {towns.map((t, i) => {
            const kids = all.filter((a) => a.parentId === t.id);
            const n = (counts[t.id] ?? 0) + kids.reduce((s, k) => s + (counts[k.id] ?? 0), 0);
            return (
              <article key={t.id} className="town-card">
                <Link href={`/areas/${t.slug}`} className="town-media" tabIndex={-1} aria-hidden>
                  {heroes[i] ? <Image src={heroes[i]!} alt="" fill sizes="(max-width: 900px) 100vw, 33vw" className="photo-grade" /> : <Mark size={40} decorative />}
                </Link>
                <div className="stack town-body">
                  <h2 className="heading-2">
                    <Link href={`/areas/${t.slug}`}>{t.name}</Link>
                  </h2>
                  <p className="body-s muted">
                    <span className="figure">{n}</span> on the market
                  </p>
                  <div className="row">
                    {kids.map((k) => (
                      <AreaChip key={k.id} name={k.name} zip={k.postalCodes[0]} count={counts[k.id] ?? 0} href={`/areas/${k.slug}`} />
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
