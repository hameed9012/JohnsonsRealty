import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

const PAGES: [string, string | RegExp][] = [
  ['/', /Johnson/],
  ['/buy', 'Homes for sale'],
  ['/rent', 'Homes for rent'],
  ['/businesses', 'Businesses for sale'],
  ['/sell', 'What’s your property worth?'],
  ['/areas', 'Areas'],
  ['/areas/fairview', 'Fairview'],
  ['/sold', 'Sold'],
  ['/agents', 'Our agents'],
  ['/agents/example-agent', 'Example Agent'],
  ['/about', /Johnson/],
  ['/guides', 'Guides and news'],
  ['/careers', 'Work with us'],
  ['/contact', 'Get in touch'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
];

test('every public page renders with its heading and no horizontal scroll on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [path, heading] of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: heading }).first(), path).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
  const missing = await page.goto('/property/does-not-exist');
  expect(missing?.status()).toBe(404);
  await expect(page.getByText('We couldn’t find that page')).toBeVisible();
});

test('search filters live in the URL', async ({ page }) => {
  await page.goto('/buy?area=fairview&beds=3&sort=price-desc&view=list');
  await expect(page.getByLabel('Area')).toHaveValue('fairview');
  await expect(page.getByLabel('Bedrooms')).toHaveValue('3');
  await expect(page.getByLabel('Sort', { exact: true })).toHaveValue('price-desc');
  await expect(page.getByRole('link', { name: 'List', exact: true })).toHaveAttribute('aria-current', 'true');
});

test('a valuation request returns a reference number', async ({ page }) => {
  await signInAs(page, 'e2e-client', '/sell');
  await page.getByRole('button', { name: 'Request a valuation' }).click();
  await expect(page.getByText('Add the property’s address.')).toBeVisible();
  await page.getByLabel('Property address').fill('Example Road');
  await page.getByLabel('Best way to reach you').fill('Discord DM');
  await page.getByRole('button', { name: 'Request a valuation' }).click();
  await expect(page.getByText('Valuation requested')).toBeVisible();
  await expect(page.locator('.jr-receipt-ref b')).toHaveText(/^JR-\d{4}-\d{5}$/);
});

test('the Owner publishes a guide and a role, and a client applies', async ({ page, browser }) => {
  await signInAs(page, 'e2e-owner', '/portal/content/posts/new');
  await page.getByLabel('Title').fill('Example first-time buyer guide');
  await page.getByLabel('Article').fill('## Before you start\n\nExample text with a [link](/buy).');
  await page.locator('label.jr-toggle', { hasText: 'Published' }).click();
  await expect(page.getByRole('switch', { name: /Published/ })).toBeChecked();
  await page.getByRole('button', { name: 'Save article' }).click();
  await expect(page).toHaveURL(/\/portal\/content\/posts\/[0-9a-f-]{36}/);

  await page.goto('/portal/content/careers/new');
  await page.getByLabel('Role').fill('Example junior agent');
  await page.getByLabel('Summary').fill('Example summary of the role.');
  await page.getByRole('button', { name: 'Save role' }).click();
  await expect(page).toHaveURL(/\/portal\/content\/careers\/[0-9a-f-]{36}/);

  const client = await (await browser.newContext()).newPage();
  await client.goto('/guides');
  await client.getByRole('link', { name: 'Example first-time buyer guide' }).click();
  await expect(client.getByRole('heading', { name: 'Before you start' })).toBeVisible();

  await signInAs(client, 'e2e-client', '/careers');
  await client.getByRole('link', { name: 'Example junior agent' }).first().click();
  await client.getByLabel('Your experience').fill('Example experience.');
  await client.getByLabel('Why this role?').fill('Example reason.');
  await client.getByRole('button', { name: 'Send application' }).click();
  await expect(client.getByText('Application sent')).toBeVisible();

  await page.goto('/portal');
  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(page.getByText('Career application').first()).toBeVisible();
});
