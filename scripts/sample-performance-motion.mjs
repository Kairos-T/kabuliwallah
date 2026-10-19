import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const input = 'artifacts/production-performance/motion';
const output = `${input}/frames`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true });

const clips = [
  { name: 'debt-performance', moments: [0.32, 0.44, 0.56] },
  { name: 'mini-laugh-performance', moments: [0.42, 0.62, 0.82] },
  { name: 'recognition-performance', moments: [0.38, 0.58, 0.78] },
];

for (const { name, moments } of clips) {
  if (process.argv.length > 2 && !process.argv.slice(2).includes(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(pathToFileURL(resolve(`${input}/${name}.webm`)).href);
  const video = page.locator('video');
  await video.waitFor({ state: 'visible' });
  const duration = await video.evaluate((element) => new Promise((resolveDuration) => {
    const media = element;
    const ready = () => resolveDuration(media.duration);
    if (Number.isFinite(media.duration)) ready();
    else media.addEventListener('loadedmetadata', ready, { once: true });
  }));
  for (const [index, label] of ['anticipation', 'action', 'recovery'].entries()) {
    await video.evaluate((element, time) => new Promise((resolveSeek) => {
      const media = element;
      media.currentTime = time;
      media.addEventListener('seeked', () => resolveSeek(undefined), { once: true });
    }), Math.max(0, duration * moments[index]));
    await page.screenshot({ path: `${output}/${name}-${label}.png` });
  }
  await page.close();
}

await browser.close();
