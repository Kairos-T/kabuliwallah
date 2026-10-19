import { expect, test } from '@playwright/test';

test('onlooker and customer step into Rahamat’s route and force their encounters', async ({ page }, info) => {
  test.skip(true, 'The chronological onlooker and customer encounters were removed from the separation-focused route.');
  test.setTimeout(90_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('calcutta'));
  await page.keyboard.down('KeyW');
  await expect(page.locator('#bubble-speaker')).toHaveText('Onlooker', { timeout: 20_000 });
  const stopped = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z);
  await expect(page.locator('#dialogue button')).toHaveCount(3);
  await expect(page.locator('#interaction-prompt')).toBeHidden();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z)).toBe(stopped);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'artifacts/directed-encounters/three-responses.png' });
  await page.getByRole('button', { name: /I am a father too/ }).click();
  await expect(page.locator('#bubble-line')).toContainText('A father?');
  await page.getByRole('button', { name: 'Let the silence answer him' }).click();
  await expect(page.locator('#dialogue-line')).toContainText('tired of needing to');
  await expect(page.locator('#inner-thought')).toBeVisible();
  await expect(page.locator('#inner-thought')).toContainText('tired of needing to');
  await expect(page.locator('#dialogue-line')).toBeHidden();
  await page.screenshot({ path: `artifacts/scene-staging/inner-thought-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Take a breath and continue down the street' }).click();
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(z => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z < z - 1, stopped);
  } finally {
    await page.keyboard.up('KeyW');
  }
  await page.keyboard.down('KeyW');
  try {
    await expect(page.locator('#bubble-speaker')).toHaveText('Customer', { timeout: 20_000 });
  } finally {
    await page.keyboard.up('KeyW');
  }
  await expect(page.locator('#bubble-line')).toContainText('raisins');
  await expect(page.locator('#dialogue button')).toHaveCount(2);
  await expect(page.locator('#interaction-prompt')).toBeHidden();
});
