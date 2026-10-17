/**
 * Dev tool: plays generated practice sessions through the real rig and director (30 fps) and reports
 * how far body parts that rest on the mat at both ends of a movement hover above it mid-movement.
 * Usage: npx vite-node scripts/motion-report.ts [--no-settle]
 */
import { loadAvatarNode } from '../src/three/rig/avatarNode';
import { InstructorRig, FLOOR_Y } from '../src/three/rig/InstructorRig';
import { PoseDirector } from '../src/three/director';
import { generateSession } from '../src/engine/session';
import { getPose } from '../src/content/poses';
import { GOAL_ORDER } from '../src/engine/labels';
import { BONE_INDEX } from '../src/three/rig/skeleton';

await loadAvatarNode();
const rig = new InstructorRig();
rig.settle = !process.argv.includes('--no-settle');
const director = new PoseDirector(rig);
const mins = () => (rig as unknown as { partMins: () => { y: Float32Array } }).partMins().y;

const worst: Array<{ hover: number; where: string; part: string }> = [];
let frames = 0;
let hoverFrames = 0;
let sumHover = 0;
let unsupportedFrames = 0;

function run(where: string) {
  let done = false;
  const tag = { v: '' };
  for (let f = 0; f < 30 * 40 && !done; f++) {
    rig.update(1 / 30);
    if (rig.status === 'holding' && (rig as unknown as { queue: unknown[] }).queue.length === 0) done = f > 3;
    tag.v = rig.currentTag;
    const m = mins();
    let maxH = 0;
    let part = '';
    for (const p of rig.persist) {
      const h = m[BONE_INDEX[p]] - FLOOR_Y;
      if (h > maxH) {
        maxH = h;
        part = p;
      }
    }
    // real lowest point vs floor (penetration check uses absolute positions)
    frames++;
    if (rig.getCenterOfMass().y < 0.8 && rig.supportGap() > 0.04) unsupportedFrames++;
    if (maxH > 0.03) hoverFrames++;
    sumHover += maxH;
    if (rig.status === 'moving') worst.push({ hover: maxH, where: `${where} ${tag.v}`, part });
  }
}

for (const goal of GOAL_ORDER.slice(0, 6)) {
  for (const level of ['beginner', 'intermediate'] as const) {
    const s = generateSession({ durationMin: 20, goal, level, intensity: 'moderate', seed: 7, exclude: [], equipment: ['mat'], guidance: 'standard', novelty: 'balanced' });
    rig.setPose(getPose(s.steps[0].poseId)!.animation!.keyframes[0].state, 0);
    for (let i = 0; i < s.steps.length; i++) {
      const st = s.steps[i];
      const p = getPose(st.poseId)!;
      if (!p.animation) continue;
      director.playEntry(p, st.side as never);
      run(`${goal}/${level} #${i} ${p.id}`);
      const nx = s.steps[i + 1];
      if (nx && nx.poseId !== st.poseId) {
        director.playExit(p, st.side as never);
        run(`${goal}/${level} #${i} exit ${p.id}`);
      }
    }
  }
}
worst.sort((a, b) => b.hover - a.hover);
const seen = new Set<string>();
console.log(`settle=${rig.settle} frames=${frames} floor frames with COM >4cm outside support: ${((unsupportedFrames / frames) * 100).toFixed(1)}% hovering>3cm: ${((hoverFrames / frames) * 100).toFixed(1)}%  mean hover ${((sumHover / frames) * 1000).toFixed(1)} mm`);
for (const w of worst) {
  const key = w.where.replace(/^\S+ #\d+ /, '');
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`${(w.hover * 100).toFixed(1)} cm  ${w.part.padEnd(10)} ${w.where}`);
  if (seen.size >= 15) break;
}
