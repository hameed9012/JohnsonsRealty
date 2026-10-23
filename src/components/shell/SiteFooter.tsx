import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import type { SiteSettings } from '@/server/settings';
import { PUBLIC_LINKS } from './links';

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack">
            <Logo tone="dark" subline={settings.brokerageSubline} />
            {settings.footerText ? <p className="body-s">{settings.footerText}</p> : null}
            {settings.officeLocation ? (
              <p className="body-s">
                <span className="sr-only">Office: </span>
                {settings.officeLocation}
              </p>
            ) : null}
          </div>
          <div>
            <h2>Property</h2>
            <ul>
              {PUBLIC_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Brokerage</h2>
            <ul>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/guides">Guides and news</Link></li>
              <li><Link href="/careers">Careers</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h2>Find us</h2>
            <ul>
              {settings.chirperHandle ? <li className="id">Chirper @{settings.chirperHandle.replace(/^@/, '')}</li> : null}
              {settings.discordInvite ? (
                <li>
                  <a href={settings.discordInvite} rel="noopener noreferrer" target="_blank">
                    Discord server
                  </a>
                </li>
              ) : null}
              <li><Link href="/account">Your account</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-base">
          <span>
            © {year} {settings.brokerageName}
            {settings.civopsLine ? ` · ${settings.civopsLine}` : ''}
          </span>
          <span className="row">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
