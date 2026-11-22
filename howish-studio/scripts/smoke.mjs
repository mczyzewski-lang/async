#!/usr/bin/env node
// Browser smoke test for the lab UI. Usage: node scripts/smoke.mjs [http://localhost:5173] [screenshot-dir]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/')('playwright')); }
const base = process.argv[2] || 'http://localhost:5173';
const dir = process.argv[3];
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/GL Driver|404/.test(m.text()) && errors.push(m.text()));
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };
const secs = async () => { const [m, s] = (await page.getByTestId('time').textContent()).split(' / ')[0].split(':').map(Number); return m * 60 + s; };
const shot = async (n) => dir && page.screenshot({ path: `${dir}/smoke-${n}.png`, fullPage: true });

await page.goto(base);
await page.waitForSelector('.stage canvas');
await page.waitForFunction(() => !document.querySelector('header')?.textContent?.includes('Checking'));
check('header shows silent-preview status without a key', /silent preview|ElevenLabs/.test(await page.locator('header').textContent()));

for (const name of ['Cinematic', 'Minimal', 'Playful', 'X-Ray']) {
  await page.getByRole('tab', { name: new RegExp(name) }).click();
  await page.waitForTimeout(1200);
  const ok = await page.evaluate(() => { const c = document.querySelector('.stage canvas'); return !!c && c.width > 100 && !document.querySelector('.stage')?.textContent?.includes('Film error'); });
  check(`tab ${name} renders a film`, ok);
  await shot(name);
}
await page.getByRole('tab', { name: /Cinematic/ }).click();
await page.getByTestId('restart').click();
await page.waitForTimeout(3200);
const t1 = await secs();
check('restart + play advances time', t1 >= 2 && t1 <= 5, `(t=${t1})`);
await page.getByTestId('play').click();
const t2 = await secs();
await page.waitForTimeout(1500);
check('pause holds time', (await secs()) === t2, `(t=${t2})`);
const bar = await page.getByRole('slider', { name: 'Timeline' }).boundingBox();
await page.mouse.click(bar.x + bar.width * 0.5, bar.y + bar.height / 2);
const t3 = await secs();
check('seek via scrubber jumps to the middle', t3 > 25 && t3 < 45, `(t=${t3})`);
await page.getByTestId('scene').selectOption({ index: 2 });
const t4 = await secs();
check('scene select seeks to the scene start', t4 >= 15 && t4 <= 19, `(t=${t4})`);
await page.getByLabel('Subtitles').click();
check('subtitles can be switched off', (await page.locator('.film-sub').count()) === 0);
await page.getByLabel('Subtitles').click();
await page.getByRole('button', { name: /Generate Voiceover/ }).click();
check('voiceover panel explains the missing key (no paid call)', /ELEVENLABS_API_KEY|Regenerate|Generate \(uses credits\)/.test(await page.locator('main').textContent()));
await page.getByRole('button', { name: /Generate Voiceover/ }).click();

await page.getByRole('button', { name: /Compare Mode/ }).click();
await page.waitForTimeout(2500);
check('compare mode shows four stages', (await page.locator('.stage canvas').count()) === 4);
await page.getByTestId('play').click();
await page.waitForTimeout(2000);
await page.getByTestId('play').click();
await shot('compare');
await page.getByRole('button', { name: /Compare Mode/ }).click();

for (const [w, h] of [[390, 844], [820, 1180]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`no horizontal overflow at ${w}px`, overflow <= 1, `(overflow ${overflow}px)`);
  await shot(`w${w}`);
}
check('no page errors', errors.length === 0, errors.length ? '\n  ' + [...new Set(errors)].slice(0, 5).join('\n  ') : '');
await browser.close();
process.exit(failed ? 1 : 0);
