import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Hero/geoid motion keeps WebKit's actionability check from settling.
 */
async function showStack(page: Page, locale: 'en' | 'pt' = 'en'): Promise<void> {
  await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#stack').evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
  });
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

test('stack list is in the first HTML', async ({ request }) => {
  const response = await request.get('/en');

  expect(response.status()).toBe(200);

  const html = await response.text();

  expect(html).toContain('Skills I work with');
  expect(html).not.toContain('Technologies I work with');
  expect(html).toContain('TypeScript');
  expect(html).toContain('Zustand');
  expect(html).toContain('Redis');
  expect(html).toContain('REST API design');
  expect(html).toContain('Software engineering');
  expect(html).not.toContain('>Practices and concepts</h3>');
  expect(html).not.toContain('id="stack-practices"');
  expect(html).not.toContain('>Cloud</button>');
  expect(html).not.toContain('>List</button>');
});

test('stack title is translated in the first HTML', async ({ request }) => {
  const html = await (await request.get('/pt')).text();

  expect(html).toContain('Habilidades com que trabalho');
  expect(html).not.toContain('Tecnologias com que trabalho');
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

// The chip's accessible name comes from `stack.filterChip`, which now counts
// skills (#75); the visible text is only the category and the number.
for (const [locale, count] of [
  ['en', /\d+ skills?$/],
  ['pt', /\d+ habilidades?$/],
] as const) {
  test(`category chips count skills in ${locale}`, async ({ page }) => {
    await showStack(page, locale);
    await expect(
      page.locator('#stack').getByRole('toolbar').getByRole('button').first(),
    ).toHaveAccessibleName(count);
  });
}

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

/**
 * Guard for the cloud switching to skills (#74): whatever logo URLs the stack
 * draws must resolve, whichever collection they come from.
 */
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
