import { chromium } from '@playwright/test';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = 'artifacts/production-performance/motion';
await mkdir(output, { recursive: true });
for (const name of await readdir(output)) {
  if (name.startsWith('page@') && name.endsWith('.webm')) await unlink(`${output}/${name}`);
}
const browser = await chromium.launch({ channel: 'chromium', headless: true });

async function contextForVideo() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: output, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5188');
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
  return { context, page };
}

async function finish(page, context, destination) {
  const video = page.video();
  await page.close();
  if (video) {
    const raw = await video.path();
    await video.saveAs(destination);
    if (resolve(raw) !== resolve(destination)) await unlink(raw).catch(() => undefined);
  }
  await context.close();
}

async function enter(page, state) {
  await page.evaluate(async (requested) => {
    await window.__THREE_GAME_TEST_HOOKS__?.setState(requested);
    await window.__THREE_GAME_TEST_HOOKS__?.setReducedMotion(false);
    await window.__THREE_GAME_TEST_HOOKS__?.setPausedForScreenshot(false);
  }, state);
}

async function choose(page, name) {
  const button = page.getByRole('button', { name });
  await button.waitFor({ state: 'visible' });
  await button.evaluate((element) => element.click());
}

async function holdUntil(page, key, predicate) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(predicate, undefined, { timeout: 10_000 });
  } finally {
    await page.keyboard.up(key);
  }
}

{
  const { context, page } = await contextForVideo();
  await enter(page, 'debt');
  await holdUntil(page, 'KeyW', () => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.z ?? Infinity) <= -2);
  await page.keyboard.press('KeyE');
  await choose(page, 'Point to the shawl in his hand');
  await choose(page, 'Demand payment again');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === 'debt');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === null, undefined, { timeout: 35_000 });
  await choose(page, 'Listen to Mini');
  await page.waitForTimeout(800);
  await choose(page, 'Lift your bound hands');
  await page.waitForTimeout(1200);
  await finish(page, context, `${output}/debt-performance.webm`);
}

{
  const { context, page } = await contextForVideo();
  await enter(page, 'calcutta');
  await holdUntil(page, 'KeyW', () => document.querySelector('#bubble-speaker')?.textContent === 'Onlooker');
  await choose(page, 'Keep walking');
  await choose(page, 'Take a breath and continue down the street');
  await holdUntil(page, 'KeyW', () => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.z ?? Infinity) <= -3.5);
  await holdUntil(page, 'KeyD', () => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.x ?? -Infinity) >= 1.6);
  await page.keyboard.press('KeyE');
  await choose(page, 'Offer nuts and raisins, without moving closer');
  await choose(page, 'Give her time · several visits pass');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === null);
  await holdUntil(page, 'KeyW', () => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.z ?? Infinity) <= -3.5);
  await page.keyboard.press('KeyE');
  await choose(page, 'Offer raisins without asking payment');
  await choose(page, '“An elephant!”');
  await page.waitForTimeout(2100);
  await finish(page, context, `${output}/mini-laugh-performance.webm`);
}

{
  const { context, page } = await contextForVideo();
  await enter(page, 'wedding');
  await holdUntil(page, 'KeyA', () => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.x ?? Infinity) <= -1.45);
  await holdUntil(page, 'KeyW', () => (window.__THREE_GAME_DIAGNOSTICS__?.player.position.z ?? Infinity) <= -4.75);
  await page.keyboard.press('KeyE');
  await choose(page, 'Offer the old smile. “It is Rahamat, sir.”');
  await choose(page, '“Last evening. I was released from jail.”');
  await choose(page, 'Leave');
  await choose(page, 'Return with the fruit: “Will you give these to her?”');
  await choose(page, 'Refuse payment. “I too have a little girl at home.”');
  await choose(page, 'Unfold the worn handprint');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === 'recognition');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === null, undefined, { timeout: 15_000 });
  await choose(page, 'Wait for Mini');
  await choose(page, 'Wait for her answer');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === 'reckoning', undefined, { timeout: 15_000 });
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === null, undefined, { timeout: 15_000 });
  await page.screenshot({ path: 'artifacts/production-performance/Rahamat-seated-reckoning.png' });
  await choose(page, 'Look up at Mini’s father');
  await page.waitForTimeout(1000);
  await finish(page, context, `${output}/recognition-performance.webm`);
}

await browser.close();
