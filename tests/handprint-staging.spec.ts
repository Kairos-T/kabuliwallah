import { expect, test } from '@playwright/test';
import { answerDaughter, approachDaughter } from './story-actions';

test.use({ video: 'on' });

test('handprint has a readable approach, contact, reveal and pickup', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop cinematic motion capture.');
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => !!window.__THREE_GAME_TEST_HOOKS__);
  await page.evaluate(async () => { await window.__THREE_GAME_TEST_HOOKS__?.setState('home'); });
  await page.screenshot({ path: 'artifacts/opening-polish/courtyard.png' });
  await approachDaughter(page);
  await answerDaughter(page);
  await page.waitForFunction(() => {
    const animation = window.__THREE_GAME_DIAGNOSTICS__?.animation;
    if (animation?.performance !== 'handprint' || (animation.performanceProgress ?? 1) >= 0.1) return false;
    window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(true);
    return true;
  });
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.animation.performanceRigVisible)).toBe(false);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setPausedForScreenshot(false));
  for (const [name, progress] of [['dip', 0.25], ['contact', 0.52], ['reveal', 0.7], ['pickup', 0.84]] as const) {
    await page.waitForFunction(p => (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) >= p, progress);
    await page.evaluate(async () => { await window.__THREE_GAME_TEST_HOOKS__?.setPausedForScreenshot(true); });
    await page.screenshot({ path: `artifacts/opening-polish/${name}.png` });
    await page.evaluate(async () => { await window.__THREE_GAME_TEST_HOOKS__?.setPausedForScreenshot(false); });
  }
  await expect(page.locator('#handprint-button')).toBeVisible({ timeout: 25_000 });
  expect(errors).toEqual([]);
});
