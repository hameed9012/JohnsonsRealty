import { expect, test, type Page } from '@playwright/test';

// Runs after every other spec (its own project in playwright.config.ts): the import adds real listings.

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

test('an agent starts a listing from a seller file, once', async ({ page }) => {
  await signInAs(page, 'e2e-agent', '/portal/listings/new');
  const picker = page.getByRole('region', { name: 'Start from a seller file' });
  await expect(picker.getByText('7063 Franklin Court', { exact: true })).toBeVisible();
  await expect(picker.getByText('Sold')).toHaveCount(0); // agents don't get the sold Castellano house
  await picker.getByRole('button', { name: 'Use this for 7063 Franklin Court' }).click();
  await expect(page).toHaveURL(/\/portal\/listings\/[0-9a-f-]{36}\/edit/);
  await expect(page.getByLabel('Street address')).toHaveValue('7063 Franklin Court');
  await page.goto('/portal/listings/new');
  await expect(page.getByText('7063 Franklin Court', { exact: true })).toHaveCount(0); // no duplicates
});

test('the Owner imports the rest of the seller files, then the photos', async ({ page }) => {
  await signInAs(page, 'e2e-owner', '/portal/settings/import');
  await expect(page.getByRole('heading', { level: 1, name: 'Import seller files' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Listings to import' }).locator('tbody tr')).toHaveCount(8);
  await expect(page.getByText('Two homes share 601 Cardinal Court').first()).toBeVisible();
  await expect(page.getByLabel('Sale price')).toHaveValue('795000');
  await expect(page.getByLabel('Sale date')).toHaveValue('2027-01-15');

  // Porter was started from the seller file above, so 13 are left.
  await page.getByRole('button', { name: 'Import 13 seller files' }).click();
  await expect(page.getByText('Imported 13 seller files.')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Every seller file has been imported.')).toBeVisible();

  await page.getByRole('button', { name: 'Upload 6012 Estate Drive’s photos' }).click();
  await expect(page.getByText('Photos added to 6012 Estate Drive.')).toBeVisible({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Upload Building 8061’s photos' }).click();
  await expect(page.getByText('Photos added to Building 8061.')).toBeVisible({ timeout: 90_000 });

  await page.goto('/portal/listings?q=Lakeway');
  await expect(page.getByText('Needs photos')).toBeVisible();

  // Held listings stay off the public site; 6012 Estate Drive has its photos and is live.
  await page.goto('/buy');
  await expect(page.getByText('6012 Estate Drive').first()).toBeVisible();
  await expect(page.getByText('8095 Lakeway Street')).toHaveCount(0);
});
