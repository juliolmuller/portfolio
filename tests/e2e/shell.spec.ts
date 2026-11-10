import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { waitForHydration } from './hydration';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

function locationPath(location: string | undefined): string {
  return new URL(location ?? '', 'http://localhost').pathname;
}

/**
 * Axe-core hangs inside WebKit's evaluate here; its rules are engine-agnostic.
 */
function skipAxeOnWebkit(browserName: string): void {
  test.skip(browserName === 'webkit', 'axe runs on Chromium projects');
}

test.describe('locale negotiation', () => {
  for (const [header, expected] of [
    ['pt-BR,pt;q=0.9,en;q=0.8', '/pt'],
    ['en-US,en;q=0.9', '/en'],
    ['fr-FR', '/en'],
  ] as const) {
    test(`Accept-Language "${header}" redirects to ${expected}`, async ({ request }) => {
      const response = await request.get('/', {
        headers: { 'Accept-Language': header },
        maxRedirects: 0,
      });

      expect(response.status()).toBe(307);
      expect(locationPath(response.headers()['location'])).toBe(expected);
    });
  }

  test('a saved preference wins over Accept-Language', async ({ request }) => {
    const response = await request.get('/', {
      headers: { 'Accept-Language': 'en-US', 'Cookie': 'NEXT_LOCALE=pt' },
      maxRedirects: 0,
    });

    expect(locationPath(response.headers()['location'])).toBe('/pt');
  });
});

test.describe('global 404', () => {
  test('anonymous admin paths are indistinguishable from random paths', async ({ request }) => {
    const random = await request.get('/definitely-not-here');
    const admin = await request.get('/admin');
    const upload = await request.post('/admin/api/upload');

    expect(random.status()).toBe(404);
    expect(admin.status()).toBe(404);
    expect(upload.status()).toBe(404);
    expect(await admin.text()).toBe(await random.text());
  });

  test('unknown localized paths return the localized 404', async ({ request }) => {
    const response = await request.get('/pt/nada-aqui');

    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('comando não encontrado');
  });
});

for (const locale of ['en', 'pt'] as const) {
  test.describe(`shell (${locale})`, () => {
    test('renders server-side with correct lang', async ({ request }) => {
      const response = await request.get(`/${locale}`);

      expect(response.status()).toBe(200);

      const html = await response.text();

      expect(html).toContain(`<html lang="${locale === 'pt' ? 'pt-BR' : 'en'}"`);
      expect(html).toContain('<h1');
      expect(html).toContain('href="#main"');
    });

    test('home sections follow the résumé-after-work order', async ({ request }) => {
      const response = await request.get(`/${locale}`);

      expect(response.status()).toBe(200);

      const html = await response.text();
      const ids = ['top', 'about', 'summary', 'stack', 'work', 'resume', 'contact', 'recommended'];
      const indexes = ids.map((id) => html.indexOf(`id="${id}"`));

      expect(indexes.every((index) => index >= 0)).toBe(true);
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    });

    test('has no axe violations', async ({ page, browserName }) => {
      skipAxeOnWebkit(browserName);
      await page.goto(`/${locale}`);

      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .exclude('[data-reveal=pending]')
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('has no axe violations with the mobile menu open', async ({ page, browserName }) => {
      skipAxeOnWebkit(browserName);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/${locale}`);
      await page.getByRole('button', { name: /menu/i }).click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible();
      // Contrast is sampled mid fade-in otherwise.
      await dialog.evaluate((el) =>
        Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
      );

      const results = await new AxeBuilder({ page })
        .withTags(AXE_TAGS)
        .exclude('[data-reveal=pending]')
        .analyze();

      expect(results.violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
    });
  });
}

test('language switch keeps the route and hash', async ({ page }) => {
  // Looping hero motion keeps WebKit's actionability check from settling.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en#top', { waitUntil: 'domcontentloaded' });
  // The switcher adds the hash once hydrated; an earlier click drops it.
  await waitForHydration(page);

  const menuButton = page.getByRole('button', { name: 'Open menu' });
  const inMenu = await menuButton.isVisible();

  if (inMenu) await menuButton.click();

  const switcher = inMenu
    ? page.getByRole('dialog').getByRole('group', { name: 'Language' })
    : page.getByRole('banner').getByRole('group', { name: 'Language' });

  await switcher.getByRole('link', { name: /PT/ }).click({ force: true });
  await expect(page).toHaveURL(/\/pt#top$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

  const cookies = await page.context().cookies();

  expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('pt');
});

test('long role summaries are server-rendered in full and expand on demand', async ({
  page,
  request,
}) => {
  const ending = 'rather than the exception';

  // Crawlers and no-JS visitors get the whole text in the HTML (D76).
  expect(await (await request.get('/en')).text()).toContain(ending);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en#experience');

  const role = page.locator('#experience li').first();
  const more = role.getByText('More', { exact: true });

  await expect(role.getByText(ending, { exact: false })).toBeHidden();
  await more.click();
  await expect(role.getByText(ending, { exact: false })).toBeVisible();
  await expect(more).toBeHidden();
  await role.getByText('Less', { exact: true }).click();
  await expect(role.getByText(ending, { exact: false })).toBeHidden();
});

test('motion toggle persists the paused state', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'domcontentloaded' });

  const toggle = page.getByRole('contentinfo').getByRole('button', { name: 'Pause animations' });

  await toggle.evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
  });
  await toggle.click({ force: true });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
});
