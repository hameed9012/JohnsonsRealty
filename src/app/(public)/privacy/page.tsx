import type { Metadata } from 'next';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Privacy', alternates: { canonical: '/privacy' } };

// Roleplay-appropriate boilerplate. Johnson’s Realty is a fictional brokerage in a Roblox roleplay community.
export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <article className="container section prose stack-lg">
      <header className="stack">
        <span className="label label--brass">Legal</span>
        <h1 className="display-m">Privacy</h1>
      </header>
      <div className="body-l stack">
        <p>
          {s.brokerageName} is a roleplay business in a Roblox community. It is not a real brokerage and does not buy, sell or rent real property.
        </p>
        <h2 className="heading-2">What we store</h2>
        <p>
          When you sign in with Discord we store your Discord user ID, display name and avatar. You can add your Roblox username and Chirper handle. When you use the site we
          store what you do with it: saved homes and searches, showing requests, messages, listings you submit, and the forms you send.
        </p>
        <h2 className="heading-2">Who sees it</h2>
        <p>
          Our staff see what they need to help you. Listings you submit show only the contact details you choose. We never sell your information or share it outside the
          brokerage, and we never post to Discord on your behalf.
        </p>
        <h2 className="heading-2">Removing your data</h2>
        <p>Ask us through the contact page and we’ll delete your account and the records tied to it, except sales already recorded in the brokerage’s ledger.</p>
      </div>
    </article>
  );
}
