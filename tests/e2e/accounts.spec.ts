import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

function inAnHour(days = 1) {
  const d = new Date(Date.now() + days * 86400000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test('a client saves a home and a search, and is alerted when a match is approved', async ({ page, browser }) => {
  await signInAs(page, 'e2e-client', '/buy?area=fairview&beds=4');
  await page.getByRole('button', { name: 'Save this search' }).click();
  await expect(page.getByText('Search saved.')).toBeVisible();

  await page.goto('/buy?area=fairview');
  const card = page.locator('article.jr-card', { hasText: 'Example Open Home' });
  await card.getByRole('button', { name: 'Save home' }).click();
  await expect(card.getByRole('button', { name: 'Remove from saved homes' })).toBeVisible();
  await page.goto('/account/saved');
  await expect(page.getByRole('link', { name: 'Example Open Home' })).toBeVisible();

  await page.goto('/account/searches');
  await expect(page.getByRole('link', { name: 'Homes for sale in Fairview · 4+ beds' })).toBeVisible();

  const owner = await (await browser.newContext()).newPage();
  await signInAs(owner, 'e2e-owner', '/portal/review');
  await owner.getByRole('link', { name: /Example Pending Home/ }).click();
  await owner.getByRole('button', { name: 'Approve' }).click();
  await owner.getByRole('button', { name: 'Publish listing' }).click();
  await expect(owner.getByText('Nothing waiting for review')).toBeVisible();

  await page.goto('/account');
  await page.getByRole('button', { name: /Notifications, \d+ unread/ }).click();
  await expect(page.getByText('New listing for your saved search')).toBeVisible();
});

test('a client books, reschedules and cancels a showing', async ({ page }) => {
  await signInAs(page, 'e2e-client', '/property/example-open-home-00902');
  await page.getByLabel('Preferred time').fill(inAnHour(2));
  await page.getByRole('button', { name: 'Book a showing' }).click();
  await expect(page.getByText('Showing requested')).toBeVisible();
  const ref = (await page.locator('.jr-receipt-ref b').textContent())!.trim();

  await page.goto('/account/showings');
  const row = page.locator('.saved-list li', { hasText: ref });
  await expect(row.getByText('Requested', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Reschedule' }).click();
  await page.getByLabel('New time').fill(inAnHour(3));
  await page.getByRole('button', { name: 'Request this time' }).click();
  await expect(page.getByText('New time requested')).toBeVisible();

  await row.getByRole('button', { name: 'Cancel showing' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel showing' }).click();
  await expect(page.getByText('Showing cancelled')).toBeVisible();
  await expect(page.locator('.saved-list li', { hasText: ref }).getByText('Cancelled', { exact: true })).toBeVisible();
});

test('a buyer follows their deal and messages their agent', async ({ page, browser }) => {
  await signInAs(page, 'e2e-buyer', '/account');
  await expect(page.getByRole('heading', { name: /Your deal: Example Seed Home/ })).toBeVisible();
  await page.getByRole('link', { name: /Open my deal/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Example Seed Home' })).toBeVisible();
  await expect(page.getByText('You’re buying')).toBeVisible();
  await expect(page.getByText('Only you can see this').first()).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveText(/Under Offer/);
  await expect(page.getByText('Residential Agreement of Sale')).toBeVisible();
  await expect(page.getByText('Earnest Money Receipt')).toHaveCount(0); // not shared with the client

  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Write a message first.')).toBeVisible();
  await page.getByLabel('Message', { exact: true }).fill('Example question about the inspection date.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.thread-msg--me', { hasText: 'Example question about the inspection date.' })).toBeVisible();

  const agent = await (await browser.newContext()).newPage();
  await signInAs(agent, 'e2e-agent', '/portal');
  await agent.getByRole('button', { name: /Notifications/ }).click();
  await expect(agent.getByText('New message from Example Buyer')).toBeVisible();

  // Another client can't open the deal.
  const other = await (await browser.newContext()).newPage();
  await signInAs(other, 'e2e-client', page.url().replace(/^https?:\/\/[^/]+/, ''));
  await expect(other.getByText('We couldn’t find that page')).toBeVisible();
});

test('notification settings save', async ({ page }) => {
  await signInAs(page, 'e2e-client', '/account/profile');
  await page.locator('label.jr-toggle', { hasText: 'Messages from your agent' }).click();
  await page.getByRole('button', { name: 'Save notification settings' }).click();
  await expect(page.getByText('Notification settings saved')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: /Messages from your agent/ })).not.toBeChecked();
});
