/**
 * Content validation: pose data, skeleton references, camera presets, Polish text,
 * session timings, floor contacts of planted limbs and asset paths.
 * Usage: npm run validate:content
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { POSES } from '../src/content/poses';
import { validatePoses, type Issue } from '../src/content/validate';
import { generateSession, DURATION_TOLERANCE } from '../src/engine/session';
import { GOAL_ORDER } from '../src/engine/labels';
import { InstructorRig, FLOOR_Y } from '../src/three/rig/InstructorRig';
import { loadAvatarNode } from '../src/three/rig/avatarNode';
import type { ExperienceLevel } from '../src/content/types';

const issues: Issue[] = validatePoses(POSES);

// Session timings
for (const d of [10, 20, 30, 40, 50]) {
  for (const goal of GOAL_ORDER) {
    for (const level of ['newcomer', 'beginner', 'intermediate', 'advanced'] as ExperienceLevel[]) {
      const s = generateSession({ durationMin: d, goal, level, intensity: 'moderate', equipment: ['mat'], exclude: [], guidance: 'standard', novelty: 'balanced', seed: d * 7 + level.length });
      if (Math.abs(s.totalSeconds - d * 60) > DURATION_TOLERANCE) issues.push({ level: 'error', pose: 'session', message: `${d} min / ${goal} / ${level}: ${s.totalSeconds}s` });
      for (const st of s.steps) if (st.holdDuration <= 0 || st.entryDuration <= 0) issues.push({ level: 'error', pose: 'session', message: `invalid step timing ${st.poseId}` });
    }
  }
}

// Floor contacts for planted limbs (renders the rig headlessly)
await loadAvatarNode();
const rig = new InstructorRig();
rig.breathingAmount = 0;
const r = rig as unknown as { computeSamples: (cb: (s: { limb: string | null }, p: { y: number }) => void) => void };
for (const p of POSES) {
  for (const k of p.animation?.keyframes ?? []) {
    rig.setPose(k.state, 0);
    rig.update(0.016);
    rig.update(0.016);
    const mins: Record<string, number> = {};
    r.computeSamples((s, pt) => { if (s.limb) mins[s.limb] = Math.min(mins[s.limb] ?? 9, pt.y); });
    for (const [limb, on] of Object.entries(k.state.plant ?? {})) {
      if (on && mins[limb] - FLOOR_Y > 0.03) issues.push({ level: 'warning', pose: p.id, message: `keyframe ${k.id}: planted ${limb} is ${(mins[limb] - FLOOR_Y).toFixed(3)} m above the mat` });
    }
  }
}

// Asset paths referenced by the manifest / index.html
for (const a of ['public/icons/icon.svg', 'public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/icon-512-maskable.png', 'public/icons/apple-touch-icon.png']) {
  if (!existsSync(resolve(a))) issues.push({ level: 'error', pose: 'assets', message: `missing asset ${a}` });
}

const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');
for (const i of issues) console.log(`${i.level === 'error' ? '✖' : '⚠'} [${i.pose}] ${i.message}`);
const n3d = POSES.filter((p) => p.animation).length;
const nm = POSES.reduce((s, p) => s + p.commonMistakes.filter((m) => m.incorrectPoseState).length, 0);
console.log(`\n${POSES.length} poses · ${n3d} with 3D demonstrations · ${nm} mistake configurations`);
console.log(`${errors.length} errors · ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
