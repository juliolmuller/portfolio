import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  inputOf,
  logOf,
  openTerminal,
  passwordOf,
  run,
  signIn,
  submitPassword,
  windowOf,
} from './admin-helpers';
import { SESSION_SECRET } from './auth-constants';

const SHORTCUT = 'Control+/';
const FAILURE = 'su: Authentication failure';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The rate limiter keys on this header, so tests do not share a budget.
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
  });
});

const ANONYMOUS_PATHS = [
  '/admin',
  '/admin/',
  '/admin/projects',
  '/admin/deeply/nested/path',
  '/admin/api/upload',
  '/ADMIN',
];

test.describe('anonymous access', () => {
  test('every admin path is the same real 404 as an unknown path', async ({ request }) => {
    const reference = await request.get('/zz-no-such-page');

    expect(reference.status()).toBe(404);

    const referenceBody = await reference.text();

    for (const path of ANONYMOUS_PATHS) {
      const response = await request.get(path);

      expect(response.status(), path).toBe(404);
      expect(await response.text(), path).toBe(referenceBody);
      for (const header of ['content-type', 'cache-control', 'x-robots-tag', 'referrer-policy']) {
        expect(response.headers()[header], `${path} ${header}`).toBe(reference.headers()[header]);
      }
    }
  });

  test('writes and action posts are 404 too, never 401 or a redirect', async ({ request }) => {
    for (const method of ['post', 'put', 'delete'] as const) {
      for (const action of [false, true]) {
        const headers: Record<string, string> = action ? { 'next-action': 'abc' } : {};
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred type is the clearest description
        const send = (path: string) => request[method](path, { maxRedirects: 0, headers });
        const unknown = await send('/zz-no-such-page');
        const admin = await send('/admin');

        expect(admin.status(), method).toBe(unknown.status());
        expect(await admin.text(), method).toBe(await unknown.text());

        if (!action) expect(admin.status(), method).toBe(404);
      }
    }
  });

  test('garbage, forged and expired cookies are not sessions', async ({ request, context }) => {
    const { SignJWT } = await import('jose');
    const forge = (secret: string, exp: number): Promise<string> =>
      new SignJWT({ ses: Math.floor(Date.now() / 1000) })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('admin')
        .setIssuedAt(exp - 60)
        .setExpirationTime(exp)
        .sign(new TextEncoder().encode(secret));
    const future = Math.floor(Date.now() / 1000) + 600;
    const cookies = [
      'garbage',
      await forge('f'.repeat(40), future),
      await forge(SESSION_SECRET, Math.floor(Date.now() / 1000) - 600),
    ];
    for (const value of cookies) {
      await context.addCookies([{ name: 'jm_session', value, url: 'http://localhost:3100' }]);
      expect((await request.get('/admin')).status()).toBe(404);
    }
  });

  test('the public site never mentions the admin path', async ({ request }) => {
    for (const path of [
      '/en',
      '/pt',
      '/robots.txt',
      '/llms.txt',
      '/sitemap.xml',
      '/manifest.webmanifest',
      '/api/terminal-content?locale=en',
      '/api/terminal-content?locale=pt',
    ]) {
      const body = await (await request.get(path)).text();

      expect(body, path).not.toContain('/admin');
    }
  });

  test('public scripts hold no secret strings; the lazy module has them', async ({ page }) => {
    const scripts = new Map<string, string>();

    page.on('response', async (response) => {
      if (response.request().resourceType() !== 'script') return;

      scripts.set(response.url(), await response.text().catch(() => ''));
    });

    const forbidden = ['Authentication failure', '/admin'];

    await openTerminal(page);
    await run(page, 'help');
    await run(page, 'projects');
    await expect(logOf(page)).toContainText('orbit-dashboard');
    expect(scripts.size).toBeGreaterThan(3);
    for (const [url, source] of scripts) {
      for (const needle of forbidden) {
        expect(source, `${url} ${needle}`).not.toContain(needle);
      }
    }

    await run(page, 'su julio');
    await expect(passwordOf(page)).toBeFocused();
    await expect
      .poll(
        () =>
          [...scripts.values()].filter((source) => source.includes('Authentication failure'))
            .length,
      )
      .toBe(1);
  });
});

test.describe('terminal login', () => {
  test('a wrong password shows the generic failure and leaves no trace', async ({ page }) => {
    await openTerminal(page);
    await run(page, 'su julio');
    await expect(logOf(page)).toContainText('Password:');
    await expect(passwordOf(page)).toHaveAttribute('type', 'password');
    await expect(passwordOf(page)).toHaveAttribute('autocomplete', 'off');

    const started = Date.now();

    await submitPassword(page, 'wrong-secret-value');
    await expect(logOf(page)).toContainText(FAILURE);
    expect(Date.now() - started).toBeGreaterThanOrEqual(750);

    await expect(logOf(page)).not.toContainText('wrong-secret-value');

    const stored = await page.evaluate(() =>
      JSON.stringify({ ...sessionStorage, ...localStorage }),
    );

    expect(stored).not.toContain('wrong-secret-value');
    expect(stored).not.toContain('su julio');
    expect(await page.evaluate(() => document.cookie)).not.toContain('session');

    await inputOf(page).press('ArrowUp');
    await expect(inputOf(page)).toHaveValue('');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(logOf(page)).not.toContainText('su julio');
    await expect(logOf(page)).not.toContainText('Authentication');
  });

  test('another target or none fails the same way', async ({ page }) => {
    await openTerminal(page);
    await run(page, 'su root');
    await submitPassword(page, 'whatever');
    await expect(logOf(page)).toContainText(FAILURE);
  });

  test('Ctrl+C cancels the prompt and sends nothing', async ({ page }) => {
    await openTerminal(page);
    await run(page, 'su julio');
    await expect(passwordOf(page)).toBeFocused();
    await passwordOf(page).fill('partial');
    await passwordOf(page).press('Control+c');
    await expect(inputOf(page)).toBeFocused();
    await expect(logOf(page)).toContainText('^C');
    await expect(logOf(page)).not.toContainText(FAILURE);
    await run(page, 'pwd');
    await expect(logOf(page)).toContainText('~');
  });

  test('admin and logout look like unknown commands without a session', async ({ page }) => {
    await openTerminal(page);
    // The first secret name loads a lazy chunk; input is ignored while it runs.
    await run(page, 'admin');
    await expect(logOf(page)).toContainText('command not found: admin');
    await run(page, 'logout');
    await expect(logOf(page)).toContainText('command not found: logout');
    await run(page, 'help');
    await expect(logOf(page).getByRole('button', { name: 'logout' })).toHaveCount(0);
    await expect(logOf(page).getByRole('button', { name: 'help' }).first()).toBeVisible();
  });

  test('signing in opens the dashboard; the terminal shows the session; logout ends it', async ({
    page,
    context,
  }) => {
    await signIn(page);

    const cookie = (await context.cookies()).find((item) => item.name === 'jm_session');

    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'Strict',
      path: '/',
    });

    await page.getByRole('link', { name: 'View site' }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.keyboard.press(SHORTCUT);
    await expect(windowOf(page)).toHaveAttribute('data-status', 'open');
    await expect(page.locator('[data-session-pill]')).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Window controls' })).toContainText(
      'julio@julio-muller',
    );

    await run(page, 'whoami');
    await expect(logOf(page)).toContainText('julio');
    await run(page, 'admin');
    await expect(logOf(page)).toContainText('Admin areas:');
    await logOf(page).getByRole('button', { name: 'projects', exact: true });

    await run(page, 'logout');
    await expect(logOf(page)).toContainText('Signed out.');
    await expect(page.locator('[data-session-pill]')).toHaveCount(0);
    expect((await page.request.get('/admin')).status()).toBe(404);
  });

  test('Sign out in the admin returns to the public site', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/(en)?$/);
    expect((await page.request.get('/admin')).status()).toBe(404);
  });
});

test.describe('admin shell', () => {
  test('is non-localized, English, noindex and has no public chrome', async ({ page }) => {
    await signIn(page);

    const response = await page.request.get('/admin');

    expect(response.status()).toBe(200);
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    expect(response.headers()['x-robots-tag']).toContain('noai');
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(response.headers()['cache-control']).toContain('no-store');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex.*nofollow/);
    await expect(page.locator('link[rel=canonical], link[rel=alternate]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Toggle terminal' })).toHaveCount(0);
    await expect(page.getByText('Demo data')).toBeVisible();
    await expect(page.getByText(/Session · \d+ min/)).toBeVisible();
    await expect(page.getByRole('link', { name: /^Projects \d+/ })).toBeVisible();
  });

  test('warns before expiry and renews on request', async ({ page, context }) => {
    await signIn(page);

    const before = (await context.cookies()).find((item) => item.name === 'jm_session')?.value;

    await page.clock.install();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.clock.fastForward('28:30');

    const dialog = page.getByRole('dialog', {
      name: 'Your session expires soon',
    });

    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Stay signed in' }).click();
    await expect
      .poll(async () => (await context.cookies()).find((item) => item.name === 'jm_session')?.value)
      .not.toBe(before);
  });

  test('has no axe violations', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'axe runs on Chromium projects (D23)');
    await signIn(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
