import { expect, test } from '@playwright/test';
test.use({ video: 'on' });

test('the locked door handle rattles before release', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('prison'));
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z > 2.9);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => Math.abs(window.__THREE_GAME_DIAGNOSTICS__!.camera.yaw) > 2.8);
  await page.keyboard.up('ArrowLeft');
  await expect(page.locator('#interaction-text')).toHaveText('Try the locked door');
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.animation.performance)).toBe('door-rattle');
  await expect(page.locator('#dialogue-line')).toContainText('door shudders', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Return to the silence' }).click();
  await expect(page.locator('#interaction-prompt')).toBeHidden();
});

test('prison bench holds a seated view and waiting brightens the sky', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('prison'));
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.prisonDaylight)).toBe(0);
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z > 2.7);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() => {
    if (window.__THREE_GAME_DIAGNOSTICS__!.player.position.x >= -1.1) return false;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'a', bubbles: true }));
    return true;
  });
  await page.keyboard.up('KeyA');
  await expect(page.locator('#interaction-text')).toContainText('bench');
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Sit with the silence' }).waitFor({ timeout: 20_000 });
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.camera.eyeHeight)).toBeCloseTo(0.96, 2);
  await page.screenshot({ path: 'artifacts/scene-staging/prison-night.png' });
  await page.getByRole('button', { name: 'Sit with the silence' }).click();
  await expect(page.getByRole('button', { name: 'Stand up', exact: true })).toBeVisible({ timeout: 25_000 });
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.prisonDaylight)).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/scene-staging/prison-paler.png' });
  await page.getByRole('button', { name: 'Stand up', exact: true }).click();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.animation.performance === null);
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.camera.eyeHeight)).toBeCloseTo(1.62, 1);
  await expect(page.locator('#interaction-prompt')).toBeHidden();
});

test('prison years pass at the barred window', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('prison'));
  for (const year of [1, 4, 8]) {
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z < -1);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyE');
    await expect(page.locator('#card-title')).toHaveText(`YEAR ${year}`, { timeout: 20_000 });
    await expect(page.locator('#chapter-card')).toHaveClass(/year-card/);
    await expect(page.locator('#dialogue')).toBeHidden();
    if (year === 4) await page.screenshot({ path: 'artifacts/scene-staging/year-four.png' });
    await page.locator('#continue-button').click();
    if (year !== 8) await expect(page.locator('#objective')).toContainText('The cell remains', { timeout: 15_000 });
  }
  await expect(page.locator('#speaker-name')).toHaveText('Prison guard', { timeout: 15_000 });
  await expect(page.locator('#dialogue-line')).toContainText('Your time is up');
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.prisonReleased)).toBe(true);
  await page.getByRole('button', { name: 'Rise and return to the door' }).click();
  await expect(page.locator('#interaction-prompt')).toBeHidden();

  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z > 2.9);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.x < -1.1);
  await page.keyboard.up('KeyA');
  await expect(page.locator('#interaction-prompt')).toBeHidden();
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.x > 0.7);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => Math.abs(window.__THREE_GAME_DIAGNOSTICS__!.camera.yaw) > 2.8);
  await page.keyboard.up('ArrowLeft');
  await expect(page.locator('#interaction-text')).toHaveText('Try the locked door again');
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.animation.performance)).toBe('door-exit');
  await expect(page.locator('#dialogue')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.story.exitingRahamat?.visible), { timeout: 20_000 }).toBe(true);
  await expect(page.locator('#ending')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#ending')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('#ending h2')).toHaveText('THE END');
});
