import { expect, test } from '@playwright/test';

test('characters and environment animate in live play', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
  await page.evaluate(async () => {
    await window.__THREE_GAME_TEST_HOOKS__?.setState('calcutta');
    await window.__THREE_GAME_TEST_HOOKS__?.setPausedForScreenshot(false);
    await window.__THREE_GAME_TEST_HOOKS__?.setReducedMotion(false);
  });

  const initial = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation);
  expect(initial?.actors).toBeGreaterThanOrEqual(4);
  expect(initial?.ambient).toBeGreaterThanOrEqual(2);
  await page.waitForFunction(
    (start) => Math.abs((window.__THREE_GAME_DIAGNOSTICS__?.animation.sampleArm ?? start) - start) > 0.012,
    initial?.sampleArm ?? 0,
    { timeout: 12_000 },
  );
});

test('opening uses staged cinematic transitions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin your journey' }).click();
  await expect(page.locator('#title-screen')).toHaveClass(/title-leave/);
  await expect(page.locator('#chapter-card')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('#chapter-card')).toHaveClass(/card-enter/);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#chapter-card')).toBeHidden({ timeout: 3_000 });
  await expect(page.locator('#chapter-hud')).toBeVisible();
});
