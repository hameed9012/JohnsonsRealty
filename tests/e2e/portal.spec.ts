import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

function local(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  d.setSeconds(0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

test('an agent opens a client file, runs a deal and records the sale', async ({ page }) => {
  await signInAs(page, 'e2e-agent', '/portal/clients/new');
  await page.getByLabel('Client name').fill('Example Portal Buyer');
  await page.getByLabel('Full legal name').fill('Example Portal Buyer');
  await page.getByLabel('Motivation').fill('Example confidential motivation.');
  await page.getByRole('button', { name: 'Save client file' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Example Portal Buyer' })).toBeVisible();
  await expect(page.getByText('Example confidential motivation.')).toBeVisible();

  await page.goto('/portal/listings?q=Example Open Home');
  await page.getByRole('link', { name: 'Example Open Home' }).click();
  await page.getByLabel('Asking price ($)').fill('275000');
  await page.getByRole('button', { name: 'Change price' }).click();
  await expect(page.getByText('Price updated')).toBeVisible();

  await page.getByLabel('Client').selectOption({ label: 'Example Portal Buyer' });
  await page.getByRole('button', { name: 'Open deal' }).click();
  await expect(page).toHaveURL(/\/portal\/deals\/[0-9a-f-]{36}/);

  await page.getByLabel('Move deal to').selectOption('under_offer');
  await page.getByRole('button', { name: 'Move deal' }).click();
  await expect(page.getByText('Moved to Under Offer')).toBeVisible();

  const offer = page.locator('form').filter({ has: page.getByRole('button', { name: 'Log offer' }) });
  await offer.getByLabel('Amount ($)').fill('270000');
  await offer.getByLabel('From').selectOption('buyer');
  await page.getByRole('button', { name: 'Log offer' }).click();
  await expect(page.getByText('$270,000')).toBeVisible();

  await page.getByLabel('Sale price ($)').fill('272000');
  await page.locator('#record-sale').getByLabel('Amount ($)').fill('6800');
  await page.getByRole('button', { name: 'Record sale' }).click();
  await expect(page.getByText(/Sale No\. \d{3} recorded/)).toBeVisible();

  await page.goto('/portal/commission');
  await expect(page.getByText('$6,800').first()).toBeVisible();
  await page.goto('/sold');
  await expect(page.getByText('Example Open Home')).toBeVisible();
  await expect(page.getByText('$272,000').first()).toBeVisible();
  // The row carries a brochure thumbnail with the listing's cover photo.
  const thumb = page.locator('tr', { hasText: 'Example Open Home' }).locator('.bthumb');
  await expect(thumb.locator('img')).toHaveJSProperty('complete', true);
  await expect(thumb).toContainText('Sold');
  // Commission never reaches the public ledger.
  await expect(page.getByText('$6,800')).toHaveCount(0);
});

test('the seller file is generated from the database', async ({ page }) => {
  await signInAs(page, 'e2e-agent', '/portal/clients');
  await page.getByRole('link', { name: 'Example Seller' }).first().click();
  await page.getByRole('link', { name: 'Seller file' }).click();
  await expect(page.getByRole('heading', { name: 'Seller file' })).toBeVisible();
  await expect(page.getByText('At a glance')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();

  // Editing from the seller file opens the listing's Seller step, and Done comes back here.
  await page.getByRole('link', { name: 'Edit seller file' }).click();
  await expect(page.getByRole('heading', { name: 'Seller', exact: true })).toBeVisible();
  await page.getByLabel('Reason for selling').fill('Example reason edited from the seller file');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Seller file' })).toBeVisible();
  await expect(page.getByText('Example reason edited from the seller file')).toBeVisible();
});

test('an agent confirms a showing and the client is told', async ({ page, browser }) => {
  const client = await (await browser.newContext()).newPage();
  await signInAs(client, 'e2e-client', '/property/example-lane-fairview-00001');
  // The seeded Example Seed Home is under offer, so book on the e2e listing that is still on the market.
  await client.goto('/buy');
  const first = client.locator('article.jr-card h3 a').first();
  await first.click();
  const when = local(2);
  await client.getByLabel('Preferred time').fill(when);
  await client.getByRole('button', { name: 'Book a showing' }).click();
  const ref = (await client.locator('.jr-receipt-ref b').textContent())!.trim();

  await signInAs(page, 'e2e-owner', `/portal/showings?view=list&week=${new Date(when).toISOString().slice(0, 10)}`);
  const row = page.locator('.saved-list li', { hasText: ref });
  await row.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm showing' }).click();
  await expect(page.getByText('Showing confirmed').first()).toBeVisible();

  await client.goto('/account/showings');
  await expect(client.locator('.saved-list li', { hasText: ref }).getByText('Confirmed', { exact: true })).toBeVisible();
});

test('the inbox assigns and replies, and the sender hears back', async ({ page, browser }) => {
  const client = await (await browser.newContext()).newPage();
  await signInAs(client, 'e2e-client', '/contact');
  await client.getByLabel('What’s it about?').selectOption('Buying');
  await client.getByLabel('Your message').fill('Example question for the inbox test.');
  await client.getByRole('button', { name: 'Send message' }).click();
  const ref = (await client.locator('.jr-receipt-ref b').textContent())!.trim();

  await signInAs(page, 'e2e-owner', '/portal/inbox');
  await page.getByRole('link', { name: ref }).click();
  await page.getByLabel('Assigned to').selectOption({ label: 'Example Agent' });
  await expect(page.getByText('Assigned').first()).toBeVisible();
  await page.getByLabel('Reply', { exact: true }).fill('Example reply from the brokerage.');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.locator('.thread-msg', { hasText: 'Example reply from the brokerage.' })).toBeVisible();

  await client.goto('/account');
  await client.getByRole('button', { name: /Notifications/ }).click();
  await expect(client.getByText(`Reply about ${ref}`)).toBeVisible();
});

test('the Owner invites an Admin with a single-use link', async ({ page, browser }) => {
  await signInAs(page, 'e2e-owner', '/portal/team');
  await page.getByLabel('Role', { exact: true }).selectOption('admin');
  await page.getByLabel('Who it’s for (optional)').fill('Example co-owner');
  await page.getByRole('button', { name: 'Create invite link' }).click();
  const link = (await page.locator('.invite-link').textContent())!.trim();
  const path = new URL(link).pathname;

  const invitee = await (await browser.newContext()).newPage();
  await signInAs(invitee, 'e2e-buyer', path);
  await invitee.getByRole('button', { name: 'Join the team' }).click();
  await expect(invitee).toHaveURL(/\/portal$/);
  await expect(invitee.getByRole('link', { name: 'Review queue' })).toBeVisible();

  const again = await (await browser.newContext()).newPage();
  await signInAs(again, 'e2e-client', path);
  await expect(again.getByText('This invite has expired or has been used')).toBeVisible();

  await page.goto('/portal/activity?q=joined');
  await expect(page.getByText('Example Buyer joined as admin')).toBeVisible();
});

test('the Owner edits a live listing in full and the public page updates', async ({ page }) => {
  await signInAs(page, 'e2e-owner', '/portal/listings?q=Example Open Home');
  await page.getByRole('link', { name: 'Example Open Home' }).click();
  await page.getByRole('link', { name: 'Edit everything' }).click();
  await expect(page.getByText('Changes save straight to the site')).toBeVisible();
  await page.getByLabel('Description', { exact: true }).fill('Example description edited on the live listing by the end-to-end test.');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Price and terms', exact: true })).toBeVisible();
  await page.goto('/portal/listings?q=Example Open Home');
  await page.getByRole('link', { name: 'Example Open Home' }).click();
  await page.getByRole('link', { name: 'View public page' }).click();
  await expect(page.getByText('Example description edited on the live listing').first()).toBeVisible();
});
