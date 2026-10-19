import { expect, test } from '@playwright/test';
import { answerDaughter, approachDaughter } from './story-actions';

async function enter(page: import('@playwright/test').Page, state: string) {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate((next) => window.__THREE_GAME_TEST_HOOKS__!.setState(next), state);
}

test('the courtyard table is solid and blocks the player', async ({ page }) => {
  await enter(page, 'home');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.collision.blockedFrames ?? 0) > 0, undefined, { timeout: 10_000 });
  await page.keyboard.up('KeyW');
  const diagnostics = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!);
  expect(diagnostics.collision.engine).toBe('custom-aabb');
  expect(diagnostics.collision.colliders).toBeGreaterThanOrEqual(5);
  expect(diagnostics.collision.blockedFrames).toBeGreaterThan(0);
  expect(diagnostics.player.position.z).toBeGreaterThan(-0.25);
});

test('H unfolds and folds the carried handprint', async ({ page }) => {
  await enter(page, 'prison');
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toBeVisible();
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toBeHidden();
});

test('clicking outside the paper folds the carried handprint', async ({ page }) => {
  await enter(page, 'prison');
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toBeVisible();
  await page.locator('#handprint-view').evaluate((overlay) => (overlay as HTMLElement).click());
  await expect(page.locator('#handprint-view')).toBeHidden();
});

test('the handprint visibly ages by chapter', async ({ page }) => {
  test.setTimeout(180_000);
  await enter(page, 'home');
  await approachDaughter(page);
  await answerDaughter(page);
  await expect(page.locator('#handprint-button')).toBeVisible({ timeout: 90_000 });
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toHaveAttribute('data-age', 'fresh');
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toBeHidden();

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('prison'));
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toHaveAttribute('data-age', 'travelled');
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toBeHidden();
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z < -1);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#card-title')).toHaveText('YEAR 1', { timeout: 20_000 });
  await page.locator('#continue-button').click();
  await expect(page.locator('#chapter-card')).toBeHidden();
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toHaveAttribute('data-age', 'weathered');
  await page.keyboard.press('KeyH');

  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('wedding'));
  await page.keyboard.press('KeyH');
  await expect(page.locator('#handprint-view')).toHaveAttribute('data-age', 'worn');
});

test('wedding scene contains additional speaking participants', async ({ page }) => {
  await enter(page, 'wedding');
  const diagnostics = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!);
  expect(diagnostics.targetScore).toBeGreaterThanOrEqual(4);
  expect(diagnostics.animation.actors).toBeGreaterThanOrEqual(4);
});
