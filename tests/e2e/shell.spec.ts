import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

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

  test('unmatched top-level files and the rewrite target are real 404s', async ({ request }) => {
    const random = await (await request.get('/definitely-not-here')).text();

    for (const path of ['/.well-known/ard.json', '/__not-found']) {
      const response = await request.get(path);

      expect(response.status(), path).toBe(404);
      expect(await response.text(), path).toBe(random);
    }
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

    test('home sections follow the resume-after-work order', async ({ request }) => {
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

  const switcher = page.getByRole('banner').getByRole('group', { name: 'Language' });

  await switcher.getByRole('link', { name: /PT/ }).click({ force: true });
  await expect(page).toHaveURL(/\/pt#top$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

  const cookies = await page.context().cookies();

  expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('pt');
});

const SUMMARY_ENDING = 'before the next release train leaves';

// The box that clamps a role summary: the element the toggle controls.
function summaryBox(page: Page): Locator {
  return page.locator('#experience li').first().locator('[data-summary]');
}

function boxLines(box: Locator): Promise<number> {
  return box.evaluate(
    (el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight),
  );
}

test('role summaries are in the HTML once and clamp to four lines with an inline toggle', async ({
  page,
  request,
}) => {
  // Crawlers and no-JS visitors get the whole text, once, never hidden (D90).
  // The RSC payload in <script> tags carries the props again; the markup holds it once.
  const html = (await (await request.get('/en')).text()).replaceAll(
    /<script[\s\S]*?<\/script>/g,
    '',
  );

  expect(html.split(SUMMARY_ENDING)).toHaveLength(2);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en#experience');

  const role = page.locator('#experience li').first();
  const box = summaryBox(page);
  const more = role.getByRole('button', { name: /^More/ });

  await expect(more).toBeVisible();
  await expect(more).toHaveAccessibleName(/^More\s*: Senior Full Stack Engineer$/);
  expect(await boxLines(box)).toBeLessThanOrEqual(4.1);

  // On the last line of the clamped box, with a hit area of at least 44 × 44.
  const boxRect = (await box.boundingBox())!;
  const moreRect = (await more.boundingBox())!;

  expect(Math.abs(moreRect.y + moreRect.height - (boxRect.y + boxRect.height))).toBeLessThanOrEqual(
    2,
  );

  const hit = await more.evaluate((el) => {
    const after = getComputedStyle(el, '::after');

    return { height: parseFloat(after.height), width: parseFloat(after.width) };
  });

  expect(hit.height).toBeGreaterThanOrEqual(44);
  expect(hit.width + 0).toBeGreaterThan(0);

  await more.click();
  await expect(role.getByText(SUMMARY_ENDING)).toBeVisible();

  const less = role.getByRole('button', { name: /^Less/ });

  await expect(less).toHaveAttribute('aria-expanded', 'true');
  await expect(less).toBeFocused();
  await expect(less).toBeInViewport();

  await less.click();
  await expect(more).toBeFocused();
  expect(await boxLines(box)).toBeLessThanOrEqual(4.1);
});

test('a short role summary has no toggle', async ({ page }) => {
  await page.goto('/en#experience');
  await expect(page.getByRole('button', { name: /^More/ }).first()).toBeVisible();
  // Open every collapsed role so the last summary is laid out and measured.
  await page.locator('#experience details').evaluateAll((all) => {
    for (const d of all) (d as HTMLDetailsElement).open = true;
  });

  const box = page.locator('#experience [data-summary]').last();

  await expect(box).toBeVisible();
  expect(await box.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await expect(box.locator('xpath=..').getByRole('button')).toHaveCount(0);
});

test('nothing below the summary moves when the toggle appears', async ({ page }) => {
  await page.goto('/en#experience', { waitUntil: 'domcontentloaded' });

  const role = page.locator('#experience li').first();
  const bullets = role.locator('ul').first();
  // Distance from the summary box to the highlights: unaffected by anything above.
  const gap = (): Promise<number> =>
    bullets.evaluate(
      (el, selector) =>
        el.getBoundingClientRect().top
        - document.querySelector(selector)!.getBoundingClientRect().top,
      '#experience li [data-summary]',
    );
  const before = await gap();

  await expect(role.getByRole('button', { name: /^More/ })).toBeVisible();
  expect(Math.abs((await gap()) - before)).toBeLessThanOrEqual(1);
});

test('the summary is clamped on first paint, before scripts run', async ({ page }) => {
  await page.route('**/_next/static/chunks/**/*.js', (route) => route.abort());
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  await page.locator('#experience').scrollIntoViewIfNeeded();
  expect(await boxLines(summaryBox(page))).toBeLessThanOrEqual(4.1);
});

test('without JavaScript the full text shows and there is no dead toggle', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto('/en');
  await expect(page.getByText(SUMMARY_ENDING)).toBeVisible();
  await expect(
    page.locator('#experience').getByRole('button', { name: /^(More|Less)/ }),
  ).toHaveCount(0);
  await context.close();
});

test('the toggle is measured again after a language switch and at 320 px', async ({ page }) => {
  await page.goto('/pt#experience');
  await expect(page.getByRole('button', { name: /^Mais/ }).first()).toBeVisible();

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/en#experience');
  await expect(page.getByRole('button', { name: /^More/ }).first()).toBeVisible();
  expect(await boxLines(summaryBox(page))).toBeLessThanOrEqual(4.1);
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

test('the public toaster stays at the bottom', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('[data-toaster]')).toHaveAttribute('data-position', 'bottom');
});
