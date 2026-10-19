import { expect, test } from '@playwright/test';

test('stages stay locked until Stage 1 is pressed three times', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => localStorage.removeItem('kabuliwallah-chapters'));
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('home'));

  const stages = page.locator('#chapter-nav button');
  await expect(stages.nth(0)).toHaveAttribute('aria-disabled', 'false');
  await expect(stages.nth(1)).toHaveAttribute('aria-disabled', 'true');
  await expect(stages.nth(3)).toHaveAttribute('aria-disabled', 'true');

  await page.evaluate(() => {
    const stageOne = document.querySelectorAll<HTMLButtonElement>('#chapter-nav button')[1];
    stageOne.click();
    stageOne.click();
  });
  await expect(stages.nth(3)).toHaveAttribute('aria-disabled', 'true');
  await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>('#chapter-nav button')[1].click());

  for (let stage = 0; stage < 4; stage += 1) {
    await expect(stages.nth(stage)).toHaveAttribute('aria-disabled', 'false');
  }
  await stages.nth(3).click();
  await expect(page.locator('#chapter-title')).toHaveText('Home?');
});
