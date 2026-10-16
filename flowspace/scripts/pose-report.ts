/**
 * Dev tool: prints per-state contact gaps and key joint positions after grounding.
 * Usage: npx vite-node scripts/pose-report.ts [StateName ...]
 */
import { ALL_STATES } from '../src/content/poses/allStates';
import { InstructorRig } from '../src/three/rig/InstructorRig';
import type { JointId } from '../src/content/types';

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL_STATES);
const rig = new InstructorRig();
rig.breathingAmount = 0;
const f = (n: number) => n.toFixed(2).padStart(5);
for (const name of names) {
  const s = ALL_STATES[name];
  if (!s) { console.log('missing', name); continue; }
  rig.enableIK = process.env.IK === '1';
  rig.setPose(s, 0);
  for (let i = 0; i < 3; i++) rig.update(0.016);
  const r = rig as unknown as { computeSamples: (cb: (s: { limb: string | null }, p: { y: number }) => void) => void };
  const mins: Record<string, number> = { handL: 9, handR: 9, footL: 9, footR: 9 };
  r.computeSamples((sm, p) => { if (sm.limb && p.y < mins[sm.limb]) mins[sm.limb] = p.y; });
  const j = (id: JointId) => { const v = rig.getJointWorld(id); return `${f(v.x)},${f(v.y)},${f(v.z)}`; };
  const planted = Object.entries(s.plant ?? {}).filter(([, v]) => v).map(([k]) => k);
  console.log(`${name.padEnd(24)} gaps hL${f(mins.handL)} hR${f(mins.handR)} fL${f(mins.footL)} fR${f(mins.footR)}  plant[${planted.join(',')}]`);
  if (process.env.V) {
    for (const id of (process.env.V.split(',') as JointId[])) console.log(`   ${id.padEnd(10)} ${j(id)}`);
    const com = rig.getCenterOfMass();
    console.log(`   COM        ${f(com.x)},${f(com.y)},${f(com.z)}`);
  }
}
