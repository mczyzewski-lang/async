import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { InstructorRig, FLOOR_Y } from './InstructorRig';
import { BONE_DEFS } from './skeleton';
import { AVATAR_MAP } from './avatar';
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

  it('drives the avatar: its joints follow the driver skeleton in any pose', () => {
    expect(rig.avatar).not.toBeNull();
    expect(rig.avatar!.meshes.length).toBeGreaterThan(2);
    const avatarBones = new Map<string, THREE.Object3D>();
    rig.avatar!.root.traverse((o) => avatarBones.set(o.name, o));
    for (const id of ['tree', 'warrior-2', 'downward-dog', 'bridge']) {
      const p = POSES_3D.find((x) => x.id === id)!;
      rig.setPose(p.animation!.keyframes.find((k) => k.id === p.animation!.hold)!.state, 0);
      rig.update(0.016);
      for (const [a, d] of Object.entries(AVATAR_MAP)) {
        if (!d.pin) continue;
        const pa = avatarBones.get(a)!.getWorldPosition(new THREE.Vector3());
        const pd = rig.bones[d.driver].getWorldPosition(new THREE.Vector3());
        expect(pa.distanceTo(pd), `${id} ${a}`).toBeLessThan(0.002);
      }
      // the hand mesh stays attached to the forearm (no stretching beyond the rest proportions)
      const hand = avatarBones.get('LeftHand')!.getWorldPosition(new THREE.Vector3());
      const elbow = avatarBones.get('LeftForeArm')!.getWorldPosition(new THREE.Vector3());
      expect(hand.distanceTo(elbow)).toBeCloseTo(BONE_DEFS.find((b) => b.name === 'handL')!.offset[1] * -1, 2);
    }
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
