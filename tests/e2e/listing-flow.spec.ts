import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PHOTOS = ['in-game-exterior-sample.jpg', 'in-game-interior-sample.jpg', 'in-game-exterior-sample.jpg'].map((f) => path.resolve('design-system/assets/Imagery', f));
const ADDRESS = `Example Lane ${Date.now().toString().slice(-5)}`;

async function signInAs(page: Page, user: string, next: string) {
  await page.goto(`/api/test-auth?user=${user}&next=${encodeURIComponent(next)}`);
}

async function nextStep(page: Page, heading: string) {
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

test('agent submits a listing with 3 photos, the Owner approves, and it goes public', async ({ page, browser }) => {
  // --- Agent: create and fill the listing ---
  await signInAs(page, 'e2e-agent', '/portal/listings/new');
  await page.getByRole('button', { name: 'Start a listing' }).click();
  await expect(page.getByRole('heading', { name: 'Property', exact: true })).toBeVisible();

  await page.getByLabel('Street address').fill(ADDRESS);
  await page.locator('label.jr-featurechip', { hasText: 'Fairview' }).click();
  await page.getByLabel('Bedrooms').fill('3');
  await page.getByLabel('Bathrooms').fill('2');
  await page.getByLabel('Living space (sq ft)').fill('1850');
  await page.getByLabel('Description', { exact: true }).fill('Example three bedroom home with a garden and a garage, used by the end-to-end test.');
  await nextStep(page, 'Price and terms');

  await page.getByLabel('Asking price ($)').fill('abc');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByText('Enter a price in dollars, like 365000.')).toBeVisible();
  await page.getByLabel('Asking price ($)').fill('365000');
  await nextStep(page, 'Photos');

  await expect(page.getByText('Add at least 3 photos. You have 0.')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(PHOTOS.slice(0, 2));
  await expect(page.getByText('Add at least 3 photos. You have 2.')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(PHOTOS.slice(2));
  await expect(page.getByText(/^3 photos\./)).toBeVisible();
  const alts = page.getByLabel('Describe the photo');
  for (let i = 0; i < 3; i++) await alts.nth(i).fill(`Example photo ${i + 1}`);
  await nextStep(page, 'Seller');

  await page.getByLabel('Client name').fill('Example Seller');
  await page.getByLabel('Full legal name').fill('Example Seller');
  await page.getByLabel('Lowest they’ll take ($)').fill('350000');
  await nextStep(page, 'Review and submit');

  await expect(page.getByText('Everything’s in place.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByText('Listing submitted for review')).toBeVisible();
  const ref = (await page.locator('.jr-receipt-ref b').textContent())!.trim();
  expect(ref).toMatch(/^JR-\d{4}-\d{5}$/);

  // --- Owner: review queue and approve ---
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await signInAs(owner, 'e2e-owner', '/portal/review');
  await expect(owner.getByRole('link', { name: new RegExp(ADDRESS) })).toBeVisible();
  await expect(owner.getByRole('button', { name: /Notifications, \d+ unread/ })).toBeVisible();
  await owner.getByRole('link', { name: new RegExp(ADDRESS) }).click();
  await expect(owner.getByRole('heading', { name: 'Public preview' })).toBeVisible();
  await expect(owner.getByText('$350,000')).toBeVisible(); // confidential bottom line, visible to the Owner
  await owner.getByRole('button', { name: 'Approve' }).click();
  await owner.getByRole('button', { name: 'Publish listing' }).click();
  await expect(owner.getByText('Nothing waiting for review')).toBeVisible();

  // --- Public: visible to a signed-out visitor, without confidential data ---
  const visitorCtx = await browser.newContext();
  const visitor = await visitorCtx.newPage();
  await visitor.goto('/');
  await visitor.getByRole('link', { name: ADDRESS }).first().click();
  await expect(visitor.getByRole('heading', { level: 1, name: ADDRESS })).toBeVisible();
  await expect(visitor.getByText('Just Listed').first()).toBeVisible();
  await expect(visitor.getByText('$365,000').first()).toBeVisible();
  await expect(visitor.getByText('350,000')).toHaveCount(0);
  await expect(visitor.getByText('Example Seller')).toHaveCount(0);
  await expect(visitor.getByRole('link', { name: 'Sign in to book' })).toBeVisible();

  // --- Agent was notified ---
  await page.goto('/portal');
  await page.getByRole('button', { name: /Notifications/ }).click();
  await expect(page.getByText('Listing approved').first()).toBeVisible();

  await ownerCtx.close();
  await visitorCtx.close();
});

test('a property owner lists a rental, the Owner requests changes, and they resubmit', async ({ page, browser }) => {
  const addr = `Example Court ${Date.now().toString().slice(-5)}`;
  await signInAs(page, 'e2e-client', '/account/listings/new');
  await page.getByRole('button', { name: 'Start my listing' }).click();
  await page.getByText('Rental home', { exact: true }).click();
  await page.getByLabel('Street address').fill(addr);
  await page.locator('label.jr-featurechip', { hasText: 'Springfield' }).click();
  await page.getByLabel('Bedrooms').fill('2');
  await page.getByLabel('Bathrooms').fill('1');
  await page.getByLabel('Description', { exact: true }).fill('Example two bedroom rental near the park, used by the end-to-end test.');
  await nextStep(page, 'Price');
  await page.getByLabel('Monthly rent ($)').fill('1900');
  await page.getByLabel('Available from').fill('2030-11-01');
  await page.getByLabel('Lease length (months)').fill('12');
  await page.getByLabel('Security deposit ($)').fill('1900');
  await nextStep(page, 'Photos');
  await page.locator('input[type=file]').setInputFiles(PHOTOS);
  await expect(page.getByText(/^3 photos\./)).toBeVisible();
  const alts = page.getByLabel('Describe the photo');
  for (let i = 0; i < 3; i++) await alts.nth(i).fill(`Example room ${i + 1}`);
  await nextStep(page, 'Your details');
  await page.getByLabel('Your name for paperwork').fill('Example Client');
  await nextStep(page, 'Review and submit');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByText('Your listing is with our team')).toBeVisible();

  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await signInAs(owner, 'e2e-owner', '/portal/review');
  await owner.getByRole('link', { name: new RegExp(addr) }).click();
  await owner.getByRole('button', { name: 'Request changes' }).click();
  await owner.getByRole('button', { name: 'Send notes' }).click();
  await expect(owner.getByText('Add a note so the submitter knows what to change.')).toBeVisible();
  await owner.getByLabel('Notes for the submitter').fill('Add a photo of the kitchen.');
  await owner.getByRole('button', { name: 'Send notes' }).click();
  await expect(owner.getByText('Nothing waiting for review')).toBeVisible();

  await page.goto('/account/listings');
  await expect(page.getByText('Notes from the reviewer: Add a photo of the kitchen.')).toBeVisible();
  await page.getByRole('link', { name: new RegExp(addr) }).click();
  await page.getByRole('link', { name: 'Make changes' }).click();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByText('Resubmitted')).toBeVisible();

  await owner.goto('/portal/review');
  await owner.getByRole('link', { name: new RegExp(addr) }).click();
  await expect(owner.getByText('Changes since round 1')).toBeVisible();
  await owner.getByRole('button', { name: 'Approve' }).click();
  await owner.getByRole('button', { name: 'Publish listing' }).click();
  await expect(owner.getByText('Nothing waiting for review')).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto('/');
  await visitor.getByRole('link', { name: addr }).first().click();
  await expect(visitor.getByText('Listed by Owner').first()).toBeVisible();
  await expect(visitor.getByText('For Lease').first()).toBeVisible();
  await expect(visitor.getByText('$1,900').first()).toBeVisible();
  await ownerCtx.close();
});
