import { expect, test } from '@playwright/test';
import { answerDaughter, approachDaughter } from './story-actions';

test('the handprint completes on a browser without pointer-lock support', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(`${error.message}\n${error.stack ?? ''}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console error: ${msg.text().slice(0, 200)}`);
  });
  await page.addInitScript(() => {
    delete (Element.prototype as { requestPointerLock?: unknown }).requestPointerLock;
    delete (HTMLCanvasElement.prototype as { requestPointerLock?: unknown }).requestPointerLock;
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('home'));

  await approachDaughter(page);
  await answerDaughter(page);

  await expect(page.locator('#handprint-button')).toBeVisible({ timeout: 150_000 });
  await expect(page.locator('#objective')).toHaveText('Walk to the courtyard door. She follows, hoping you will look back.');

  const frame = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0);
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0), { timeout: 20_000 }).toBeGreaterThan(frame);

  await page.evaluate(() => document.getElementById('handprint-button')!.click());
  await expect(page.locator('#handprint-view')).toBeVisible();
  await expect(page.locator('#handprint-view')).toHaveAttribute('data-age', 'fresh');
  await page.evaluate(() => document.getElementById('close-handprint')!.click());
  await expect(page.locator('#handprint-view')).toBeHidden();

  expect(errors, `page errors: ${errors.join('\n---\n')}`).toEqual([]);
});

test('touch controls drive look and interaction on coarse pointers', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'coarse-pointer only');
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('prison'));
  await expect(page.locator('#handprint-button kbd')).toBeHidden();
  await expect(page.locator('.handprint-icon')).toBeVisible();
  const handprintButton = await page.locator('#handprint-button').boundingBox();
  const interactButton = await page.locator('#touch-interact').boundingBox();
  expect(handprintButton).not.toBeNull();
  expect(handprintButton!.width).toBe(48);
  expect(handprintButton!.height).toBe(48);
  if (interactButton) {
    expect(handprintButton!.x + handprintButton!.width <= interactButton.x
      || interactButton.x + interactButton.width <= handprintButton!.x
      || handprintButton!.y + handprintButton!.height <= interactButton.y
      || interactButton.y + interactButton.height <= handprintButton!.y).toBe(true);
  }
  const prisonStick = await page.locator('#touch-stick').boundingBox();
  await page.locator('#touch-stick').dispatchEvent('pointerdown', {
    pointerId: 49,
    pointerType: 'touch',
    clientX: prisonStick!.x + prisonStick!.width / 2,
    clientY: prisonStick!.y + prisonStick!.height * 0.2,
  });
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.speed)).toBeGreaterThan(0.1);
  await page.locator('#handprint-button').click();
  await expect(page.locator('#handprint-view')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.speed)).toBeLessThanOrEqual(0.001);
  await page.locator('#handprint-view').evaluate((overlay) => (overlay as HTMLElement).click());
  await expect(page.locator('#handprint-view')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.speed)).toBeLessThanOrEqual(0.001);

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('home'));
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.locator('#touch-interact')).toBeHidden();
  await expect(page.locator('#interaction-prompt')).toBeHidden();

  const canvasBox = await page.locator('#game-canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  const y = canvasBox!.y + canvasBox!.height * 0.45;
  const yawBefore = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.yaw ?? 0);
  await page.locator('#game-canvas').dispatchEvent('pointerdown', { pointerId: 51, pointerType: 'touch', clientX: canvasBox!.x + canvasBox!.width * 0.7, clientY: y });
  await page.locator('#game-canvas').dispatchEvent('pointermove', { pointerId: 51, pointerType: 'touch', clientX: canvasBox!.x + canvasBox!.width * 0.4, clientY: y });
  await page.locator('#game-canvas').dispatchEvent('pointerup', { pointerId: 51, pointerType: 'touch', clientX: canvasBox!.x + canvasBox!.width * 0.4, clientY: y });
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.yaw ?? 0), { timeout: 20_000 }).toBeGreaterThan(yawBefore + 0.15);

  const stickBox = await page.locator('#touch-stick').boundingBox();
  const playerBefore = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position);
  await page.locator('#touch-stick').dispatchEvent('pointerdown', { pointerId: 52, pointerType: 'touch', clientX: stickBox!.x + stickBox!.width / 2, clientY: stickBox!.y + stickBox!.height * 0.25 });
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z), { timeout: 20_000 }).not.toBeCloseTo(playerBefore.z, 2);
  await page.locator('#touch-stick').dispatchEvent('pointercancel', { pointerId: 52, pointerType: 'touch', clientX: stickBox!.x + stickBox!.width / 2, clientY: stickBox!.y + stickBox!.height * 0.25 });
  await expect.poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.speed), { timeout: 15_000 }).toBeLessThanOrEqual(0.001);

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('home'));
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.x < -1.7);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z < 0.3);
  await page.keyboard.up('KeyW');
  await expect(page.locator('#touch-interact')).toBeVisible();
  await expect(page.locator('#interaction-prompt')).toBeHidden();
  await page.locator('#touch-interact').dispatchEvent('pointerdown', { pointerId: 53, pointerType: 'touch' });
  await expect(page.locator('#dialogue button')).toHaveCount(3);
  await expect(page.locator('#touch-controls')).toBeHidden();
  const cameraWhenChoicesOpen = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.camera);
  await page.waitForTimeout(500);
  const cameraAfterChoicesSettle = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.camera);
  expect(cameraAfterChoicesSettle.yaw).toBeCloseTo(cameraWhenChoicesOpen.yaw, 5);
  expect(cameraAfterChoicesSettle.pitch).toBeCloseTo(cameraWhenChoicesOpen.pitch, 5);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#game-canvas')).toHaveCSS('width', '844px');
  const dialogueBox = await page.locator('#dialogue').boundingBox();
  expect(dialogueBox).not.toBeNull();
  expect(dialogueBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogueBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogueBox!.x + dialogueBox!.width).toBeLessThanOrEqual(844);
  expect(dialogueBox!.y + dialogueBox!.height).toBeLessThanOrEqual(390);
});
