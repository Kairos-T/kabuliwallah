import { chromium } from '@playwright/test';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const output = 'walkthrough';
const rawDestination = `${output}/kabuliwallah-walkthrough-raw.webm`;
const destination = `${output}/kabuliwallah-walkthrough.mp4`;
await mkdir(output, { recursive: true });
for (const name of await readdir(output)) {
  if (name.endsWith('.webm') || name.endsWith('.mp4')) await unlink(`${output}/${name}`);
}

const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-gl=egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({
  viewport: { width: 960, height: 540 },
  recordVideo: { dir: output, size: { width: 960, height: 540 } },
});
const page = await context.newPage();

async function choose(name, pause = 1500) {
  const button = page.getByRole('button', { name });
  await button.waitFor({ state: 'visible', timeout: 40_000 });
  await page.waitForTimeout(pause);
  await button.click();
}

async function holdUntil(key, predicate) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(predicate, undefined, { timeout: 30_000 });
  } finally {
    await page.keyboard.up(key);
  }
}

async function waitForPerformance(kind) {
  await page.waitForFunction(expected => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === expected, kind, { timeout: 40_000 });
}

await page.goto('http://127.0.0.1:5188/?recording=1');
await page.waitForLoadState('networkidle');
await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);
await page.waitForTimeout(2200);
await choose('Begin your journey', 1000);
await choose('Continue', 1800);

await holdUntil('KeyA', () => window.__THREE_GAME_DIAGNOSTICS__.player.position.x < -1.7);
await holdUntil('KeyW', () => window.__THREE_GAME_DIAGNOSTICS__.player.position.z < 0.3);
await page.keyboard.press('KeyE');
await choose(/I will carry home with me/, 2400);
await choose(/I don.t want to leave you either/, 2600);
await choose(/You have done nothing wrong/, 2600);
await choose(/Show me.*Help her/, 2600);
await waitForPerformance('handprint');
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === null, undefined, { timeout: 60_000 });
await page.waitForTimeout(1600);

await holdUntil('KeyW', () => window.__THREE_GAME_DIAGNOSTICS__.player.position.z < -4.45);
await page.keyboard.press('KeyE');
await choose(/Look back/, 2400);
await waitForPerformance('look-back');
await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.animation.performance === null, undefined, { timeout: 30_000 });
await choose('Leave reluctantly for Calcutta', 2400);
await choose('Continue', 1800);

await page.waitForTimeout(2200);
await holdUntil('KeyW', () => window.__THREE_GAME_DIAGNOSTICS__.player.position.z < -8.3);
await page.waitForTimeout(1200);
await page.keyboard.press('KeyE');
await choose('Continue', 2000);

for (const year of [1, 4, 8]) {
  await holdUntil('KeyW', () => window.__THREE_GAME_DIAGNOSTICS__.player.position.z < -1);
  await page.keyboard.press('KeyE');
  await page.locator('#card-title').waitFor({ state: 'visible', timeout: 40_000 });
  await page.waitForFunction(expected => document.querySelector('#card-title')?.textContent === `YEAR ${expected}`, year, { timeout: 40_000 });
  await page.waitForTimeout(year === 8 ? 2800 : 2200);
  await choose('Continue', 500);
}

await page.locator('#dialogue-line').filter({ hasText: 'Your time is up' }).waitFor({ state: 'visible', timeout: 40_000 });
await page.waitForTimeout(3200);
await choose('Rise and return to the door', 500);
await holdUntil('KeyS', () => window.__THREE_GAME_DIAGNOSTICS__.player.position.z > 2.9);
await page.keyboard.down('ArrowLeft');
try {
  await page.waitForFunction(() => Math.abs(window.__THREE_GAME_DIAGNOSTICS__.camera.yaw) > 2.8, undefined, { timeout: 20_000 });
} finally {
  await page.keyboard.up('ArrowLeft');
}
await page.keyboard.press('KeyE');
await waitForPerformance('door-exit');
await page.locator('#ending').waitFor({ state: 'visible', timeout: 40_000 });
await page.waitForTimeout(4500);

const video = page.video();
await page.close();
if (video) {
  const raw = await video.path();
  await video.saveAs(rawDestination);
  if (resolve(raw) !== resolve(rawDestination)) await unlink(raw).catch(() => undefined);
}
await context.close();
await browser.close();

await new Promise((resolveProcess, rejectProcess) => {
  const process = spawn(ffmpegPath, [
    '-y', '-i', rawDestination,
    '-vf', 'mpdecimate,framerate=fps=30:interp_start=0:interp_end=255:scene=100,scale=1280:720:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', destination,
  ], { stdio: 'inherit' });
  process.on('error', rejectProcess);
  process.on('exit', code => code === 0 ? resolveProcess() : rejectProcess(new Error(`ffmpeg exited with ${code}`)));
});
await unlink(rawDestination);
console.log(destination);
