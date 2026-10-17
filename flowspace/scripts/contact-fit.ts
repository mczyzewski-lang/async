/**
 * Dev tool: adjusts floor poses so the body parts listed in FLOOR_CONTACTS (and planted hands/feet)
 * rest on the mat, changing joint angles as little as possible (coordinate descent with a penalty on
 * the change). Writes absolute values to src/content/poses/fitted.json.
 * Usage: npx vite-node scripts/contact-fit.ts [StateName ...]   (default: all listed states)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_STATES } from '../src/content/poses/allStates';
import { FLOOR_CONTACTS } from '../src/content/poses/contacts';
import { flattenPose, setPath } from '../src/content/poseState';
import type { PoseState } from '../src/content/types';
import { loadAvatarNode } from '../src/three/rig/avatarNode';
import { InstructorRig, FLOOR_Y } from '../src/three/rig/InstructorRig';
import { BONE_INDEX, type BoneName } from '../src/three/rig/skeleton';

await loadAvatarNode();
const rig = new InstructorRig();
rig.breathingAmount = 0;
rig.enableIK = false;
rig.settle = true; // same balance logic as the app
const partMins = () => (rig as unknown as { partMins: () => { y: Float32Array } }).partMins().y;

const SLACK = 0.012; // a part within 12 mm of the mat counts as resting on it (natural spinal curves)
function cost(s: PoseState, parts: BoneName[], orig: Record<string, number>, keys: string[]) {
  rig.setPose(s, 0);
  rig.update(0.016);
  const m = partMins();
  let e = 0;
  for (const p of parts) e += Math.max(0, m[BONE_INDEX[p]] - FLOOR_Y - SLACK) ** 2 * 100;
  const f = flattenPose(s);
  for (const k of keys) e += 0.0025 * ((f[k.split('|')[0]] - orig[k.split('|')[0]]) / 30) ** 2;
  return e;
}

const PARAMS = [
  'root.pitch', 'spine.flex', 'chest.flex', 'neck.flex', 'head.flex',
  'hip?.elev', 'hip?.plane', 'knee?', 'ankle?.flex', 'shoulder?.elev', 'shoulder?.plane', 'elbow?', 'wrist?.flex',
];

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FLOOR_CONTACTS);
const file = new URL('../src/content/poses/fitted.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, number>>;

for (const name of names) {
  const base = ALL_STATES[name];
  if (!base) continue;
  const plants = Object.entries(base.plant ?? {}).filter(([, v]) => v).map(([k]) => k as BoneName);
  const parts = [...new Set([...(FLOOR_CONTACTS[name] ?? []), ...plants])];
  const orig = flattenPose(base);
  // left/right pairs with equal values move together (keeps symmetric poses symmetric)
  const keys: string[] = [];
  for (const p of PARAMS) {
    if (!p.includes('?')) {
      if (p in orig) keys.push(p);
      continue;
    }
    const l = p.replace('?', 'L');
    const r = p.replace('?', 'R');
    if (!(l in orig)) continue;
    if (Math.abs(orig[l] - orig[r]) < 0.01) keys.push(`${l}|${r}`);
    else keys.push(l, r);
  }
  const range = (k: string): [number, number] => {
    const v = orig[k.split('|')[0]];
    if (k.startsWith('ankle')) return [Math.max(-75, v - 60), Math.min(45, v + 40)];
    if (k.startsWith('knee')) return [Math.max(0, v - 40), Math.min(160, v + 40)];
    if (k.startsWith('root')) return [v - 30, v + 30];
    return [v - 35, v + 35];
  };
  let s = base;
  let best = cost(s, parts, orig, keys);
  const before = best;
  for (let step = 8; step >= 0.5; step /= 2) {
    let improved = true;
    for (let it = 0; it < 30 && improved; it++) {
      improved = false;
      for (const k of keys) {
        const [lo, hi] = range(k);
        for (const dir of [1, -1]) {
          const cur = flattenPose(s)[k.split('|')[0]];
          const nv = Math.min(hi, Math.max(lo, cur + dir * step));
          if (nv === cur) continue;
          let cand = s;
          for (const pth of k.split('|')) cand = setPath(cand, pth, nv);
          const e = cost(cand, parts, orig, keys);
          if (e < best - 1e-9) {
            best = e;
            s = cand;
            improved = true;
          }
        }
      }
    }
  }
  rig.setPose(s, 0);
  rig.update(0.016);
  const m = partMins();
  const gaps = parts.map((p) => `${p}:${Math.round((m[BONE_INDEX[p]] - FLOOR_Y) * 1000)}mm`).join(' ');
  const f = flattenPose(s);
  const changed = keys.flatMap((k) => k.split('|')).filter((k) => Math.abs(f[k] - orig[k]) > 0.01);
  console.log(`${name.padEnd(22)} ${before.toFixed(4)} → ${best.toFixed(4)}  ${gaps}`);
  console.log(`   ${changed.map((k) => `${k} ${Math.round(orig[k])}→${Math.round(f[k])}`).join(', ')}`);
  // store every fitted angle (not just the changed ones): states derived from a refitted parent
  // would otherwise inherit its new values
  data[name] = { ...(data[name] ?? {}) };
  for (const k of keys.flatMap((x) => x.split('|'))) data[name][k] = Math.round(f[k] * 10) / 10;
}
writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
