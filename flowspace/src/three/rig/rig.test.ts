import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { InstructorRig, FLOOR_Y } from './InstructorRig';
import { BONE_DEFS } from './skeleton';
import { POSES_3D } from '@/content/poses';
import { mirrorPose } from '@/content/poseState';

function lowest(rig: InstructorRig) {
  let min = Infinity;
  (rig as unknown as { computeSamples: (cb: (s: unknown, p: THREE.Vector3) => void) => void }).computeSamples((_, p) => {
    min = Math.min(min, p.y);
  });
  return min;
}

describe('instructor rig', () => {
  const rig = new InstructorRig();
  rig.breathingAmount = 0;

  it('builds a skinned mesh bound to the full skeleton', () => {
    expect(rig.mesh.isSkinnedMesh).toBe(true);
    expect(rig.mesh.skeleton.bones.length).toBe(BONE_DEFS.length);
    const g = rig.mesh.geometry;
    expect(g.getAttribute('skinIndex').count).toBe(g.getAttribute('position').count);
  });

  it('grounds every held pose onto the mat (no floating, no sinking)', () => {
    for (const p of POSES_3D) {
      const kf = p.animation!.keyframes.find((k) => k.id === p.animation!.hold)!;
      rig.setPose(kf.state, 0);
      rig.update(0.016);
      expect(Math.abs(lowest(rig) - FLOOR_Y), p.id).toBeLessThan(0.004);
    }
  });

  it('mirrors sided poses for the right side', () => {
    const tree = POSES_3D.find((p) => p.id === 'tree')!;
    const s = tree.animation!.keyframes.find((k) => k.id === 'tree')!.state;
    rig.setPose(s, 0);
    rig.update(0.016);
    const left = rig.getJointWorld('ankleL').clone();
    rig.setPose(mirrorPose(s), 0);
    rig.update(0.016);
    const right = rig.getJointWorld('ankleR');
    expect(right.x).toBeCloseTo(-left.x, 2);
    expect(right.y).toBeCloseTo(left.y, 2);
  });

  it('interpolates smoothly without snapping', () => {
    const a = POSES_3D.find((p) => p.id === 'mountain')!.animation!.keyframes[1].state;
    const b = POSES_3D.find((p) => p.id === 'upward-salute')!.animation!.keyframes[1].state;
    rig.setPose(a, 0);
    rig.update(0.016);
    rig.setPose(b, 1);
    let prev = rig.getJointWorld('handL').clone();
    let maxStep = 0;
    for (let i = 0; i < 70; i++) {
      rig.update(1 / 60);
      const cur = rig.getJointWorld('handL');
      maxStep = Math.max(maxStep, cur.distanceTo(prev));
      prev = cur.clone();
    }
    expect(rig.status).toBe('holding');
    // A hand travelling ~1.6 m in 1 s should never jump more than a few cm per frame.
    expect(maxStep).toBeLessThan(0.08);
  });
});
