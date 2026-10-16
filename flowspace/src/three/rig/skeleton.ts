import * as THREE from 'three';
import type { JointId, PoseState } from '@/content/types';

/**
 * Bone layout of the FLOWSPACE instructor (bind pose = standing, arms hanging, palms facing thighs).
 * Coordinates: Y up, character faces +Z, the character's left is +X. Units: metres.
 */
export type BoneName =
  | 'root' | 'spine' | 'chest' | 'neck' | 'head'
  | 'clavL' | 'upperArmL' | 'forearmL' | 'handL' | 'fingersL'
  | 'clavR' | 'upperArmR' | 'forearmR' | 'handR' | 'fingersR'
  | 'thighL' | 'shinL' | 'footL' | 'toesL'
  | 'thighR' | 'shinR' | 'footR' | 'toesR';

export interface BoneDef {
  name: BoneName;
  parent: BoneName | null;
  /** Offset from the parent bone in bind pose. */
  offset: [number, number, number];
}

export const DIM = {
  pelvisY: 0.965,
  hipX: 0.088,
  hipY: -0.075,
  thigh: 0.42,
  shin: 0.4,
  spine: 0.095,
  chest: 0.175,
  neck: 0.205,
  head: 0.075,
  clavX: 0.022,
  clavY: 0.185,
  clavLen: 0.152,
  upperArm: 0.285,
  forearm: 0.245,
  palm: 0.095,
  ankleToBall: [0, -0.058, 0.128] as [number, number, number],
};

const L = (n: string) => `${n}L` as BoneName;
const R = (n: string) => `${n}R` as BoneName;

function sideDefs(side: 'L' | 'R'): BoneDef[] {
  const s = side === 'L' ? 1 : -1;
  const n = side === 'L' ? L : R;
  return [
    { name: n('clav'), parent: 'chest', offset: [DIM.clavX * s, DIM.clavY, -0.012] },
    { name: n('upperArm'), parent: n('clav'), offset: [DIM.clavLen * s, -0.012, -0.012] },
    { name: n('forearm'), parent: n('upperArm'), offset: [0, -DIM.upperArm, 0] },
    { name: n('hand'), parent: n('forearm'), offset: [0, -DIM.forearm, 0] },
    { name: n('fingers'), parent: n('hand'), offset: [0, -DIM.palm, 0.004] },
    { name: n('thigh'), parent: 'root', offset: [DIM.hipX * s, DIM.hipY, 0] },
    { name: n('shin'), parent: n('thigh'), offset: [0, -DIM.thigh, 0] },
    { name: n('foot'), parent: n('shin'), offset: [0, -DIM.shin, -0.005] },
    { name: n('toes'), parent: n('foot'), offset: DIM.ankleToBall },
  ];
}

export const BONE_DEFS: BoneDef[] = [
  { name: 'root', parent: null, offset: [0, DIM.pelvisY, 0] },
  { name: 'spine', parent: 'root', offset: [0, DIM.spine, -0.008] },
  { name: 'chest', parent: 'spine', offset: [0, DIM.chest, 0.004] },
  { name: 'neck', parent: 'chest', offset: [0, DIM.neck, -0.018] },
  { name: 'head', parent: 'neck', offset: [0, DIM.head, 0.012] },
  ...sideDefs('L'),
  ...sideDefs('R'),
];

export const BONE_INDEX: Record<BoneName, number> = Object.fromEntries(
  BONE_DEFS.map((b, i) => [b.name, i]),
) as Record<BoneName, number>;

/** Bind-pose world position of each bone origin. */
export function bindPositions(): Record<BoneName, THREE.Vector3> {
  const out = {} as Record<BoneName, THREE.Vector3>;
  for (const b of BONE_DEFS) {
    const p = new THREE.Vector3(...b.offset);
    if (b.parent) p.add(out[b.parent]);
    out[b.name] = p;
  }
  return out;
}

/** Which bone (and local offset) represents each anatomical joint. */
export const JOINT_TO_BONE: Record<JointId, { bone: BoneName; offset?: [number, number, number] }> = {
  pelvis: { bone: 'root' },
  spine: { bone: 'spine', offset: [0, 0.03, -0.06] },
  chest: { bone: 'chest', offset: [0, 0.1, 0.02] },
  neck: { bone: 'neck', offset: [0, 0.03, 0] },
  head: { bone: 'head', offset: [0, 0.09, 0.02] },
  clavL: { bone: 'clavL', offset: [0.07, 0, 0] },
  clavR: { bone: 'clavR', offset: [-0.07, 0, 0] },
  shoulderL: { bone: 'upperArmL' },
  shoulderR: { bone: 'upperArmR' },
  elbowL: { bone: 'forearmL' },
  elbowR: { bone: 'forearmR' },
  wristL: { bone: 'handL' },
  wristR: { bone: 'handR' },
  handL: { bone: 'handL', offset: [0, -0.07, 0] },
  handR: { bone: 'handR', offset: [0, -0.07, 0] },
  hipL: { bone: 'thighL' },
  hipR: { bone: 'thighR' },
  kneeL: { bone: 'shinL' },
  kneeR: { bone: 'shinR' },
  ankleL: { bone: 'footL' },
  ankleR: { bone: 'footR' },
  toesL: { bone: 'toesL' },
  toesR: { bone: 'toesR' },
};

// ---------------------------------------------------------------------------
// Anatomical parameters → local bone quaternions
// ---------------------------------------------------------------------------

const D = THREE.MathUtils.DEG2RAD;
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** Mirror a left-side rotation to the right side (reflection across the YZ plane). */
function mirrorQ(q: THREE.Quaternion): THREE.Quaternion {
  q.y = -q.y;
  q.z = -q.z;
  return q;
}

function segmentQ(out: THREE.Quaternion, a: { flex: number; side: number; twist: number }) {
  _e.set(a.flex * D, a.twist * D, -a.side * D, 'YXZ');
  return out.setFromEuler(_e);
}

/** Globe coordinates for a limb hanging along -Y (left side). */
function globeQ(out: THREE.Quaternion, b: { elev: number; plane: number; rot: number }) {
  const ph = b.plane * D;
  const dx = Math.cos(ph);
  const dz = Math.sin(ph);
  _axis.set(-dz, 0, dx).normalize();
  out.setFromAxisAngle(_axis, b.elev * D);
  _q2.setFromAxisAngle(Y, b.rot * D);
  return out.multiply(_q2);
}

export type BoneQuats = Record<BoneName, THREE.Quaternion>;

export function createBoneQuats(): BoneQuats {
  return Object.fromEntries(BONE_DEFS.map((b) => [b.name, new THREE.Quaternion()])) as BoneQuats;
}

/** Fills `out` with local bone quaternions for the given state. */
export function poseToQuats(s: PoseState, out: BoneQuats): BoneQuats {
  _e.set(s.root.pitch * D, s.root.yaw * D, -s.root.roll * D, 'YXZ');
  out.root.setFromEuler(_e);
  if (s.root.turn) out.root.multiply(_q2.setFromAxisAngle(Y, s.root.turn * D));
  segmentQ(out.spine, s.spine);
  segmentQ(out.chest, s.chest);
  segmentQ(out.neck, s.neck);
  segmentQ(out.head, s.head);

  for (const side of ['L', 'R'] as const) {
    const right = side === 'R';
    const fix = (q: THREE.Quaternion) => (right ? mirrorQ(q) : q);
    const clav = s[`clav${side}`];
    _e.set(0, -clav.prot * D, clav.elev * D, 'YXZ');
    fix(out[`clav${side}`].setFromEuler(_e));

    fix(globeQ(out[`upperArm${side}`], s[`shoulder${side}`]));

    const w = s[`wrist${side}`];
    // Elbow hinge, plus half of the forearm pronation (distributes the twist).
    _e.set(-s[`elbow${side}`] * D, -w.pron * 0.5 * D, 0, 'XYZ');
    fix(out[`forearm${side}`].setFromEuler(_e));
    _q.setFromAxisAngle(Y, -w.pron * 0.5 * D);
    _e.set(-w.dev * D, 0, -w.flex * D, 'ZXY');
    _q2.setFromEuler(_e);
    fix(out[`hand${side}`].copy(_q).multiply(_q2));
    _e.set(0, 0, -s[`fingers${side}`] * 70 * D, 'XYZ');
    fix(out[`fingers${side}`].setFromEuler(_e));

    fix(globeQ(out[`thigh${side}`], s[`hip${side}`]));
    _e.set(s[`knee${side}`] * D, 0, 0, 'XYZ');
    fix(out[`shin${side}`].setFromEuler(_e));
    const a = s[`ankle${side}`];
    _e.set(-a.flex * D, 0, -a.inv * D, 'XYZ');
    fix(out[`foot${side}`].setFromEuler(_e));
    _e.set(-s[`toes${side}`] * D, 0, 0, 'XYZ');
    fix(out[`toes${side}`].setFromEuler(_e));
  }
  return out;
}
