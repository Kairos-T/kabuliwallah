import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

type CanvasSample = {
  ok: boolean;
  reason: string;
  variance?: number;
  colorBuckets?: number;
};

async function sampleCanvas(page: import('@playwright/test').Page): Promise<CanvasSample> {
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box || box.width < 32 || box.height < 32) {
    return { ok: false, reason: 'canvas-too-small' };
  }

  const buffer = await canvas.screenshot();
  const png = PNG.sync.read(buffer);
  let min = 255;
  let max = 0;
  let alphaPixels = 0;
  const buckets = new Set<string>();
  const stride = Math.max(1, Math.floor((png.width * png.height) / 4096));

  for (let pixel = 0; pixel < png.width * png.height; pixel += stride) {
    const offset = pixel * 4;
    const r = png.data[offset];
    const g = png.data[offset + 1];
    const b = png.data[offset + 2];
    const a = png.data[offset + 3];
    min = Math.min(min, r, g, b);
    max = Math.max(max, r, g, b);
    if (a > 0) alphaPixels += 1;
    buckets.add(`${r >> 4},${g >> 4},${b >> 4},${a >> 6}`);
  }

  const variance = max - min;
  return {
    ok: alphaPixels > 256 && (variance > 8 || buckets.size > 3),
    reason: 'sampled',
    variance,
    colorBuckets: buckets.size,
  };
}

test('renders a nonblank interactive game canvas', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  await page.evaluate(async () => {
    await window.__THREE_GAME_TEST_HOOKS__?.setState('home');
  });

  const sample = await sampleCanvas(page);
  expect(sample, JSON.stringify(sample)).toMatchObject({ ok: true });

  const before = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.position.z ?? 0);

  if (testInfo.project.name.includes('mobile')) {
    const yawBefore = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.yaw ?? 0);
    const canvas = page.locator('#game-canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (canvasBox) {
      const y = canvasBox.y + canvasBox.height * 0.45;
      await canvas.dispatchEvent('pointerdown', {
        pointerId: 41,
        pointerType: 'touch',
        clientX: canvasBox.x + canvasBox.width * 0.72,
        clientY: y,
      });
      await canvas.dispatchEvent('pointermove', {
        pointerId: 41,
        pointerType: 'touch',
        clientX: canvasBox.x + canvasBox.width * 0.42,
        clientY: y,
      });
      await canvas.dispatchEvent('pointerup', {
        pointerId: 41,
        pointerType: 'touch',
        clientX: canvasBox.x + canvasBox.width * 0.42,
        clientY: y,
      });
    }
    await expect
      .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.camera.yaw ?? 0))
      .toBeGreaterThan(yawBefore + 0.15);

    const stick = page.locator('#touch-stick');
    await expect(stick).toBeVisible();
    const box = await stick.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await stick.dispatchEvent('pointerdown', { pointerId: 42, pointerType: 'touch', clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
      await stick.dispatchEvent('pointermove', { pointerId: 42, pointerType: 'touch', clientX: box.x + box.width / 2, clientY: box.y + box.height * 0.05 });
      await page.waitForTimeout(450);
      await stick.dispatchEvent('pointerup', { pointerId: 42, pointerType: 'touch', clientX: box.x + box.width / 2, clientY: box.y + box.height * 0.05 });
    }
  } else {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(450);
    await page.keyboard.up('KeyW');
  }

  await expect
    .poll(async () => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.player.position.z ?? 0))
    .toBeLessThan(before - 0.3);

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${testInfo.project.name}-game`, {
    body: screenshot,
    contentType: 'image/png',
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
