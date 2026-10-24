import { expect, test, type Page } from '@playwright/test';

// Runs after every other spec (its own project in playwright.config.ts): the import adds real listings.

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

test('the Owner previews and imports the legacy seller files', async ({ page }) => {
  await signInAs(page, 'e2e-owner', '/portal/settings/import');
  await expect(page.getByRole('heading', { level: 1, name: 'Import seller files' })).toBeVisible();
  const rows = page.getByRole('table', { name: 'Listings to import' }).locator('tbody tr');
  await expect(rows).toHaveCount(7);
  await expect(page.getByText('Two homes share 601 Cardinal Court').first()).toBeVisible();
  await expect(page.getByLabel('Sale price')).toHaveValue('795000');
  await expect(page.getByLabel('Sale date')).toHaveValue('2027-01-15');

  await page.getByRole('button', { name: 'Import 13 seller files' }).click();
  await expect(page.getByText('Imported 13 seller files.')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('Every seller file has been imported.')).toBeVisible();

  await page.goto('/portal/listings?q=Franklin');
  await expect(page.getByText('Needs photos')).toBeVisible();

  // Held listings stay off the public site; 6012 Estate Drive has its photos and is live.
  await page.goto('/buy');
  await expect(page.getByText('6012 Estate Drive').first()).toBeVisible();
  await expect(page.getByText('7063 Franklin Court')).toHaveCount(0);
});
