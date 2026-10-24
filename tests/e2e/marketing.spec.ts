import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

test('the studio fills a brochure from a listing, exports it, and drafts a Chirper post', async ({ page }) => {
  await signInAs(page, 'e2e-agent', '/portal/listings?q=Example Open Home');
  await page.getByRole('link', { name: 'Example Open Home' }).click();
  await page.getByRole('link', { name: 'Marketing', exact: true }).click();
  await expect(page.getByLabel('Address')).toHaveValue('Example Open Home');
  await expect(page.locator('.studio-scaler .sb-addr')).toHaveText('Example Open Home');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save as image' }).click();
  expect((await download).suggestedFilename()).toMatch(/^example-open-home-brochure\.png$/);

  const post = page.getByLabel('Post', { exact: true });
  await expect(post).toHaveValue(/Example Open Home/);
  await expect(post).toHaveValue(/\/property\//);
  await page.getByLabel('Post type').selectOption('open');
  await page.getByLabel('When').fill('Saturday 2–4 pm');
  await expect(post).toHaveValue(/^Open house · Saturday 2–4 pm: Example Open Home/);

  await expect(page.getByLabel('Just Listed post', { exact: true })).toHaveValue(/^🏡 Just Listed: Example Open Home/);
  const market = page.getByLabel('Marketplace post', { exact: true });
  await expect(market).toHaveValue(/^Address: Example Open Home/);
  await expect(market).toHaveValue(/Private showings by appointment\./);
  await expect(market).toHaveValue(/— Example Agent, Johnson’s Realty/);

  await page.getByText('Business card · back', { exact: true }).click();
  await expect(page.locator('.studio-scaler .sb-card-name')).toHaveText('Example Agent');
});

test('staff place a map pin, and it shows on the property page and the Buy map', async ({ page }) => {
  await signInAs(page, 'e2e-owner', '/portal/listings?q=Example Open Home');
  await page.getByRole('link', { name: 'Example Open Home' }).click();
  await page.locator('.map-pick .map-frame').click({ position: { x: 120, y: 60 } });
  await page.getByRole('button', { name: 'Save pin' }).click();
  await expect(page.getByText('Pin placed')).toBeVisible();

  await page.getByRole('link', { name: 'View public page' }).click();
  await expect(page.getByRole('heading', { name: 'On the map' })).toBeVisible();
  await expect(page.locator('.pmap figcaption')).toContainText('Example Open Home');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download brochure' }).click();
  expect((await download).suggestedFilename()).toBe('example-open-home-brochure.png');

  await page.goto('/buy');
  await page.getByRole('link', { name: 'Map', exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
  // A hand-placed listing gets its own circle; choosing it lists the listing.
  await page.getByRole('button', { name: /1 listing available in Example Open Home/ }).click();
  await expect(page.locator('.pmap-side').getByRole('link', { name: 'Example Open Home' })).toBeVisible();
});

test('listings show at their postal zone on the map, and the map PNG renders', async ({ page }) => {
  await page.goto('/buy?view=map');
  await page.getByRole('button', { name: '1 listing under offer in Whispering Pines (Postal 601)' }).click();
  await expect(page.locator('.pmap-side').getByRole('link', { name: 'Example Seed Home' })).toBeVisible();

  await page.goto('/property/example-seed-home-00901');
  await expect(page.locator('.pmap figcaption')).toContainText('Whispering Pines (Postal 601)');

  const res = await page.request.get('/api/map.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  expect((await res.body()).length).toBeGreaterThan(50_000);
});
