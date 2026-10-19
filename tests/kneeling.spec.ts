import { expect, test } from '@playwright/test';
import { approachDaughter } from './story-actions';

test.use({ video: 'on' });
test('kneeling lowers the camera, holds through the reply, then rises smoothly', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('home'));
  await expect(page.locator('#interaction-prompt')).toBeHidden();
  await approachDaughter(page);
  await expect(page.locator('#dialogue-context')).toBeHidden();
  await page.getByRole('button', { name: /I will carry home with me/ }).click();
  await page.getByRole('button', { name: /I don.t want to leave you either/ }).click();
  const standing = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.camera.eyeHeight);
  await page.getByRole('button', { name: /Kneel beside her/ }).click();
  await page.waitForFunction(() => {
    const state = window.__THREE_GAME_DIAGNOSTICS__!;
    return state.animation.performance === 'kneel' && state.camera.eyeHeight < 1.5 && state.camera.eyeHeight > 1.08;
  });
  await expect(page.getByRole('button', { name: /Show me.*Help her/ })).toBeVisible({ timeout: 20_000 });
  const lowered = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.camera.eyeHeight);
  expect(standing - lowered).toBeGreaterThan(0.5);
  await page.screenshot({ path: 'artifacts/kneeling/eye-level-reply.png' });
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.camera.eyeHeight)).toBeCloseTo(lowered, 2);
  await page.getByRole('button', { name: /Show me.*Help her/ }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.animation.performance), { timeout: 20_000 }).toBe('handprint');
  await expect(page.locator('#handprint-button')).toBeVisible({ timeout: 60_000 });
});
