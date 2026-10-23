import type { Metadata, Viewport } from 'next';
import '@/styles/tokens.css';
import '@/styles/type-tokens.css';
import '@/styles/bundle.css';
import '@/styles/app.css';
import { fontVariables } from './fonts';
import { siteUrl } from '@/lib/discord';
import { colorToken } from '@/lib/tokens';
import { getSettings } from '@/server/settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const name = s?.brokerageName ?? 'Johnson’s Realty';
  return {
    metadataBase: new URL(siteUrl('/')),
    title: { default: name, template: `%s · ${name}` },
    description: s?.tagline ?? undefined,
    openGraph: { siteName: name, type: 'website' },
  };
}

export const viewport: Viewport = {
  themeColor: colorToken('green-900'),
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
