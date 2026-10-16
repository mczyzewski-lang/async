import { describe, expect, it } from 'vitest';
import { POSES, POSES_3D } from './poses';
import { validatePoses } from './validate';
import { mirrorPose, pose, neutralState } from './poseState';

describe('pose content', () => {
  it('has no validation errors', () => {
    const errors = validatePoses(POSES).filter((i) => i.level === 'error');
    expect(errors, errors.map((e) => `${e.pose}: ${e.message}`).join('\n')).toEqual([]);
  });

  it('has at least 100 catalog entries and 30 3D demonstrations', () => {
    expect(POSES.length).toBeGreaterThanOrEqual(100);
    expect(POSES_3D.length).toBeGreaterThanOrEqual(30);
  });

  it('includes every essential beginner pose with a 3D demonstration', () => {
    const essential = ['mountain', 'child', 'cat', 'cow', 'downward-dog', 'cobra', 'sphinx', 'forward-fold', 'half-forward-fold', 'low-lunge', 'warrior-1', 'warrior-2', 'triangle', 'tree', 'chair', 'butterfly', 'staff', 'easy-seated', 'bridge', 'savasana', 'supine-twist', 'knees-to-chest', 'reclining-butterfly', 'puppy'];
    for (const id of essential) expect(POSES_3D.some((p) => p.id === id), id).toBe(true);
  });

  it('marks demanding poses for supervision and keeps them out of the beginner level', () => {
    for (const id of ['wheel', 'crow', 'bow', 'headstand', 'shoulderstand', 'handstand']) {
      const p = POSES.find((x) => x.id === id)!;
      expect(p.requiresSupervision, id).toBe(true);
      expect(p.difficulty).toBe('advanced');
    }
  });

  it('every 3D pose provides at least one demonstrable mistake', () => {
    for (const p of POSES_3D) expect(p.commonMistakes.some((m) => m.incorrectPoseState), p.id).toBe(true);
  });

  it('never uses forbidden coaching language', () => {
    const text = JSON.stringify(POSES).toLowerCase();
    for (const bad of ['przez ból', 'leczy', 'wyleczy', 'na siłę dociśnij', 'musisz dotknąć']) expect(text.includes(bad), bad).toBe(false);
  });
});

describe('pose state utilities', () => {
  it('mirrors left/right and negates axial components', () => {
    const s = pose(neutralState(), { hipL: { elev: 80, plane: 30, rot: 10 }, spine: { flex: 0, side: 10, twist: 20 }, root: { yaw: 30 } });
    const m = mirrorPose(s);
    expect(m.hipR.elev).toBe(80);
    expect(m.hipL.elev).toBe(s.hipR.elev);
    expect(m.spine.twist).toBe(-20);
    expect(m.root.yaw).toBe(-30);
    expect(mirrorPose(m)).toEqual(s);
  });
});
