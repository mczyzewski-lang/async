import { expect, type Page } from '@playwright/test';

/** Hash of the WebGL canvas pixels (preserveDrawingBuffer is enabled). */
export async function canvasSignature(page: Page, testId: string) {
  return page.evaluate((id) => {
    const c = document.querySelector(`[data-testid="${id}"] canvas`) as HTMLCanvasElement | null;
    if (!c) return null;
    const tmp = document.createElement('canvas');
    tmp.width = 64;
    tmp.height = 64;
    const ctx = tmp.getContext('2d')!;
    ctx.drawImage(c, 0, 0, 64, 64);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    let sq = 0;
    let hash = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      sum += v;
      sq += v * v;
      hash = (hash * 31 + Math.round(v / 8)) >>> 0;
    }
    const n = d.length / 4;
    return { mean: sum / n, variance: sq / n - (sum / n) ** 2, hash };
  }, testId);
}

export async function expectRendered(page: Page, testId: string) {
  await expect.poll(async () => (await canvasSignature(page, testId))?.variance ?? 0, { timeout: 30_000 }).toBeGreaterThan(50);
}

export async function rigTag(page: Page) {
  return page.getAttribute('[data-testid=rig-state]', 'data-tag');
}

export async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}
