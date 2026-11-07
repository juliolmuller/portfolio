import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { signIn } from './admin-helpers';

// No AI keys are set in the e2e server, so online search reports "unavailable"
// and the manual paths must keep working (successful imports are unit-tested:
// the fetcher refuses localhost by design).
test.describe('admin logo search', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'admin flows run on Chromium');

  test('searches only on typing, degrades politely, and saves without a logo', async ({ page }) => {
    const searches: string[] = [];

    page.on('request', (request) => {
      if (request.url().includes('/admin/api/logo-search')) searches.push(request.postData() ?? '');
    });

    await signIn(page);
    await page.goto('/admin/technologies/new');

    const combobox = page.getByRole('combobox', { name: 'Find a logo' });

    await combobox.focus();
    await combobox.blur();
    await page.getByLabel('Name', { exact: true }).first().fill('Bun');
    await page.waitForTimeout(800);
    expect(searches).toHaveLength(0);

    await combobox.pressSequentially('Bun', { delay: 30 });
    await expect(page.getByText('Online search is unavailable right now')).toBeVisible();
    expect(searches).toHaveLength(1);

    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    await combobox.press('End');
    await combobox.press('Enter');
    await page.getByLabel('SVG URL').fill('http://127.0.0.1/x.svg');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByText('Only https URLs')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);

    await page.getByRole('button', { name: 'Save and publish' }).click();
    await expect(page).toHaveURL(/\/admin\/technologies\/[0-9a-f-]{36}$/);
  });

  test('anonymous requests get the global 404', async ({ request }) => {
    const response = await request.post('/admin/api/logo-search', { data: { query: 'Bun' } });

    expect(response.status()).toBe(404);
  });
});
