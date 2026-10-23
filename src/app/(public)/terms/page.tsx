import type { Metadata } from 'next';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Terms', alternates: { canonical: '/terms' } };

// Roleplay-appropriate boilerplate.
export default async function TermsPage() {
  const s = await getSettings();
  return (
    <article className="container section prose stack-lg">
      <header className="stack">
        <span className="label label--brass">Legal</span>
        <h1 className="display-m">Terms</h1>
      </header>
      <div className="body-l stack">
        <p>
          {s.brokerageName} operates inside a Roblox roleplay community{s.civopsLine ? ` (${s.civopsLine})` : ''}. Every property, price, person and document on this site is
          part of that roleplay. Nothing here is an offer of real property, a real contract or financial advice.
        </p>
        <h2 className="heading-2">Using the site</h2>
        <p>Be honest in what you submit. Listings are reviewed before they go live and we can decline, edit or remove any listing or account that breaks the community’s rules.</p>
        <h2 className="heading-2">Photos and content</h2>
        <p>Only upload in-game screenshots you took yourself. Don’t upload photos of real homes or real people, or anything that copies a real company’s name or brand.</p>
        <h2 className="heading-2">Changes</h2>
        <p>We may update these terms as the community’s rules change. The current version is always on this page.</p>
      </div>
    </article>
  );
}
