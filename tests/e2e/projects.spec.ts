import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

function skipAxeOnWebkit(browserName: string): void {
  test.skip(browserName === 'webkit', 'axe runs on Chromium projects');
}

test.describe('projects', () => {
  test('index lists visible projects and hides scratch-pad', async ({ request }) => {
    const response = await request.get('/en/projects');

    expect(response.status()).toBe(200);

    const html = await response.text();

    expect(html).toContain('Orbit Dashboard');
    expect(html).toContain('Pocket Ledger');
    expect(html).not.toContain('scratch-pad');
    expect(html).toContain('kind=web');
  });

  test('kind filter is a crawlable link', async ({ request }) => {
    const response = await request.get('/en/projects?kind=web');

    expect(response.status()).toBe(200);

    const html = await response.text();

    expect(html).toContain('Orbit Dashboard');
    expect(html).not.toContain('Pocket Ledger');
    expect(html).toMatch(/noindex/i);
  });

  test('detail page, previous slug and missing slug', async ({ request }) => {
    const page = await request.get('/en/projects/orbit-dashboard');

    expect(page.status()).toBe(200);
    expect(await page.text()).toContain('Orbit Dashboard');

    const moved = await request.get('/en/projects/paybridge', {
      maxRedirects: 0,
    });

    expect(moved.status()).toBe(308);
    expect(moved.headers()['location']).toMatch(/\/en\/projects\/pay-bridge$/);

    const missing = await request.get('/en/projects/nope');

    expect(missing.status()).toBe(404);
  });

  test('detail page lists the project skills', async ({ page, request }) => {
    await page.goto('/en/projects/orbit-dashboard');

    await expect(page.getByRole('heading', { level: 2, name: 'Skills' })).toBeVisible();
    await expect(
      page
        .locator('section', { has: page.getByRole('heading', { level: 2, name: 'Skills' }) })
        .getByRole('listitem'),
    ).toHaveText(['TypeScript', 'React', 'Next.js', 'PostgreSQL', 'Redis']);

    const pt = await request.get('/pt/projects/orbit-dashboard');

    expect(await pt.text()).toContain('Habilidades');
  });

  test('resume redirects to the locale PDF', async ({ request }) => {
    const response = await request.get('/en/resume', { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toMatch(/\.pdf/);
  });

  test('accessibility statement renders', async ({ request }) => {
    const response = await request.get('/pt/accessibility');

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Declaração de acessibilidade');
  });
});

for (const path of ['/en/projects', '/en/projects/orbit-dashboard', '/en/accessibility'] as const) {
  test(`axe ${path}`, async ({ page, browserName }) => {
    skipAxeOnWebkit(browserName);
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .exclude('[data-reveal=pending]')
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('lightbox has no axe violations when open', async ({ page, browserName }, testInfo) => {
  skipAxeOnWebkit(browserName);
  test.skip(testInfo.project.name === 'mobile', 'axe hangs inside the dialog on a phone viewport');
  await page.goto('/en/projects/orbit-dashboard');
  await page.getByRole('button', { name: /open image 1 of/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('[data-reveal=pending]')
    .analyze();

  expect(results.violations).toEqual([]);
});
