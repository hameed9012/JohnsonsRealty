import { expect, test, type Page } from '@playwright/test';

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

test('the seller file renders, then a document fills from the client file and is signed', async ({ page }) => {
  await signInAs(page, 'e2e-agent', '/portal/clients');
  await page.getByRole('link', { name: 'Example Seller' }).first().click();
  await page.getByRole('link', { name: 'Seller file' }).click();
  await expect(page.getByText('Example Seed Home').first()).toBeVisible();

  await page.goto('/portal/documents/new');
  await page.getByLabel('Form').selectOption({ label: 'Exclusive Right to Sell Listing Contract · JR-PA-050' });
  await page.getByRole('button', { name: 'Start document' }).click();
  await expect(page).toHaveURL(/\/portal\/documents\/[0-9a-f-]{36}$/);
  await expect(page.getByLabel('Seller(s)', { exact: true })).toHaveValue('');

  await page.getByRole('button', { name: 'Fill from client file' }).click();
  const dialog = page.getByRole('dialog', { name: 'Fill from client file' });
  await dialog.getByLabel('Seller or owner').selectOption({ label: 'Example Seller' });
  await dialog.getByLabel('Listing').selectOption({ label: 'Example Seed Home · Example Seller · JR-2000-00901' });
  await dialog.getByRole('button', { name: 'Fill the form' }).click();
  await expect(page.getByLabel('Seller(s)', { exact: true })).toHaveValue('Example Seller');
  await expect(page.getByLabel('Street Address')).toHaveValue('Example Seed Home');
  await expect(page.locator('.doc-screen').getByText('Three Hundred Thousand and 00/100 Dollars')).toBeVisible();

  await page.getByLabel('Seller signature', { exact: true }).fill('Example Seller');
  await page.getByLabel('Date signed, Seller', { exact: true }).fill('2026-10-20');
  await page.getByRole('button', { name: 'Mark as signed' }).click();
  await expect(page.getByText(/Still needs signing by: the agent/)).toBeVisible();

  await page.getByLabel('Example Agent, Real Estate Agent signature').fill('Example Agent');
  await page.getByLabel('Date signed, Example Agent, Real Estate Agent').fill('2026-10-20');
  await page.getByRole('button', { name: 'Mark as signed' }).click();
  await expect(page.getByText('Marked as signed').first()).toBeVisible();
  // Signed documents are locked for agents.
  await expect(page.getByRole('button', { name: 'Fill from client file' })).toHaveCount(0);
  await expect(page.locator('.doc-screen').getByText('Example Seller', { exact: true }).first()).toBeVisible();
});

test('a deal document is shared to the buyer’s account', async ({ page, browser }) => {
  await signInAs(page, 'e2e-agent', '/portal/deals');
  await page.getByRole('link', { name: /Example Seed Home/ }).first().click();
  await page.getByRole('link', { name: 'New document' }).click();
  await page.getByLabel('Form').selectOption({ label: 'Change to Agreement of Sale · JR-PA-110' });
  await page.getByRole('button', { name: 'Start document' }).click();
  await expect(page.getByLabel('Buyer(s)')).toHaveValue('Example Buyer');
  await expect(page.getByLabel('Agreement of Sale No.')).toHaveValue('AOS-2000-0001');
  await page.getByLabel('Type of Change').selectOption('Price change');
  await page.getByRole('switch', { name: /Share with the client/ }).check({ force: true });
  await expect(page.getByText('Shared to the client’s account')).toBeVisible();

  const buyer = await (await browser.newContext()).newPage();
  // A buyer with one deal lands straight on it.
  await signInAs(buyer, 'e2e-buyer', '/account/deal');
  await buyer.getByRole('link', { name: 'Change to Agreement of Sale' }).click();
  await expect(buyer.getByRole('heading', { name: 'Change to Agreement of Sale' })).toBeVisible();
  await expect(buyer.locator('.doc-v', { hasText: 'Price change' })).toBeVisible();
  await expect(buyer.getByText('Only you can see this')).toBeVisible();
});
