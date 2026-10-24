import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

/** Serious and critical WCAG 2.x A/AA issues fail the test; the report lists each rule and where it hit. */
async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Off-screen copies used only for PNG export and print; aria-hidden and inert.
    .exclude('.doc-render')
    .analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(report, `${path}\n${report.join('\n')}`).toEqual([]);
}

async function noSideScroll(page: Page, path: string) {
  await page.goto(path);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, path).toBeLessThanOrEqual(0);
}

const PUBLIC = ['/', '/buy', '/buy?view=map', '/rent', '/businesses', '/sell', '/areas', '/sold', '/agents', '/about', '/guides', '/careers', '/contact', '/property/example-seed-home-00901'];
const PORTAL = ['/portal', '/portal/listings', '/portal/review', '/portal/clients', '/portal/deals', '/portal/documents', '/portal/documents/new', '/portal/studio', '/portal/showings', '/portal/inbox', '/portal/sales', '/portal/commission', '/portal/team', '/portal/activity', '/portal/settings', '/portal/settings/discord', '/portal/settings/discord/preview', '/portal/announcements'];

test('public pages pass the automated accessibility audit', async ({ page }) => {
  for (const p of PUBLIC) await audit(page, p);
});

test('client account pages pass the automated accessibility audit', async ({ page }) => {
  await signInAs(page, 'e2e-buyer', '/account');
  for (const p of ['/account', '/account/deal', '/account/saved', '/account/showings', '/account/profile']) await audit(page, p);
});

test('portal pages pass the automated accessibility audit', async ({ page }) => {
  test.setTimeout(240_000);
  await signInAs(page, 'e2e-owner', '/portal');
  for (const p of PORTAL) await audit(page, p);
  // A document, a listing with the map picker, and the studio with a listing loaded.
  await page.goto('/portal/documents');
  await page.locator('table a').first().click();
  await audit(page, new URL(page.url()).pathname);
  await page.goto('/portal/listings?q=Example Open Home');
  await page.getByRole('link', { name: 'Example Open Home' }).click();
  const listing = new URL(page.url()).pathname;
  await audit(page, listing);
  await audit(page, `/portal/studio?listing=${listing.split('/').pop()}`);
});

test('portal and account pages fit a phone without sideways scrolling', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await signInAs(page, 'e2e-owner', '/portal');
  for (const p of PORTAL) await noSideScroll(page, p);
  await signInAs(page, 'e2e-buyer', '/account');
  for (const p of ['/account', '/account/deal', '/account/showings']) await noSideScroll(page, p);
});
