#!/usr/bin/env node
// Prints the exact narration text of each variant (what the voiceover must say). Usage: node scripts/narration.mjs [A]
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/episodes/flight/index.ts', import.meta.url), 'utf8');
export function cuesOf(v) {
  const name = { A: 'A', B: 'B', C: 'Cc', D: 'D' }[v];
  const block = src.split(`const ${name}: SceneDef[]`)[1].split('\n];')[0];
  return [...block.matchAll(/\{ id: '([a-d]-[a-z0-9-]+)', text: '((?:[^'\\]|\\.)*)'/g)].map((m) => ({ id: m[1], text: m[2].replace(/\\'/g, "'") }));
}
if (process.argv[1].endsWith('narration.mjs')) for (const v of process.argv[2] ? [process.argv[2]] : ['A', 'B', 'C', 'D']) console.log(`${v}: ${cuesOf(v).map((c) => c.text).join(' ')}\n`);
