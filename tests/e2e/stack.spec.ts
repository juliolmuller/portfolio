import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Hero/geoid motion keeps WebKit's actionability check from settling.
 */
async function showStack(page: Page): Promise<void> {
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  await page.locator('#stack').evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
  });
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

test('stack list is in the first HTML', async ({ request }) => {
  const response = await request.get('/en');

  expect(response.status()).toBe(200);

  const html = await response.text();

  expect(html).toContain('Technologies I work with');
  expect(html).toContain('TypeScript');
  expect(html).toContain('Zustand');
  expect(html).toContain('Redis');
  expect(html).toContain('REST API design');
  expect(html).not.toContain('>Cloud</button>');
  expect(html).not.toContain('>List</button>');
});

test('cloud hydrates and category chips dim the geoid', async ({ page }) => {
  await showStack(page);
  await expect(page.getByRole('button', { name: 'Cloud', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Filter by category' })).toBeVisible();
  await expect(page.getByRole('button', { name: /AI agents/ })).toBeVisible();

  // The chip row re-renders once the viewport cull settles; a click that
  // lands on the outgoing node is lost, so retry until it registers.
  const languages = page.getByRole('button', { name: /Languages/ });

  await expect(async () => {
    if ((await languages.getAttribute('aria-pressed')) !== 'true') {
      await languages.click({ force: true });
    }

    await expect(languages).toHaveAttribute('aria-pressed', 'true', {
      timeout: 1_000,
    });
  }).toPass();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const unmatched = document.querySelector(
          '[data-cloud-item][data-categories]:not([data-categories~="language"])',
        ) as HTMLElement | null;
        const matched = document.querySelector(
          '[data-cloud-item][data-categories~="language"][data-interactive]',
        ) as HTMLElement | null;

        if (!unmatched) return 'missing-unmatched';

        if (unmatched.style.pointerEvents !== 'none') {
          return `pe:${unmatched.style.pointerEvents}`;
        }

        if (unmatched.hasAttribute('data-interactive')) {
          return 'unmatched-interactive';
        }

        const unmatchedOpacity = Number(unmatched.style.opacity);

        if (!(unmatchedOpacity > 0 && unmatchedOpacity <= 0.12)) {
          return `op:${unmatched.style.opacity}`;
        }

        if (matched && Number(matched.style.opacity) <= unmatchedOpacity) {
          return 'matched-not-brighter';
        }

        return 'ok';
      }),
    )
    .toBe('ok');
});

test('reduced motion keeps the list', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await showStack(page);
  await expect(page.getByRole('button', { name: 'Cloud', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Languages' })).toBeVisible();
  await expect(page.locator('[data-cloud-item]')).toHaveCount(0);
});

test('stack has no axe violations', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'axe runs on Chromium projects');
  await showStack(page);
  await expect(page.locator('[data-cloud-item]').first()).toBeAttached();

  const results = await new AxeBuilder({ page })
    .include('#stack')
    .withTags(AXE_TAGS)
    .exclude('[data-reveal=pending]')
    .exclude('[aria-hidden="true"]')
    .analyze();

  expect(results.violations).toEqual([]);
});

test('tap on a front icon announces its name', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'touch path is Pixel 7 only');
  await showStack(page);
  await expect(page.locator('[data-cloud-item]').first()).toBeAttached();
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-cloud-item]') as HTMLElement | null;

    return Boolean(el?.style.transform.includes('translate3d'));
  });

  const id = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-cloud-item]')];
    const front = nodes
      .map((el) => ({
        id: el.getAttribute('data-cloud-item'),
        z: Number((el as HTMLElement).style.zIndex) || 0,
      }))
      .sort((a, b) => b.z - a.z)[0];

    return front?.id ?? null;
  });

  expect(id).toBeTruthy();

  const name = await page.locator(`[data-cloud-item="${id}"] span`).textContent();

  expect(name).toBeTruthy();
  await page.locator(`[data-cloud-item="${id}"]`).tap({ force: true });
  await expect(page.locator('#stack [aria-live="polite"]')).toContainText(name ?? '');
});

test('every logo the stack requests resolves', async ({ page }) => {
  const statuses: number[] = [];

  page.on('response', (response) => {
    if (response.url().includes('/tech-icons/')) statuses.push(response.status());
  });
  await showStack(page);
  await expect(page.locator('[data-cloud-item]').first()).toBeVisible();
  await page.waitForLoadState('networkidle');

  expect(statuses.length).toBeGreaterThan(0);
  expect(statuses.filter((status) => status >= 400)).toEqual([]);
});
