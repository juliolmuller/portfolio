import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

import { openWithShortcut } from './hydration';

const SHORTCUT = 'Control+/';

// Reduced motion makes transitions instant and keeps WebKit's actionability
// check from waiting on the looping hero (D36).
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const windowOf = (page: Page): Locator => page.locator('[data-window=terminal]');
const toolbarOf = (page: Page): Locator => page.getByRole('toolbar', { name: 'Window controls' });

async function box(
  locator: Locator,
): Promise<{ height: number; width: number; x: number; y: number }> {
  const result = await locator.boundingBox();

  if (!result) throw new Error('element has no box');

  return result;
}

async function openTerminal(page: Page): Promise<void> {
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  // The shortcut listener attaches after hydration; a press before that is a no-op.
  await openWithShortcut(page, windowOf(page));
  await expect(windowOf(page)).toBeVisible();
}

async function dragTitleBar(
  page: Page,
  offsetX: number,
  to: { dx?: number; dy?: number; x?: number; y?: number },
) {
  const bar = await box(toolbarOf(page));
  const fromX = bar.x + offsetX;
  const fromY = bar.y + bar.height / 2;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(to.x ?? fromX + (to.dx ?? 0), to.y ?? fromY + (to.dy ?? 0), {
    steps: 8,
  });

  return (): Promise<void> => page.mouse.up();
}

test.describe('desktop window', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'covered by the bottom sheet tests');
  });

  test('stays unmounted until opened and never blocks the page', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(windowOf(page)).toHaveCount(0);

    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Same page: navigating again would compare two different loads.
    await openWithShortcut(page, windowOf(page));
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(page.getByRole('textbox', { name: /Command input/ })).toBeFocused();
    await page.mouse.move(100, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(windowOf(page)).toBeVisible();
  });

  test('opens bottom-right at 640×420 with a 24px margin', async ({ page }) => {
    await openTerminal(page);

    const viewport = page.viewportSize()!;
    const rect = await box(windowOf(page));

    expect(rect.width).toBe(640);
    expect(rect.height).toBe(420);
    expect(rect.x + rect.width).toBe(viewport.width - 24);
    expect(rect.y + rect.height).toBe(viewport.height - 24);
  });

  test('drags by the title bar and clamps below the header', async ({ page }) => {
    await openTerminal(page);

    const before = await box(windowOf(page));
    const release = await dragTitleBar(page, 120, { dx: -200, dy: -100 });

    await release();
    await expect.poll(async () => (await box(windowOf(page))).x).toBe(before.x - 200);
    expect((await box(windowOf(page))).y).toBe(before.y - 100);

    const up = await dragTitleBar(page, 120, { dy: -400 });

    await up();
    // Header is 64px high at this width.
    await expect.poll(async () => (await box(windowOf(page))).y).toBe(64);
  });

  test('keeps 96px of the title bar on screen', async ({ page }) => {
    await openTerminal(page);

    const viewport = page.viewportSize()!;
    // Far below the clamp but inside the viewport: Firefox reports no moves
    // for a synthetic pointer outside it.
    const release = await dragTitleBar(page, 120, { y: viewport.height - 1 });

    await release();
    await expect.poll(async () => (await box(windowOf(page))).y).toBe(viewport.height - 40);
  });

  test('resizes from a corner with the opposite corner anchored', async ({ page }) => {
    await openTerminal(page);

    const before = await box(windowOf(page));
    const handle = await box(page.locator('[data-resize=nw]'));
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 100, y - 60, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await box(windowOf(page))).width).toBe(before.width + 100);

    const after = await box(windowOf(page));

    expect(after.height).toBe(before.height + 60);
    expect(after.x + after.width).toBe(before.x + before.width);
    expect(after.y + after.height).toBe(before.y + before.height);
  });

  test('never shrinks below 360×240', async ({ page }) => {
    await openTerminal(page);

    const handle = await box(page.locator('[data-resize=se]'));
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 500, y - 300, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await box(windowOf(page))).width).toBe(360);
    expect((await box(windowOf(page))).height).toBe(240);
  });

  test('snaps to the left, right and top edges', async ({ page }) => {
    await openTerminal(page);

    const viewport = page.viewportSize()!;

    let release = await dragTitleBar(page, 120, { x: 2, y: 300 });

    await expect(page.locator('[data-snap-preview=left]')).toBeVisible();
    await release();
    await expect(page.locator('[data-snap-preview]')).toHaveCount(0);
    await expect
      .poll(async () => box(windowOf(page)))
      .toEqual({
        x: 0,
        y: 64,
        width: viewport.width / 2,
        height: viewport.height - 64,
      });

    release = await dragTitleBar(page, 120, { x: viewport.width - 2, y: 300 });
    await expect(page.locator('[data-snap-preview=right]')).toBeVisible();
    await release();
    await expect.poll(async () => (await box(windowOf(page))).x).toBe(viewport.width / 2);

    release = await dragTitleBar(page, 120, { x: viewport.width / 2, y: 2 });
    await expect(page.locator('[data-snap-preview=top]')).toBeVisible();
    await release();
    await expect(toolbarOf(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore terminal' })).toBeVisible();
  });

  test('the snap preview holds near the edge and disarms away from it', async ({ page }) => {
    await openTerminal(page);

    const viewport = page.viewportSize()!;
    const before = await box(windowOf(page));
    const overlay = page.locator('[data-snap-overlay=terminal]');

    const release = await dragTitleBar(page, 120, { x: 2, y: 300 });

    await expect(overlay).toHaveAttribute('data-snap-preview', 'left');
    await expect
      .poll(async () => box(overlay))
      .toEqual({
        x: 0,
        y: 64,
        width: viewport.width / 2,
        height: viewport.height - 64,
      });
    // Hysteresis: a pointer just past the arming threshold keeps it armed.
    await page.mouse.move(24, 300, { steps: 2 });
    await expect(overlay).toHaveAttribute('data-snap-preview', 'left');
    await page.mouse.move(viewport.width / 2, 300, { steps: 4 });
    await expect(overlay).not.toHaveAttribute('data-snap-preview');
    await expect(overlay).toBeHidden();
    await release();
    await expect.poll(async () => (await box(windowOf(page))).width).toBe(before.width);
  });

  test('the snap preview animates unless motion is reduced', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openTerminal(page);

    const overlay = page.locator('[data-snap-overlay=terminal]');
    const duration = (): Promise<string> =>
      overlay.evaluate((el) => getComputedStyle(el).transitionDuration);

    expect(await duration()).toMatch(/^0\.2s/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(parseFloat(await duration())).toBeLessThan(0.01);
  });

  test('Escape cancels a drag', async ({ page }) => {
    await openTerminal(page);

    const before = await box(windowOf(page));
    const release = await dragTitleBar(page, 120, { dx: -300, dy: -100 });

    await page.keyboard.press('Escape');
    await release();
    await expect.poll(async () => (await box(windowOf(page))).x).toBe(before.x);
    expect((await box(windowOf(page))).y).toBe(before.y);
  });

  test('maximizes and restores with the button and a double click', async ({ page }) => {
    await openTerminal(page);

    const viewport = page.viewportSize()!;
    const before = await box(windowOf(page));

    await page.getByRole('button', { name: 'Maximize terminal' }).click();
    await expect
      .poll(async () => box(windowOf(page)))
      .toEqual({
        x: 0,
        y: 64,
        width: viewport.width,
        height: viewport.height - 64,
      });

    await page.getByRole('button', { name: 'Restore terminal' }).click();
    await expect.poll(async () => box(windowOf(page))).toEqual(before);

    const bar = await box(toolbarOf(page));

    await page.mouse.dblclick(bar.x + 120, bar.y + bar.height / 2);
    await expect.poll(async () => (await box(windowOf(page))).width).toBe(viewport.width);
  });

  test('minimizes to the dock chip and restores from it', async ({ page }) => {
    await openTerminal(page);
    await page.getByRole('button', { name: 'Minimize terminal' }).click();
    await expect(windowOf(page)).toHaveAttribute('data-status', 'minimized');
    await expect(windowOf(page)).toBeHidden();

    const dock = page.getByRole('button', { name: 'terminal (minimized)' });

    await expect(dock).toBeVisible();
    await dock.click();
    await expect(windowOf(page)).toHaveAttribute('data-status', 'open');
    await expect(windowOf(page)).toBeVisible();
  });

  test('the dock chip appears from 640 px', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'one engine is enough for the breakpoint');

    const chip = page.getByRole('button', { name: 'terminal', exact: true });

    await page.setViewportSize({ width: 639, height: 800 });
    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(chip).toBeHidden();
    await page.setViewportSize({ width: 640, height: 800 });
    await expect(chip).toBeVisible();
  });

  test('the shortcut opens, minimizes and restores', async ({ page }) => {
    await openTerminal(page);
    await page.keyboard.press(SHORTCUT);
    await expect(windowOf(page)).toHaveAttribute('data-status', 'minimized');
    await page.keyboard.press(SHORTCUT);
    await expect(windowOf(page)).toHaveAttribute('data-status', 'open');
  });

  test('closes, then reopens from the dock chip', async ({ page }) => {
    await openTerminal(page);
    await page.getByRole('button', { name: 'Close terminal' }).click();
    await expect(windowOf(page)).toHaveAttribute('data-status', 'closed');
    await expect(windowOf(page)).toBeHidden();
    await page.getByRole('button', { name: 'terminal', exact: true }).click();
    await expect(windowOf(page)).toBeVisible();
  });

  test('blurs when the page is clicked', async ({ page }) => {
    await openTerminal(page);
    await expect(windowOf(page).locator('> div')).toHaveAttribute('data-focused', 'true');
    await page.mouse.click(40, 300);
    await expect(windowOf(page).locator('> div')).toHaveAttribute('data-focused', 'false');
  });

  test('moves and resizes from the keyboard', async ({ page }) => {
    await openTerminal(page);

    const before = await box(windowOf(page));

    await toolbarOf(page).focus();

    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await box(windowOf(page))).x).toBe(before.x - 16);
    await page.keyboard.press('Shift+ArrowUp');
    await expect.poll(async () => (await box(windowOf(page))).y).toBe(before.y - 64);
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(async () => (await box(windowOf(page))).width).toBe(before.width + 16);
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(async () => (await box(windowOf(page))).height).toBe(before.height + 16);
  });

  test('persists geometry across a reload', async ({ page }) => {
    await openTerminal(page);

    const before = await box(windowOf(page));

    await toolbarOf(page).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await box(windowOf(page))).x).toBe(before.x - 32);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(windowOf(page)).toHaveAttribute('data-status', 'open');
    await expect.poll(async () => box(windowOf(page))).toEqual({ ...before, x: before.x - 32 });
  });

  test('survives client-side navigation', async ({ page }) => {
    await openTerminal(page);
    await page.locator('footer a[href="/en/accessibility"]').click();
    await expect(page).toHaveURL(/\/en\/accessibility$/);
    await expect(windowOf(page)).toHaveAttribute('data-status', 'open');
    await expect(windowOf(page)).toBeVisible();
  });

  test('has no axe violations with the window open', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'axe runs on Chromium projects (D23)');
    await openTerminal(page);
    await windowOf(page).evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
    );

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude('[data-reveal=pending]')
      .analyze();

    expect(results.violations).toEqual([]);
  });
});

test.describe('mobile bottom sheet', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'desktop projects cover the floating window');
  });

  test('is a full-width sheet without resize handles or maximize', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' });

    const scrollBefore = await page.evaluate(() => window.scrollY);

    await openTerminal(page);

    const viewport = page.viewportSize()!;
    const rect = await box(windowOf(page));

    expect(rect.width).toBe(viewport.width);
    expect(rect.y + rect.height).toBe(viewport.height);
    expect(rect.height / viewport.height).toBeCloseTo(0.45, 1);
    await expect(page.locator('[data-resize]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Maximize terminal' })).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });

  test('the grab handle toggles between 45% and 85% height', async ({ page }) => {
    await openTerminal(page);

    const viewport = page.viewportSize()!;
    const handle = page.getByRole('button', {
      name: 'Change terminal height',
    });

    await handle.click();
    await expect
      .poll(async () => (await box(windowOf(page))).height / viewport.height)
      .toBeCloseTo(0.85, 1);
    await handle.click();
    await expect
      .poll(async () => (await box(windowOf(page))).height / viewport.height)
      .toBeCloseTo(0.45, 1);
  });

  test('minimize and close remain available', async ({ page }) => {
    await openTerminal(page);
    await page.getByRole('button', { name: 'Minimize terminal' }).click();
    await expect(windowOf(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'terminal (minimized)' })).toBeHidden();
    await page.getByRole('button', { name: 'Toggle terminal' }).click();
    await expect(windowOf(page)).toBeVisible();
    await expect(windowOf(page)).toHaveAttribute('data-status', 'open');
    await page.getByRole('button', { name: 'Close terminal' }).click();
    await expect(windowOf(page)).toBeHidden();
  });

  test('hides the dock chip in every state', async ({ page }) => {
    const chip = page.getByRole('button', { name: 'terminal', exact: true });
    const minimized = page.getByRole('button', { name: 'terminal (minimized)' });

    await page.goto('/en', { waitUntil: 'domcontentloaded' });
    await expect(chip).toBeHidden();
    await openWithShortcut(page, windowOf(page));
    await page.getByRole('button', { name: 'Minimize terminal' }).click();
    await expect(windowOf(page)).toBeHidden();
    await expect(minimized).toBeHidden();
    await expect(chip).toBeHidden();
    await page.getByRole('button', { name: 'Toggle terminal' }).click();
    await page.getByRole('button', { name: 'Close terminal' }).click();
    await expect(windowOf(page)).toBeHidden();
    await expect(chip).toBeHidden();
  });

  test('has no axe violations as a sheet', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'axe runs on Chromium projects (D23)');
    await openTerminal(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .exclude('[data-reveal=pending]')
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
