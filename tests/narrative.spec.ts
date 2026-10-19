import { expect, test } from '@playwright/test';
import { answerDaughter, approachDaughter } from './story-actions';

async function enterState(page: import('@playwright/test').Page, state: string): Promise<void> {
  await page.evaluate(async (requested) => {
    const hooks = window.__THREE_GAME_TEST_HOOKS__;
    if (!hooks) throw new Error('Missing narrative test hooks');
    const result = await hooks.setState(requested);
    if (result.state !== requested) throw new Error(`State mismatch: ${result.state}`);
    await hooks.setPausedForScreenshot(false);
  }, state);
}

async function walkForwardToZ(page: import('@playwright/test').Page, targetZ: number): Promise<void> {
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(
      (z) => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.z ?? Infinity) <= z,
      targetZ,
      { timeout: 15_000 },
    );
  } finally {
    await page.keyboard.up('KeyW');
  }
}

test('chapter HUD uses concise labels', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__THREE_GAME_TEST_HOOKS__));
  await page.locator('#begin-button').click();
  await expect(page.locator('#chapter-card')).toBeVisible();
  await expect(page.locator('#card-kicker')).toHaveText('PRELUDE');
  await expect(page.locator('#card-title')).toHaveText('The Promise');
  await expect(page.locator('#card-copy')).toBeHidden();
  await page.locator('#continue-button').click();
  await enterState(page, 'home');
  await expect(page.locator('#chapter-kicker')).toHaveText('PRELUDE |');
  await expect(page.locator('#chapter-title')).toHaveText('The Promise');
  await enterState(page, 'calcutta');
  await expect(page.locator('#chapter-kicker')).toHaveText('SEPARATION |');
  await expect(page.locator('#chapter-title')).toHaveText('Made Small');
});

test('real input reaches the handprint, prison years, and changed wedding joke', async ({ page }, testInfo) => {
  test.skip(true, 'Superseded by the separation-focused route; current prison progression is covered in prison-staging.spec.ts.');
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Keyboard narrative path is covered on desktop.');
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);

  await enterState(page, 'home');
  await approachDaughter(page);
  await answerDaughter(page);
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('handprint');
  await expect(page.locator('#handprint-button')).toBeVisible({ timeout: 40_000 });

  await enterState(page, 'debt');
  await walkForwardToZ(page, -2);
  await expect(page.locator('#interaction-prompt')).toBeVisible();
  await expect(page.locator('#interaction-text')).toContainText('money owed');
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Imagine walking away' }).click();
  await expect(page.locator('#dialogue-context')).toContainText('counterfactual');
  await page.getByRole('button', { name: 'Return to the remembered story' }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('debt');
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance), { timeout: 35_000 }).toBeNull();
  await expect(page.locator('#speech-bubble')).toBeVisible();
  await expect(page.locator('#bubble-speaker')).toHaveText('Mini');
  await page.getByRole('button', { name: 'Listen to Mini' }).click();
  await page.getByRole('button', { name: 'Lift your bound hands' }).click();
  await page.getByRole('button', { name: 'Be taken to prison' }).click({ timeout: 15_000 });
  await expect(page.locator('#chapter-card')).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('#card-title')).toHaveText('The Lost Years');

  await enterState(page, 'prison');
  await walkForwardToZ(page, -1);
  await expect(page.locator('#interaction-prompt')).toBeVisible();
  await expect(page.locator('#interaction-text')).toContainText('season');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#card-title')).toHaveText('YEAR 1', { timeout: 20_000 });
  await page.locator('#continue-button').click();
  await expect(page.locator('#chapter-card')).toBeHidden();
  await page.keyboard.press('KeyE');
  await expect(page.locator('#card-title')).toHaveText('YEAR 4', { timeout: 20_000 });
  await page.locator('#continue-button').click();
  await expect(page.locator('#chapter-card')).toBeHidden();
  await page.keyboard.press('KeyE');
  await expect(page.locator('#card-title')).toHaveText('YEAR 8', { timeout: 20_000 });

  await enterState(page, 'wedding');
  await page.keyboard.down('KeyA');
  try {
    await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.x ?? Infinity) <= -1.45);
  } finally {
    await page.keyboard.up('KeyA');
  }
  await walkForwardToZ(page, -4.75);
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.story.mini?.visible)).toBe(false);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Offer the old smile. “It is Rahamat, sir.”' }).click();
  await page.getByRole('button', { name: '“Last evening. I was released from jail.”' }).click({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await page.getByRole('button', { name: 'Return with the fruit: “Will you give these to her?”' }).click();
  await page.getByRole('button', { name: 'Refuse payment. “I too have a little girl at home.”' }).click();
  await page.getByRole('button', { name: 'Unfold the worn handprint' }).click();
  await page.getByRole('button', { name: 'Wait for Mini' }).click({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Wait for her answer' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Wait for her answer' }).click();
  await expect.poll(() => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance)).toBe('wedding-silence');
  await expect(page.locator('#dialogue')).toBeHidden();

  await enterState(page, 'epilogue');
  await expect(page.locator('#ending')).toBeVisible();
  await expect(page.locator('#ending')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(page.locator('#ending h2')).toHaveText('THE END');

  expect(errors).toEqual([]);
});
