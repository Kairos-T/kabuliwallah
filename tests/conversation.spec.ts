import { expect, test } from '@playwright/test';
import { answerDaughter, approachDaughter, passOnlooker } from './story-actions';
test.use({ video: 'on' });

async function enterState(page: import('@playwright/test').Page, state: string): Promise<void> {
  await page.evaluate(async (requested) => {
    const hooks = window.__THREE_GAME_TEST_HOOKS__;
    if (!hooks) throw new Error('Missing narrative test hooks');
    await hooks.setState(requested);
  }, state);
}

async function walkForwardToZ(page: import('@playwright/test').Page, targetZ: number): Promise<void> {
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction((z) => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.z ?? Infinity) <= z, targetZ);
  } finally {
    await page.keyboard.up('KeyW');
  }
}

async function walkLeftToX(page: import('@playwright/test').Page, targetX: number): Promise<void> {
  await page.keyboard.down('KeyA');
  try {
    await page.waitForFunction((x) => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.x ?? Infinity) <= x, targetX);
  } finally {
    await page.keyboard.up('KeyA');
  }
}

test('customer and Mini speak in anchored bubbles with acted reactions', async ({ page }, testInfo) => {
  test.skip(true, 'The customer and Mini chronology was removed from the separation-focused route.');
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Keyboard encounter path is covered on desktop.');
  test.setTimeout(240_000);
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);

  await enterState(page, 'calcutta');
  await passOnlooker(page);
  await walkForwardToZ(page, 0.8);
  await walkLeftToX(page, -0.8);
  await expect(page.locator('#interaction-text')).toContainText('customer');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#speech-bubble')).toBeVisible();
  await expect(page.locator('#bubble-speaker')).toHaveText('Customer');
  await expect(page.locator('#bubble-line')).toContainText('price is too high');
  await expect(page.locator('#dialogue')).toHaveClass(/anchored/);
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.activeEmotes)).toContain('talk');
  await page.screenshot({ path: 'artifacts/character-pass/customer-dialogue.png' });
  await page.getByRole('button', { name: /Taste a few/ }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('trade');
  await expect(page.locator('#cinematic-bars')).toBeVisible();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) > 0.42);
  await page.screenshot({ path: 'artifacts/production-performance/trade.png' });

  await enterState(page, 'calcutta');
  await passOnlooker(page);
  await walkForwardToZ(page, -3.5);
  await page.keyboard.down('KeyD');
  try {
    await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.x ?? -Infinity) >= 1.6);
  } finally {
    await page.keyboard.up('KeyD');
  }
  await expect(page.locator('#interaction-text')).toContainText('Mini');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#bubble-speaker')).toHaveText('Mini’s father');
  await page.getByRole('button', { name: 'Offer nuts and raisins, without moving closer' }).click();
  await page.getByRole('button', { name: 'Give her time · several visits pass' }).click();
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('#time-wash')?.style.opacity) > 0.95);
  await page.screenshot({ path: 'artifacts/scene-staging/memory-fade.png' });
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === null);
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z)).toBeGreaterThan(-2);
  await expect(page.locator('#interaction-prompt')).toBeHidden();
  await walkForwardToZ(page, -3.5);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Offer raisins without asking payment' }).click();
  await page.getByRole('button', { name: '“An elephant!”' }).click();
  await expect(page.locator('#dialogue-line')).toContainText('father-in-law');
  await page.getByRole('button', { name: 'Listen to her quick reply' }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.activeEmotes)).toContain('laugh');
  await page.screenshot({ path: 'artifacts/character-pass/mini-laughs.png' });

  const bounds = await page.locator('#speech-bubble').boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1280);
});

test('daughter follows Rahamat to the door for a final farewell', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Keyboard encounter path is covered on desktop.');
  test.setTimeout(240_000);
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
  await enterState(page, 'home');
  await approachDaughter(page);
  await answerDaughter(page);
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('handprint');
  await expect(page.locator('#dialogue')).toBeHidden();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) > 0.42);
  await page.screenshot({ path: 'artifacts/production-performance/handprint-making.png' });
  await expect(page.locator('#handprint-button')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.down('KeyW');
  try {
    await expect(page.locator('#interaction-text')).toContainText('Leave for Calcutta', { timeout: 90_000 });
  } finally {
    await page.keyboard.up('KeyW');
  }
  await expect(page.locator('#interaction-text')).toContainText('Leave for Calcutta');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#bubble-speaker')).toHaveText('Your daughter');
  await expect(page.locator('#bubble-line')).toContainText('forget');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.activeEmotes)).toContain('reach');
  await page.screenshot({ path: 'artifacts/character-pass/farewell.png' });
});

test('the debt violence is performed in-world instead of narrated', async ({ page }, testInfo) => {
  test.skip(true, 'The debt scene is no longer part of the separation-focused playable route.');
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Keyboard encounter path is covered on desktop.');
  test.setTimeout(240_000);
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
  await enterState(page, 'debt');
  await walkForwardToZ(page, -2);
  await page.keyboard.press('KeyE');
  await expect(page.locator('#bubble-speaker')).toHaveText('The debtor');
  await expect(page.locator('#bubble-line')).toContainText('Rampuri shawl');
  await page.getByRole('button', { name: 'Point to the shawl in his hand' }).click();
  await expect(page.locator('#bubble-line')).toContainText('no account between us');
  await page.getByRole('button', { name: 'Demand payment again' }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('debt');
  await expect(page.locator('#dialogue')).toBeHidden();
  await expect(page.locator('#cinematic-bars')).toBeVisible();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) > 0.16);
  await page.evaluate(async () => window.__THREE_GAME_TEST_HOOKS__?.setPausedForScreenshot(true));
  await page.screenshot({ path: 'artifacts/production-performance/debt-shawl-dispute.png' });
  await page.evaluate(async () => window.__THREE_GAME_TEST_HOOKS__?.setPausedForScreenshot(false));
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) > 0.3);
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.activeEmotes)).toContain('struggle');
  await page.screenshot({ path: 'artifacts/production-performance/debt-scuffle.png' });
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) > 0.54);
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.activeEmotes)).toContain('recoil');
  await page.screenshot({ path: 'artifacts/production-performance/debt-impact.png' });
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) > 0.74);
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.activeEmotes)).toContain('restrain');
  await page.screenshot({ path: 'artifacts/production-performance/debt-arrest.png' });
  await expect(page.locator('#bubble-speaker')).toHaveText('Mini', { timeout: 35_000 });
  await expect(page.locator('#bubble-line')).toContainText('Kabuliwallah');
  const miniPosition = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.story.mini);
  expect(miniPosition?.visible).toBe(true);
  expect(Math.abs(miniPosition?.screenX ?? 2)).toBeLessThan(0.82);
  await page.screenshot({ path: 'artifacts/production-performance/debt-mini-interrupts.png' });
  await page.getByRole('button', { name: 'Listen to Mini' }).click();
  await expect(page.locator('#bubble-line')).toContainText('father-in-law');
  await page.getByRole('button', { name: 'Lift your bound hands' }).click();
  await expect(page.locator('#dialogue-line')).toContainText('hands are bound', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Be taken to prison' }).click({ timeout: 15_000 });
  await expect(page.locator('#chapter-card')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('#card-title')).toHaveText('The Lost Years');
});

test.describe('wedding chronology and emotional performance', () => {
test('Mini and her father visibly change across the wedding encounter', async ({ page }, testInfo) => {
  test.skip(true, 'The wedding scene is no longer part of the separation-focused playable route.');
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Keyboard encounter path is covered on desktop.');
  test.setTimeout(300_000);
  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
  await enterState(page, 'wedding');
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.story.mini?.visible)).toBe(false);
  await walkLeftToX(page, -1.45);
  await walkForwardToZ(page, -4.75);
  await expect(page.locator('#interaction-text')).not.toContainText('old joke');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#bubble-line')).toContainText('Who is it?');
  await page.getByRole('button', { name: 'Offer the old smile. “It is Rahamat, sir.”' }).click();
  await page.getByRole('button', { name: '“Last evening. I was released from jail.”' }).click({ timeout: 20_000 });
  await expect(page.locator('#dialogue button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.getByRole('button', { name: 'Return with the fruit: “Will you give these to her?”' }).click();
  await page.getByRole('button', { name: 'Refuse payment. “I too have a little girl at home.”' }).click();
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.story.mini?.visible)).toBe(false);
  await page.getByRole('button', { name: 'Unfold the worn handprint' }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('recognition');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.animation.performanceProgress ?? 0) > 0.5);
  await page.screenshot({ path: 'artifacts/production-performance/recognition.png' });
  await expect(page.locator('#bubble-line')).toContainText('Bring Mini here', { timeout: 15_000 });
  await page.screenshot({ path: 'artifacts/character-pass/father-recognises-rahamat.png' });
  await page.getByRole('button', { name: 'Wait for Mini' }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('approach-mini');
  await page.getByRole('button', { name: 'Wait for her answer' }).click({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('wedding-silence');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance), { timeout: 30_000 }).toBe('mini-departs');
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.story.mini?.visible)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance), { timeout: 60_000 }).toBe('reckoning');
  await expect(page.locator('#dialogue-context')).toHaveText('Thought', { timeout: 60_000 });
  await expect(page.locator('#dialogue-line')).toContainText('make friends with her again');
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.story.mini?.visible)).toBe(false);
  await page.screenshot({ path: 'artifacts/production-performance/Rahamat-seated-reckoning.png' });
  await page.getByRole('button', { name: 'Look up at Mini’s father' }).click();
  await expect(page.locator('#bubble-line')).toContainText('Go back to your own daughter', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Accept the money for the journey home' }).click();
  await expect(page.locator('#card-title')).toHaveText('Home?');
});
});
