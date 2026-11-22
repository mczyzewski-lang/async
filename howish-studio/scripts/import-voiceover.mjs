#!/usr/bin/env node
// Import an externally generated narration (e.g. from the ElevenLabs app) and sync the film to it.
// Usage: node scripts/import-voiceover.mjs <A|B|C|D> <audio.mp3> <words.json> [voiceId] [modelId]
// words.json: [{ text|word, start, end }] with times in seconds (any speech-to-text word timestamps).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cuesOf } from './narration.mjs';

const [variant, audio, wordsFile, voiceId = 'imported', modelId = 'imported'] = process.argv.slice(2);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const raw = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
const words = (Array.isArray(raw) ? raw : raw.words).map((w) => ({ t: norm(w.text ?? w.word ?? ''), start: w.start, end: w.end })).filter((w) => w.t);
const cues = cuesOf(variant);
const out = {};
let wi = 0;
for (const c of cues) {
  const toks = c.text.split(/\s+/).map(norm).filter(Boolean);
  // align first and last token of the cue with a small look-ahead, tolerant of transcription slips
  const find = (tok, from) => { for (let k = from; k < Math.min(words.length, from + 6); k++) if (words[k].t === tok) return k; return -1; };
  let a = find(toks[0], wi);
  if (a < 0) a = wi;
  // last token: the match closest to where the cue should end
  const want = a + toks.length - 1;
  let b = -1;
  for (let k = Math.max(a, want - 3); k <= Math.min(words.length - 1, want + 3); k++)
    if (words[k].t === toks[toks.length - 1] && (b < 0 || Math.abs(k - want) < Math.abs(b - want))) b = k;
  if (b < 0) b = Math.min(words.length - 1, want);
  out[c.id] = { start: +words[a].start.toFixed(3), end: +words[b].end.toFixed(3) };
  wi = b + 1;
}
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio]).toString().trim());
const dir = path.resolve('public/audio/flight');
fs.mkdirSync(dir, { recursive: true });
const file = `${variant}-${voiceId.slice(0, 8)}.mp3`;
fs.copyFileSync(audio, path.join(dir, file));
fs.writeFileSync(path.join(dir, `${variant}.json`), JSON.stringify({ episodeId: 'flight', variantId: variant, text: cues.map((c) => c.text).join(' '), audioPath: `/api/audio/flight/${file}`, voiceId, modelId, speed: 1, duration: +duration.toFixed(3), cues: out, createdAt: new Date().toISOString() }, null, 2));
console.log(variant, 'duration', duration.toFixed(1), 'aligned', Object.keys(out).length, 'cues; words used', wi, '/', words.length);
for (const c of cues) console.log(' ', out[c.id].start.toFixed(2).padStart(6), out[c.id].end.toFixed(2).padStart(6), c.text.slice(0, 50));
