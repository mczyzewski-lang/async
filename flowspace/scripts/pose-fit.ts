/**
 * Dev tool: fits selected anatomical parameters of a pose state so that floor contacts and
 * alignment targets are satisfied (coordinate descent). Prints the fitted values to paste into
 * src/content/poses/states.ts. Usage: npx vite-node scripts/pose-fit.ts <specName>
 */
import * as THREE from 'three';
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_STATES } from '../src/content/poses/allStates';
import { InstructorRig } from '../src/three/rig/InstructorRig';
import { flattenPose, setPath, pose } from '../src/content/poseState';
import type { JointId, PoseDelta, PoseState } from '../src/content/types';
import { SPECS } from './pose-fit-specs';

export type Term =
  | { gap: 'handL' | 'handR' | 'footL' | 'footR'; value?: number; w?: number }
  | { vert: [JointId, JointId]; w?: number }
  | { rel: [JointId, JointId]; d: [number | null, number | null, number | null]; w?: number }
  | { abs: JointId; p: [number | null, number | null, number | null]; w?: number }
  | { dist: [JointId, JointId]; value: number; w?: number }
  | { flat: 'L' | 'R'; w?: number }
  | { comOver: 'feet' | 'footL' | 'footR' | 'hands'; w?: number };

export interface FitSpec {
  base: string;
  delta?: PoseDelta;
  free: Record<string, [number, number]>;
  terms: Term[];
}

const rig = new InstructorRig();
rig.breathingAmount = 0;
rig.enableIK = false;

function evaluate(s: PoseState, terms: Term[], verbose = false) {
  rig.setPose(s, 0);
  rig.update(0.016);
  const r = rig as unknown as { computeSamples: (cb: (s: { limb: string | null }, p: THREE.Vector3) => void) => void };
  const mins: Record<string, number> = { handL: 9, handR: 9, footL: 9, footR: 9 };
  const cent: Record<string, THREE.Vector3> = {};
  const cnt: Record<string, number> = {};
  r.computeSamples((sm, p) => {
    if (!sm.limb) return;
    if (p.y < mins[sm.limb]) mins[sm.limb] = p.y;
    cent[sm.limb] = (cent[sm.limb] ?? new THREE.Vector3()).add(p);
    cnt[sm.limb] = (cnt[sm.limb] ?? 0) + 1;
  });
  const J = (id: JointId) => rig.getJointWorld(id, new THREE.Vector3());
  let e = 0;
  const log: string[] = [];
  for (const t of terms) {
    const w = t.w ?? 1;
    let v = 0;
    if ('gap' in t) v = (mins[t.gap] - 0.012 - (t.value ?? 0)) ** 2 * 100;
    else if ('vert' in t) { const a = J(t.vert[0]); const b = J(t.vert[1]); v = ((a.x - b.x) ** 2 + (a.z - b.z) ** 2) * 100; }
    else if ('rel' in t) {
      const d = J(t.rel[0]).sub(J(t.rel[1]));
      const arr = [d.x, d.y, d.z];
      t.d.forEach((x, i) => { if (x !== null) v += (arr[i] - x) ** 2 * 100; });
    } else if ('abs' in t) {
      const d = J(t.abs);
      const arr = [d.x, d.y, d.z];
      t.p.forEach((x, i) => { if (x !== null) v += (arr[i] - x) ** 2 * 100; });
    } else if ('dist' in t) v = (J(t.dist[0]).distanceTo(J(t.dist[1])) - t.value) ** 2 * 100;
    else if ('flat' in t) {
      const a = J(`ankle${t.flat}`);
      const b = J(`toes${t.flat}`);
      v = (b.y - a.y + 0.058) ** 2 * 400;
    } else if ('comOver' in t) {
      const c = rig.getCenterOfMass();
      const tgt = new THREE.Vector3();
      const keys = t.comOver === 'feet' ? ['footL', 'footR'] : t.comOver === 'hands' ? ['handL', 'handR'] : [t.comOver];
      keys.forEach((k) => tgt.add(cent[k].clone().multiplyScalar(1 / cnt[k])));
      tgt.multiplyScalar(1 / keys.length);
      v = ((c.x - tgt.x) ** 2 + (c.z - tgt.z) ** 2) * 100;
    }
    e += v * w;
    if (verbose) log.push(`${JSON.stringify(t).slice(0, 60).padEnd(60)} ${v.toFixed(4)}`);
  }
  if (verbose) console.log(log.join('\n'));
  return e;
}

const name = process.argv[2];

/** auto:<StateName> — keeps planted limbs on the floor by adjusting the nearest joints. */
function autoSpec(state: string): FitSpec | undefined {
  const st = ALL_STATES[state];
  if (!st) return undefined;
  const fl = flattenPose(st);
  const free: Record<string, [number, number]> = {};
  const terms: Term[] = [];
  const around = (k: string, r: number) => { free[k] = [(fl[k] ?? 0) - r, (fl[k] ?? 0) + r]; };
  for (const [limb, on] of Object.entries(st.plant ?? {})) {
    if (!on) continue;
    terms.push({ gap: limb as 'handL' });
    const side = limb.endsWith('L') ? 'L' : 'R';
    if (limb.startsWith('hand')) { around(`shoulder${side}.elev`, 40); around(`shoulder${side}.plane`, 40); around(`elbow${side}`, 40); }
    else { around(`hip${side}.elev`, 30); around(`knee${side}`, 40); around(`ankle${side}.flex`, 25); }
  }
  if (process.env.PITCH) around('root.pitch', 20);
  return { base: state, free, terms };
}
const spec = name.startsWith('auto:') ? autoSpec(name.slice(5)) : SPECS[name];
if (!spec) { console.log('specs:', Object.keys(SPECS).join(', ')); process.exit(0); }
let s = pose(ALL_STATES[spec.base], spec.delta ?? {});
const keys = Object.keys(spec.free);
const flat = flattenPose(s);
let best = evaluate(s, spec.terms);
let step = 8;
for (let it = 0; it < 400 && step > 0.25; it++) {
  let improved = false;
  for (const k of keys) {
    for (const dir of [1, -1]) {
      const [lo, hi] = spec.free[k];
      const paths = k.split('|');
      const cur = flattenPose(s)[paths[0]] ?? flat[paths[0]] ?? 0;
      const nv = Math.min(hi, Math.max(lo, cur + dir * step));
      if (nv === cur) continue;
      let cand = s;
      for (const pth of paths) cand = setPath(cand, pth, nv);
      const e = evaluate(cand, spec.terms);
      if (e < best - 1e-7) { best = e; s = cand; improved = true; }
    }
  }
  if (!improved) step *= 0.5;
}
evaluate(s, spec.terms, true);
console.log('error', best.toFixed(5));
const out = flattenPose(s);
const allKeys = keys.flatMap((k) => k.split('|'));
console.log(allKeys.map((k) => `${k}=${Math.round(out[k])}`).join('  '));
if (process.env.WRITE) {
  const file = new URL('../src/content/poses/fitted.json', import.meta.url);
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, number>>;
  const target = process.env.WRITE === '1' ? spec.base : process.env.WRITE!;
  data[target] = { ...(data[target] ?? {}) };
  for (const k of allKeys) data[target][k] = Math.abs(out[k]) < 2 && k.startsWith('root.') && (k.endsWith('.x') || k.endsWith('.z')) ? Math.round(out[k] * 1000) / 1000 : Math.round(out[k]);
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('written to fitted.json →', target);
}
