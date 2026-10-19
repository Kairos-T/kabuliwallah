import { expect, test } from '@playwright/test';

test('Calcutta residents turn toward Rahamat and use the established speech-bubble style', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('calcutta'));

  await expect.poll(
    () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.animation.crowdFacingPlayer),
    { timeout: 30_000 },
  ).toBeGreaterThanOrEqual(4);
  await expect(page.locator('.murmur').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(7_000);
  await expect(page.locator('.murmur').first()).toBeVisible();

  const styles = await page.evaluate(() => {
    const bubble = getComputedStyle(document.querySelector('#speech-bubble')!);
    const murmur = getComputedStyle(document.querySelector('.murmur')!);
    return {
      bubbleBackground: bubble.backgroundColor,
      murmurBackground: murmur.backgroundColor,
      bubbleColor: bubble.color,
      murmurColor: murmur.color,
      bubbleRadius: bubble.borderRadius,
      murmurRadius: murmur.borderRadius,
    };
  });
  expect(styles.murmurBackground).toBe(styles.bubbleBackground);
  expect(styles.murmurColor).toBe(styles.bubbleColor);
  expect(styles.murmurRadius).toBe(styles.bubbleRadius);

  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z < 1);
  await page.keyboard.up('KeyW');
  await expect(page.locator('.murmur').first()).toBeHidden();
  await expect(page.locator('#handprint-heading')).toHaveCount(0);
  await expect(page.locator('#handprint-memory')).toHaveCount(0);
});
