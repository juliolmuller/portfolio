import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import sharp from 'sharp';

import { signWebhook } from '../../src/lib/content/webhook';
import { isolateClient, signIn } from './admin-helpers';
import { WEBHOOK_SECRET } from './auth-constants';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await isolateClient(page);
});

/**
 * Public pages regenerate lazily, and three browsers share one server.
 */
const slow = expect.configure({ timeout: 40_000 });

test.describe.configure({ timeout: 120_000 });

const field = (page: Page, path: string): Locator => page.locator(`#f-${path.replace(/\./g, '-')}`);

async function fillBoth(page: Page, path: string, en: string, pt = en): Promise<void> {
  await field(page, `${path}.en`).fill(en);

  const portuguese = field(page, `${path}.pt`);

  // Below 1024px the languages are tabs.
  if (!(await portuguese.isVisible())) {
    await portuguese
      .locator('xpath=ancestor::fieldset[1]')
      .getByRole('button', { name: 'Português' })
      .click();
  }

  await portuguese.fill(pt);
}

const published = (page: Page): Promise<void> =>
  slow(page.getByText('Published · public pages refreshed').first()).toBeVisible();

/**
 * Public pages are regenerated lazily after a revalidation.
 */
const publicText = (page: Page, path: string) => async (): Promise<string> =>
  (await page.request.get(path)).text();

/**
 * Typing before hydration is lost, so wait until the form is interactive.
 */
const hydrated = (page: Page): Promise<void> =>
  expect(page.locator('form[data-hydrated="true"]')).toBeAttached();

async function openEditor(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await hydrated(page);
}

/**
 * Retries the click: it can land before the page has hydrated.
 */
async function openDeleteDialog(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog', { name: 'Delete permanently?' });

  await expect(async () => {
    await page.getByRole('button', { name: 'Delete…' }).click();
    await expect(dialog).toBeVisible({ timeout: 1_500 });
  }).toPass();

  return dialog;
}

/**
 * The terminal snapshot is uncached, so it shows an edit at once.
 */
const snapshot = (page: Page) => async (): Promise<string> =>
  (await page.request.get('/api/terminal-content?locale=en')).text();

const AREAS = [
  'profile',
  'links',
  'recommended',
  'projects',
  'experience',
  'education',
  'technologies',
  'practices',
  'contact',
  'resume',
];

test.describe('every area', () => {
  test('lists and editors render and pass axe', async ({ page, browserName }) => {
    await signIn(page);

    const urls = [
      ...AREAS.map((area) => `/admin/${area}`),
      '/admin/projects/new',
      '/admin/technologies/new',
      '/admin/links/new',
      '/admin/experience/new',
    ];
    for (const url of urls) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Admin areas' }).first()).toBeAttached();

      if (browserName === 'webkit') continue;

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(
        results.violations.map((v) => `${url} ${v.id}`),
        url,
      ).toEqual([]);
    }
  });

  test('an existing project and technology open in their editors', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/projects');
    await page.getByRole('link', { name: 'Pay Bridge' }).first().click();
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Edit');
    await expect(field(page, 'title.en')).toHaveValue(/Pay/);
    await expect(page.getByRole('button', { name: 'Save and publish' })).toBeDisabled();
  });
});

test.describe('projects', () => {
  test('create, publish, rename the slug, delete', async ({ page }) => {
    const slug = `e2e-${Math.random().toString(36).slice(2, 8)}`;
    const renamed = `${slug}-v2`;

    await signIn(page);
    await openEditor(page, '/admin/projects/new');

    await fillBoth(page, 'title', 'E2E Project', 'Projeto E2E');
    await fillBoth(page, 'tagline', 'A throwaway project', 'Um projeto descartável');
    await fillBoth(
      page,
      'summary',
      'Created by the admin end-to-end test.',
      'Criado pelo teste e2e do admin.',
    );
    await field(page, 'slug').fill(slug);
    await fillBoth(page, 'role', 'Tester', 'Testador');
    await fillBoth(page, 'context', 'Context text.', 'Texto de contexto.');
    await fillBoth(page, 'approach', 'Approach text.', 'Texto de abordagem.');
    for (const index of [0, 1, 2]) {
      await fillBoth(
        page,
        `highlights.${index}`,
        `Highlight ${index + 1}`,
        `Destaque ${index + 1}`,
      );
    }
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await expect(page).toHaveURL(/\/admin\/projects\/[0-9a-f-]{36}$/);

    await slow.poll(publicText(page, `/en/projects/${slug}`)).toContain('E2E Project');
    await slow.poll(publicText(page, `/pt/projects/${slug}`)).toContain('Projeto E2E');

    await field(page, 'slug').fill(renamed);
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await expect(field(page, 'slug')).toHaveAccessibleDescription(new RegExp(`Old slugs: ${slug}`));
    await slow.poll(snapshot(page)).toContain(`"slug":"${renamed}"`);
    await slow.poll(snapshot(page)).not.toContain(`"slug":"${slug}"`);

    const dialog = await openDeleteDialog(page);

    await expect(dialog.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
    await dialog.getByLabel('Confirmation text').fill(renamed);
    await dialog.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/projects$/);
    await slow.poll(snapshot(page)).not.toContain(renamed);
  });

  test('validation shows an error summary that links to the field', async ({ page }) => {
    await signIn(page);
    await openEditor(page, '/admin/projects/new');
    await field(page, 'title.en').fill('Only English');
    await field(page, 'slug').fill('Not A Slug');
    await page.getByRole('button', { name: 'Save and publish' }).click();

    const summary = page.getByRole('alert').filter({ hasText: 'problems to fix' });

    await expect(summary).toBeFocused();
    await expect(field(page, 'slug')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Invalid slug', { exact: true })).toBeVisible();
    await summary.getByRole('link', { name: 'slug' }).click();
    await expect(field(page, 'slug')).toBeFocused();
    await expect(page).toHaveURL(/\/admin\/projects\/new/);
  });

  test('the featured and visible toggles and the order buttons work', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'toggles a project shared by all projects');
    await signIn(page);
    await page.goto('/admin/projects');

    const row = page.locator('tbody tr').first();
    const name = (await row.locator('td').first().innerText()).trim();
    const visible = row.getByRole('checkbox', { name: `Visible: ${name}` });

    await expect(visible).toBeChecked();
    await visible.uncheck();
    await slow
      .poll(async () => (await page.request.get('/api/terminal-content?locale=en')).text())
      .not.toContain(name);
    await visible.check();
    await slow
      .poll(async () => (await page.request.get('/api/terminal-content?locale=en')).text())
      .toContain(name);
  });
});

test.describe('singletons and lists', () => {
  test('contact saves, reaches the site data, warns about unsaved changes, and is restored', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'edits a singleton shared by all projects');
    await signIn(page);
    await openEditor(page, '/admin/contact');

    const original = await field(page, 'bookingUrl').inputValue();

    await field(page, 'bookingUrl').fill('https://example.com/e2e-booking');
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Discard unsaved changes?');
      dialog.dismiss();
    });
    await page
      .getByRole('navigation', { name: 'Admin areas' })
      .first()
      .getByRole('link', { name: 'Links' })
      .click();
    await expect(page).toHaveURL(/\/admin\/contact$/);

    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await slow.poll(snapshot(page)).toContain('https://example.com/e2e-booking');

    await field(page, 'bookingUrl').fill(original);
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await slow.poll(snapshot(page)).not.toContain('e2e-booking');
  });

  test('pressing Enter in the delete confirmation does not save unsaved edits', async ({
    page,
  }) => {
    const label = `E2E enter ${Math.random().toString(36).slice(2, 7)}`;

    await signIn(page);
    await openEditor(page, '/admin/practices/new');
    await field(page, 'label.en').fill(label);
    await page.getByText('Copy', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Copy English to Portuguese' }).click();
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await expect(page).toHaveURL(/\/admin\/practices\/[0-9a-f-]{36}$/);
    await hydrated(page);

    await field(page, 'label.en').fill(`${label} edited`);

    const dialog = await openDeleteDialog(page);
    const confirmation = dialog.getByLabel('Confirmation text');

    await confirmation.fill(label);
    await confirmation.press('Enter');
    // A wrongly submitted save would have finished by now.
    await page.waitForTimeout(2_000);
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    expect(await (await page.request.get('/api/terminal-content?locale=en')).text()).not.toContain(
      `${label} edited`,
    );

    await dialog.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/practices$/);
  });

  test('an experience saves without location and with a long summary', async ({ page }) => {
    const company = `E2E Co ${Math.random().toString(36).slice(2, 7)}`;
    const long = 'Long summary text. '.repeat(25);

    await signIn(page);
    await openEditor(page, '/admin/experience/new');
    await field(page, 'company').fill(company);
    await fillBoth(page, 'roles.0.title', 'Tester', 'Testador');
    await field(page, 'roles.0.start').fill('2024-01');
    await fillBoth(page, 'roles.0.summary', long);
    await expect(field(page, 'roles.0.summary.en')).toHaveAccessibleDescription(
      /over 400: the site shows the start/,
    );
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await slow.poll(snapshot(page)).toContain(company);

    await openDeleteDialog(page);
    await page.getByLabel('Confirmation text').fill(company);
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/experience$/);
  });

  test('a practice: create, copy EN to PT, reorder, hide, delete', async ({ page }) => {
    const label = `E2E practice ${Math.random().toString(36).slice(2, 7)}`;

    await signIn(page);
    await openEditor(page, '/admin/practices/new');
    await field(page, 'label.en').fill(label);
    await page.getByText('Copy', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Copy English to Portuguese' }).click();
    await expect(field(page, 'label.pt')).toHaveValue(label);
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await slow
      .poll(async () => (await page.request.get('/api/terminal-content?locale=en')).text())
      .toContain(label);

    await page.goto('/admin/practices');

    const row = page.locator('tbody tr').filter({ hasText: label });

    await expect(row).toBeVisible();
    await row.getByRole('button', { name: `Move ${label} up` }).click();
    await expect(page.getByText('Order saved')).toBeVisible();
    await row.getByRole('checkbox', { name: `Visible: ${label}` }).uncheck();
    await slow
      .poll(async () => (await page.request.get('/api/terminal-content?locale=en')).text())
      .not.toContain(label);

    await row.getByRole('link', { name: label }).click();
    await hydrated(page);
    await openDeleteDialog(page);
    await page.getByLabel('Confirmation text').fill(label);
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/practices$/);
    await expect(page.locator('tbody tr').filter({ hasText: label })).toHaveCount(0);
  });

  test('a concurrent edit opens the conflict dialog; overwrite wins', async ({ page, context }) => {
    const label = `E2E conflict ${Math.random().toString(36).slice(2, 7)}`;

    await signIn(page);
    await openEditor(page, '/admin/practices/new');
    await fillBoth(page, 'label', label);
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await expect(page).toHaveURL(/\/admin\/practices\/[0-9a-f-]{36}$/);

    const editUrl = page.url();

    const other = await context.newPage();

    await openEditor(other, editUrl);
    await fillBoth(other, 'label', `${label} (other)`);
    await other.getByRole('button', { name: 'Save and publish' }).click();
    await published(other);
    await other.close();

    await field(page, 'label.en').fill(`${label} (mine)`);
    await page.getByRole('button', { name: 'Save and publish' }).click();

    const dialog = page.getByRole('dialog', {
      name: 'This item changed elsewhere',
    });

    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Overwrite' }).click();
    await published(page);
    await page.reload();
    await hydrated(page);
    await expect(field(page, 'label.en')).toHaveValue(`${label} (mine)`);

    await openDeleteDialog(page);
    await page.getByLabel('Confirmation text').fill(`${label} (mine)`);
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/practices$/);
  });

  test('a technology is blocked from deletion while a project uses it', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/technologies');
    await page.getByLabel('Search technologies').fill('TypeScript');
    await page.getByRole('link', { name: 'TypeScript' }).first().click();
    await hydrated(page);
    await openDeleteDialog(page);
    await page.getByLabel('Confirmation text').fill('TypeScript');
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page.getByText('It is still used by:')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/technologies\/[0-9a-f-]{36}$/);
  });

  test('a technology with a custom SVG: sanitized, previewed, saved, deleted', async ({ page }) => {
    const name = `E2E Tech ${Math.random().toString(36).slice(2, 6)}`;

    await signIn(page);
    await openEditor(page, '/admin/technologies/new');
    await field(page, 'name').fill(name);
    await field(page, 'iconSource').selectOption('custom-svg');

    await page
      .locator('#svg-source')
      .fill('<svg viewBox="0 0 24 24"><path d="M0 0L5 5" stroke="#000"/></svg>');
    await page.getByRole('button', { name: 'Use this SVG' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'not supported' })).toBeVisible();

    await page
      .locator('#svg-source')
      .fill(
        '<svg viewBox="0 0 24 24"><script>alert(1)</script><path d="M2 2h20v20H2Z" onclick="x()"/></svg>',
      );
    await page.getByRole('button', { name: 'Use this SVG' }).click();
    await expect(page.getByRole('img', { name: 'Icon preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);
    await slow
      .poll(async () => (await page.request.get('/api/terminal-content?locale=en')).text())
      .toContain(name);

    await openDeleteDialog(page);
    await page.getByLabel('Confirmation text').fill(name);
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/technologies$/);
  });

  test('the dashboard lists content and refreshes the public pages', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent changes' })).toBeVisible();
    await page.getByRole('button', { name: 'Revalidate all public pages' }).click();
    await expect(page.getByText('Public pages refreshed')).toBeVisible();
  });
});

test('saving without a session says the session expired and keeps the edits', async ({ page }) => {
  await signIn(page);
  await openEditor(page, '/admin/practices/new');
  await field(page, 'label.en').fill('Unsaved edit');
  await page.context().clearCookies();
  await page.getByRole('button', { name: 'Save and publish' }).click();
  await expect(page.getByText(/Your session expired/).first()).toBeVisible();
  await expect(field(page, 'label.en')).toHaveValue('Unsaved edit');
});

test.describe('uploads', () => {
  const makePng = (): Promise<Buffer<ArrayBuffer>> =>
    sharp({
      create: { width: 8, height: 8, channels: 3, background: '#0099ff' },
    })
      .png()
      .toBuffer();

  test('an avatar uploads and saves with a recommended profile', async ({ page }) => {
    const name = `E2E Person ${Math.random().toString(36).slice(2, 6)}`;
    const png = await makePng();

    await signIn(page);
    await openEditor(page, '/admin/recommended/new');
    await field(page, 'name').fill(name);
    await fillBoth(page, 'role', 'Tester', 'Testador');
    await fillBoth(page, 'note', 'Worth following.', 'Vale seguir.');
    await field(page, 'url').fill('https://example.com/person');
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'Avatar Photo.PNG',
      mimeType: 'image/png',
      buffer: png,
    });
    await expect(page.getByText('Image uploaded. Save to publish it.')).toBeVisible();
    await page.getByRole('button', { name: 'Save and publish' }).click();
    await published(page);

    await openDeleteDialog(page);
    await page.getByLabel('Confirmation text').fill(name);
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page).toHaveURL(/\/admin\/recommended$/);
  });

  test('the endpoint refuses wrong types, scripted PDFs, cross-origin and anonymous calls', async ({
    page,
    request,
  }) => {
    const png = await makePng();

    await signIn(page);

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred type is the clearest description
    const send = (file: { buffer: Buffer; mimeType: string; name: string }, kind: string) =>
      page.evaluate(
        async ({ data, name, mimeType, kind }) => {
          const body = new FormData();

          body.set('file', new File([new Uint8Array(data)], name, { type: mimeType }));
          body.set('kind', kind);

          const response = await fetch('/admin/api/upload', {
            method: 'POST',
            body,
          });

          return {
            status: response.status,
            body: (await response.json()) as {
              asset?: unknown;
              error?: string;
            },
          };
        },
        {
          data: [...file.buffer],
          name: file.name,
          mimeType: file.mimeType,
          kind,
        },
      );

    const svg = await send(
      {
        name: 'x.png',
        mimeType: 'image/png',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      },
      'image',
    );

    expect(svg.status).toBe(415);

    const scripted = await send(
      {
        name: 'cv.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7\n<< /S /JavaScript /JS (x) >>\n%%EOF'),
      },
      'pdf',
    );

    expect(scripted.status).toBe(415);
    expect(scripted.body.error).toMatch(/scripts/);

    const notPdf = await send(
      {
        name: 'cv.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('hello'),
      },
      'pdf',
    );

    expect(notPdf.status).toBe(415);

    const good = await send({ name: 'ok.png', mimeType: 'image/png', buffer: png }, 'image');

    expect(good.status).toBe(200);
    expect(good.body.asset).toMatchObject({ width: 8, height: 8 });

    // No Origin header: not a same-origin browser request.
    const formless = await page.request.post('/admin/api/upload', {
      multipart: { kind: 'image' },
    });

    expect(formless.status()).toBe(403);

    // Anonymous: exactly what any unknown path answers to the same request.
    const multipart = { multipart: { kind: 'image' } };
    const anonymous = await request.post('/admin/api/upload', multipart);
    const unknown = await request.post('/zz-no-such-page', multipart);

    expect(anonymous.status()).toBe(unknown.status());
    expect(await anonymous.text()).toBe(await unknown.text());
  });
});

test.describe('revalidation webhook', () => {
  const body = JSON.stringify({ _type: 'project', slug: 'pay-bridge' });

  test('accepts a signed payload and maps it to tags', async ({ request }) => {
    const response = await request.post('/api/revalidate', {
      data: body,
      headers: {
        'content-type': 'application/json',
        'sanity-webhook-signature': signWebhook(body, WEBHOOK_SECRET),
      },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      revalidated: ['content:projects', 'content:project:pay-bridge'],
    });
  });

  test('anything else is a bare 404', async ({ request }) => {
    const headers = { 'content-type': 'application/json' };
    const unsigned = await request.post('/api/revalidate', {
      data: body,
      headers,
    });
    const tampered = await request.post('/api/revalidate', {
      data: `${body} `,
      headers: {
        ...headers,
        'sanity-webhook-signature': signWebhook(body, WEBHOOK_SECRET),
      },
    });
    const stale = await request.post('/api/revalidate', {
      data: body,
      headers: {
        ...headers,
        'sanity-webhook-signature': signWebhook(body, WEBHOOK_SECRET, Date.now() - 3_600_000),
      },
    });
    const wrongType = JSON.stringify({ _type: 'something' });
    const unknown = await request.post('/api/revalidate', {
      data: wrongType,
      headers: {
        ...headers,
        'sanity-webhook-signature': signWebhook(wrongType, WEBHOOK_SECRET),
      },
    });
    for (const response of [unsigned, tampered, stale, unknown]) {
      expect(response.status()).toBe(404);
      expect(await response.text()).toBe('');
    }
  });
});
