import { AccountNav } from '@/components/shell/SideNav';

const ITEMS = [
  { label: 'Dashboard', href: '/account', icon: 'home' as const, exact: true },
  { label: 'Saved homes', href: '/account/saved', icon: 'heart' as const },
  { label: 'Saved searches', href: '/account/searches', icon: 'search' as const },
  { label: 'Showings', href: '/account/showings', icon: 'calendar' as const },
  { label: 'My listings', href: '/account/listings', icon: 'key' as const },
  { label: 'My deal', href: '/account/deal', icon: 'document' as const },
  { label: 'Profile', href: '/account/profile', icon: 'user' as const },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container account-layout">
      <AccountNav items={ITEMS} />
      <div className="jr-min0">{children}</div>
    </div>
  );
}
