#!/usr/bin/env node
// Deterministic frame-by-frame export: Chromium seeks the film to each frame time,
// screenshots the stage (3D canvas + DOM overlays), and pipes frames into FFmpeg (H.264 MP4).
// Usage: node scripts/render.mjs --variant A [--url http://localhost:5173] [--aspect 16:9|9:16]
//        [--height 1080] [--fps 30] [--from 0] [--to 12] [--out exports/a.mp4] [--no-subs]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));
const variant = args.variant || 'A';
const base = args.url || 'http://localhost:5173';
const aspect = args.aspect || '16:9';
const fps = Number(args.fps || 30);
const H = Number(args.height || 1080);
const [aw, ah] = aspect.split(':').map(Number);
const longSide = Math.round((H * 16) / 9 / 2) * 2;
const width = aw >= ah ? longSide : H;
const height = aw >= ah ? H : longSide;
const out = path.resolve(args.out || `exports/howish-${variant}-${aspect.replace(':', 'x')}.mp4`);
fs.mkdirSync(path.dirname(out), { recursive: true });

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  try { ({ chromium } = createRequire('/')('playwright')); } catch {
    console.error('Playwright is required for export: npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
}

// Uses the GPU when Chromium can; falls back to software WebGL (slow but identical output). HOWISH_GL=software forces it.
const glArgs = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu'];
if (process.env.HOWISH_GL === 'software') glArgs.push('--use-angle=swiftshader');
const browser = await chromium.launch({ args: glArgs, executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${base}/?render=${variant}&aspect=${aspect}${args['no-subs'] ? '&subs=0' : ''}`);
await page.waitForFunction(() => window.__howish?.ready, null, { timeout: 60000 });
const info = await page.evaluate(() => ({ duration: window.__howish.duration, audio: window.__howish.audioPath }));
const from = Number(args.from || 0);
const to = Math.min(info.duration, Number(args.to || info.duration));
const frames = Math.round((to - from) * fps);

let audioFile = null;
if (info.audio) {
  const local = path.resolve('public/audio', info.audio.replace(/^\/api\/audio\//, ''));
  if (fs.existsSync(local)) audioFile = local;
}
const ff = ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
if (audioFile) ff.push('-ss', String(from), '-i', audioFile);
ff.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart');
if (audioFile) ff.push('-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-shortest');
ff.push('-t', String(frames / fps), out);
const ffmpeg = spawn('ffmpeg', ff, { stdio: ['pipe', 'ignore', 'pipe'] });
let fferr = '';
ffmpeg.stderr.on('data', (d) => (fferr = (fferr + d).slice(-1500)));
const done = new Promise((res) => ffmpeg.on('close', res));

const cdp = await page.context().newCDPSession(page);
console.log(`Rendering ${variant} ${width}x${height}@${fps} — ${frames} frames, audio: ${audioFile ? 'yes' : 'none'}`);
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.__howish.seek(t), from + i / fps);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
  const buf = Buffer.from(shot.data, 'base64');
  if (!ffmpeg.stdin.write(buf)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  if (i % 15 === 0 || i === frames - 1) console.log(`PROGRESS ${i + 1}/${frames}`);
}
ffmpeg.stdin.end();
const code = await done;
await browser.close();
if (code !== 0) { console.error(fferr); process.exit(1); }
console.log(`Wrote ${out}`);
