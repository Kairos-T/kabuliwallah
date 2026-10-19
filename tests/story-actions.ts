import { expect, type Page } from '@playwright/test';

export async function approachDaughter(page: Page): Promise<void> {
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.x < -1.7);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.player.position.z < 0.3);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
}

export async function answerDaughter(page: Page): Promise<void> {
  await expect(page.locator('#bubble-speaker')).toHaveText('Your daughter');
  await expect(page.locator('#dialogue button')).toHaveCount(3);
  await page.getByRole('button', { name: /I will carry home with me/ }).click();
  await page.getByRole('button', { name: /I don.t want to leave you either/ }).click();
  await page.getByRole('button', { name: /You have done nothing wrong/ }).click();
  await page.getByRole('button', { name: /Show me.*Help her/ }).click({ timeout: 20_000 });
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === 'handprint');
  await expect(page.locator('#dialogue')).toBeHidden();
}

export async function passOnlooker(page: Page): Promise<void> {
  await page.keyboard.down('KeyW');
  try {
    await expect(page.locator('#bubble-speaker')).toHaveText('Onlooker', { timeout: 15_000 });
  } finally {
    await page.keyboard.up('KeyW');
  }
  await expect(page.locator('#dialogue button')).toHaveCount(3);
  await page.getByRole('button', { name: 'Keep walking', exact: true }).click();
  await page.getByRole('button', { name: 'Take a breath and continue down the street' }).click();
  await expect(page.locator('#dialogue')).toBeHidden();
}
