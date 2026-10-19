import { chromium } from '@playwright/test';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = 'artifacts/proper-game-pass/motion';
await mkdir(output, { recursive: true });
for (const name of await readdir(output)) {
  if (name.startsWith('page@') && name.endsWith('.webm')) await unlink(`${output}/${name}`);
}
const browser = await chromium.launch({ channel: 'chromium', headless: true });

async function finishVideo(page, context, destination) {
  const video = page.video();
  await page.close();
  if (video) {
    const raw = await video.path();
    await video.saveAs(destination);
    if (resolve(raw) !== resolve(destination)) await unlink(raw).catch(() => undefined);
  }
  await context.close();
}

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: output, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto('http://127.0.0.1:5188');
await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
await page.evaluate(async () => {
  await window.__THREE_GAME_TEST_HOOKS__?.setState('calcutta');
  await window.__THREE_GAME_TEST_HOOKS__?.setReducedMotion(false);
  await window.__THREE_GAME_TEST_HOOKS__?.setPausedForScreenshot(false);
});
await page.screenshot({ path: `${output}/calcutta-frame-0.png` });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${output}/calcutta-frame-1.png` });
await page.keyboard.down('KeyW');
await page.waitForTimeout(1800);
await page.keyboard.up('KeyW');
await page.screenshot({ path: `${output}/calcutta-walk.png` });
await page.waitForTimeout(1400);
await finishVideo(page, context, `${output}/calcutta-motion.webm`);

const transitionContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: output, size: { width: 1280, height: 720 } },
});
const transitionPage = await transitionContext.newPage();
await transitionPage.goto('http://127.0.0.1:5188');
await transitionPage.getByRole('button', { name: 'Begin the journey' }).click();
await transitionPage.waitForTimeout(1000);
await transitionPage.screenshot({ path: `${output}/chapter-card.png` });
await transitionPage.getByRole('button', { name: 'Continue' }).click();
await transitionPage.waitForTimeout(1500);
await finishVideo(transitionPage, transitionContext, `${output}/chapter-transition.webm`);
await browser.close();
