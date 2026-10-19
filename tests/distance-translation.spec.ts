import { expect, test } from '@playwright/test';

test('Calcutta remains grounded and the prison holds the lost years', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('calcutta'));
  await expect(page.locator('#chapter-title')).toHaveText('Made Small');
  await expect(page.locator('#chapter-nav button')).toHaveCount(4);
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.camera.eyeHeight)).toBeLessThan(1.1);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowDown');
  await page.screenshot({ path: `artifacts/distance-translation/made-small-${testInfo.project.name}.png` });

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('prison'));
  await expect(page.locator('#chapter-title')).toHaveText('The Lost Years');
  await page.screenshot({ path: `artifacts/distance-translation/prison-cell-${testInfo.project.name}.png` });
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.targetScore)).toBe(3);
  await page.keyboard.down('KeyW');
  try {
    await expect(page.locator('#interaction-text')).toContainText('window', { timeout: 30_000 });
  } finally {
    await page.keyboard.up('KeyW');
  }
  await page.keyboard.press('KeyE');
  await expect(page.locator('#chapter-card')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#card-title')).toHaveText('YEAR 1');
  await page.screenshot({ path: `artifacts/distance-translation/year-one-${testInfo.project.name}.png` });
});
