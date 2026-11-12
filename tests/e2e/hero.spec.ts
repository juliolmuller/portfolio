import { expect, test } from '@playwright/test';

const NAME = 'Julio L. Muller';

test.beforeEach(async ({ page }) => {
  // Looping hero motion keeps WebKit's actionability check from settling.
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('hero', () => {
  test('the one H1 is the name, in the fixture title font', async ({ page }) => {
    await page.goto('/en');

    const h1 = page.getByRole('heading', { level: 1 });

    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(NAME);
    await expect(h1).toHaveCSS('font-family', /Kaushan Script/);
    await expect(page.locator('#top')).not.toContainText('Résumé (PDF)');
    await expect(page.locator('#top')).not.toContainText('Open the terminal');
    await expect(page.locator('#top')).not.toContainText('Now:');
  });

  for (const width of [320, 375, 768, 1440]) {
    test(`the name stays on one line at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/en');
      await page.evaluate(() => document.fonts.ready);

      const h1 = page.getByRole('heading', { level: 1 });

      await expect(h1).toBeVisible();

      const metrics = await h1.evaluate((el) => ({
        overflow: el.scrollWidth - el.clientWidth,
        height: el.getBoundingClientRect().height,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        page: document.documentElement.scrollWidth - window.innerWidth,
      }));

      expect(metrics.overflow).toBeLessThanOrEqual(1);
      expect(metrics.height).toBeLessThan(metrics.fontSize * 1.6);
      expect(metrics.page).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('header', () => {
  test('profile icons sit in the bar from md up', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en');

    const banner = page.getByRole('banner');

    await expect(banner.getByRole('link', { name: /^GitHub/ })).toBeVisible();
    await expect(banner.getByRole('link', { name: /^LinkedIn/ })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Toggle terminal' })).toContainText('Terminal');
  });

  test('on phones the icons move into the menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/en');

    const banner = page.getByRole('banner');

    await expect(banner.getByRole('link', { name: /^GitHub/ })).toBeHidden();
    await expect(banner.getByRole('group', { name: 'Language' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Toggle terminal' })).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();

    const menu = page.getByRole('dialog');

    await expect(menu.getByRole('link', { name: /^GitHub/ })).toBeVisible();
    await expect(menu.getByRole('link', { name: /^LinkedIn/ })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Open terminal' })).toBeVisible();
    await expect(menu.getByRole('group', { name: 'Language' })).toHaveCount(0);
  });

  test('the switcher and menu fit at 320px with 44px targets', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/en');

    const banner = page.getByRole('banner');

    await expect(banner.getByRole('group', { name: 'Language' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const targets = [
      ...(await banner.getByRole('group', { name: 'Language' }).getByRole('link').all()),
      page.getByRole('button', { name: 'Open menu' }),
    ];

    for (const target of targets) {
      const box = await target.boundingBox();

      expect(box?.width).toBeGreaterThanOrEqual(43.5);
      expect(box?.height).toBeGreaterThanOrEqual(43.5);
    }
  });

  for (const [width, phone] of [
    [767, true],
    [768, false],
  ] as const) {
    test(`the terminal button and menu swap at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/en');

      const banner = page.getByRole('banner');

      await expect(banner.getByRole('group', { name: 'Language' })).toBeVisible();
      await expect(banner.getByRole('button', { name: 'Toggle terminal' })).toBeVisible({
        visible: !phone,
      });
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible({
        visible: phone,
      });
    });
  }

  test('the wordmark name hides while the hero is on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en');

    // `opacity: 0` still counts as visible to Playwright.
    const name = page.locator('[data-header-name]');

    await expect(name).toHaveCSS('opacity', '0');
    await page.locator('#about').scrollIntoViewIfNeeded();
    await expect(name).toHaveCSS('opacity', '1');
  });

  test('the wordmark name shows on other pages', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/projects/orbit-dashboard');
    await expect(page.locator('[data-header-name]')).toHaveCSS('opacity', '1');
  });
});
