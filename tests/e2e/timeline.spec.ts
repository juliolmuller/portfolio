import { expect, type Page, test } from '@playwright/test';

import { waitForHydration } from './hydration';

const RAIL = '[data-timeline-rail]';

async function railScale(page: Page): Promise<null | number> {
  return page.locator(RAIL).evaluate((rail) => {
    const match = /scaleY\(([-\d.e]+)\)/.exec((rail as HTMLElement).style.transform);

    return match?.[1] ? Number(match[1]) : null;
  });
}

async function box(page: Page): Promise<{ height: number; top: number; vh: number }> {
  return page.locator(RAIL).evaluate((rail) => {
    const rect = (rail.closest('.relative') as HTMLElement).getBoundingClientRect();

    return { top: rect.top, height: rect.height, vh: window.innerHeight };
  });
}

function expected(b: { height: number; top: number }, y: number): number {
  return Math.min(1, Math.max(0, (y - b.top) / b.height));
}

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en');
  await waitForHydration(page);
  await page.locator('#experience').evaluate((element) => {
    element.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
}

test.describe('timeline rail', () => {
  const problems: string[] = [];

  test.beforeEach(({ page }) => {
    problems.length = 0;
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
  });

  test.afterEach(() => {
    expect(problems).toEqual([]);
  });

  test('the tip follows a fine pointer and falls back outside the section', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'needs a fine pointer');
    await open(page);

    const b = await box(page);
    const y1 = b.top + b.height * 0.3;
    const y2 = b.top + b.height * 0.7;

    await page.mouse.move(700, Math.min(Math.max(y1, 100), b.vh - 100));
    await expect
      .poll(async () => railScale(page), { timeout: 5_000 })
      .toBeCloseTo(expected(b, Math.min(Math.max(y1, 100), b.vh - 100)), 1);

    const y2c = Math.min(Math.max(y2, 100), b.vh - 100);

    await page.mouse.move(700, y2c);
    await expect
      .poll(async () => railScale(page), { timeout: 5_000 })
      .toBeCloseTo(expected(b, y2c), 1);

    await page.mouse.move(700, 10);
    await expect
      .poll(async () => railScale(page), { timeout: 5_000 })
      .toBeCloseTo(expected(b, b.vh * 0.6), 1);
  });

  test('nodes pulse once and stay reached', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'needs a fine pointer');
    await open(page);

    const node = page.locator('[data-timeline-node]').first();
    const nodeY = await node.evaluate((element) => {
      const rect = element.getBoundingClientRect();

      return rect.top + rect.height / 2;
    });

    await page.mouse.move(700, Math.max(nodeY - 80, 60));
    await expect
      .poll(async () => railScale(page), { timeout: 5_000 })
      .toBeCloseTo(expected(await box(page), Math.max(nodeY - 80, 60)), 1);
    await expect(node).not.toHaveAttribute('data-reached', 'true');
    await page.mouse.move(700, Math.min(nodeY + 80, 800));
    await expect(node).toHaveAttribute('data-reached', 'true');
    await page.mouse.move(700, Math.max(nodeY - 80, 60));
    await page.waitForTimeout(500);
    await expect(node).toHaveAttribute('data-reached', 'true');
  });

  test('touch keeps the scroll anchor', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch device only');
    await page.goto('/en');
    await waitForHydration(page);
    await page.locator('#experience').evaluate((element) => {
      element.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(300);
    await page.touchscreen.tap(100, 100);
    await page.waitForTimeout(500);

    const b = await box(page);

    expect(await railScale(page)).toBeCloseTo(expected(b, b.vh * 0.6), 1);
  });

  test('reduced motion leaves the rail drawn', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'needs a fine pointer');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.mouse.move(700, 300);
    await page.waitForTimeout(300);
    expect(await railScale(page)).toBeNull();
  });
});

test.describe('experience initial state (D89)', () => {
  const JOBS = '#experience li details.group\\/details';

  for (const locale of ['en', 'pt']) {
    test(`jobs follow collapsedByDefault in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await waitForHydration(page);

      const jobs = page.locator(JOBS);

      await expect(jobs).toHaveCount(3);
      await expect(jobs.nth(0)).toHaveAttribute('open', '');
      await expect(jobs.nth(1)).toHaveAttribute('open', '');
      await expect(jobs.nth(2)).not.toHaveAttribute('open');
    });
  }

  test('server HTML and no-JS render carry the same state', async ({ browser, request }) => {
    const html = await (await request.get('/en')).text();
    const tags = [...html.matchAll(/<details[^>]*group\/details[^>]*>/g)].map((m) => m[0]);

    expect(tags.map((tag) => /\sopen[=\s>]/.test(tag))).toEqual([true, true, false]);

    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto('/en');

    const jobs = page.locator(JOBS);

    await expect(jobs.nth(1)).toHaveAttribute('open', '');
    await expect(jobs.nth(2)).not.toHaveAttribute('open');
    await context.close();
  });

  test('visitors can toggle every job', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en');
    await waitForHydration(page);

    const jobs = page.locator(JOBS);

    await jobs.nth(2).locator('summary').first().click();
    await expect(jobs.nth(2)).toHaveAttribute('open', '');
    await jobs.nth(0).locator('summary').first().click();
    await expect(jobs.nth(0)).not.toHaveAttribute('open');
  });
});
