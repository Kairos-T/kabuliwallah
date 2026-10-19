import { test, expect } from '@playwright/test';
import { approachDaughter, answerDaughter } from './story-actions';

test('capture supported handprint and pickup', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(process.env.HANDPRINT_CAPTURE_URL ?? '/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('home'));
  await approachDaughter(page);
  await answerDaughter(page);
  for (const [name, progress] of [['contact', 0.45], ['pickup', 0.9]] as const) {
    await page.waitForFunction(p => {
      if (window.__THREE_GAME_DIAGNOSTICS__?.animation.performance !== 'handprint' || (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) < p) return false;
      window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
      return true;
    }, progress);
    await page.screenshot({ path: `artifacts/handprint-${name}.png` });
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  }
  await expect(page.locator('#handprint-button')).toBeVisible({ timeout: 30_000 });
});
