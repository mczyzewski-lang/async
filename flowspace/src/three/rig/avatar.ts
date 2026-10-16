import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { BoneName } from './skeleton';

/**
 * The visible instructor is a realistic CC0 avatar (MPFB / MakeHuman, see public/models/README.md).
 * FLOWSPACE's own 23-bone skeleton stays the "driver": poses, grounding, IK and joint queries run on it,
 * and every frame the avatar's bones are set from it (world rotation + calibrated offset, joint positions).
 * The driver's proportions (skeleton.ts DIM) were measured from the avatar, so joints coincide.
 */

/** Uniform scale applied to the avatar (1.78 m → 1.70 m). */
export const AVATAR_SCALE = 0.96;

export interface AvatarTemplate {
  /** Scene root containing the armature and skinned meshes (never added to a scene itself). */
  root: THREE.Object3D;
}

let template: AvatarTemplate | null = null;
export function setAvatarTemplate(t: AvatarTemplate | null) {
  template = t;
}
export function getAvatarTemplate() {
  return template;
}

interface MapEntry {
  driver: BoneName;
  /** Avatar child joint and driver child bone used to align directions during calibration. */
  dir?: [string, BoneName];
  /** Place the avatar joint exactly at the driver joint. */
  pin?: boolean;
}

const side = (s: 'Left' | 'Right', d: 'L' | 'R'): Record<string, MapEntry> => ({
  [`${s}Shoulder`]: { driver: `clav${d}` as BoneName, dir: [`${s}Arm`, `upperArm${d}` as BoneName], pin: true },
  [`${s}Arm`]: { driver: `upperArm${d}` as BoneName, dir: [`${s}ForeArm`, `forearm${d}` as BoneName], pin: true },
  [`${s}ForeArm`]: { driver: `forearm${d}` as BoneName, dir: [`${s}Hand`, `hand${d}` as BoneName], pin: true },
  [`${s}Hand`]: { driver: `hand${d}` as BoneName, dir: [`${s}HandMiddle1`, `fingers${d}` as BoneName], pin: true },
  [`${s}HandIndex1`]: { driver: `fingers${d}` as BoneName },
  [`${s}HandMiddle1`]: { driver: `fingers${d}` as BoneName },
  [`${s}HandRing1`]: { driver: `fingers${d}` as BoneName },
  [`${s}HandPinky1`]: { driver: `fingers${d}` as BoneName },
  [`${s}UpLeg`]: { driver: `thigh${d}` as BoneName, dir: [`${s}Leg`, `shin${d}` as BoneName], pin: true },
  [`${s}Leg`]: { driver: `shin${d}` as BoneName, dir: [`${s}Foot`, `foot${d}` as BoneName], pin: true },
  [`${s}Foot`]: { driver: `foot${d}` as BoneName, dir: [`${s}ToeBase`, `toes${d}` as BoneName], pin: true },
  [`${s}ToeBase`]: { driver: `toes${d}` as BoneName, pin: true },
});

export const AVATAR_MAP: Record<string, MapEntry> = {
  Hips: { driver: 'root', dir: ['Spine', 'spine'], pin: true },
  Spine: { driver: 'spine', dir: ['Spine2', 'chest'], pin: true },
  Spine2: { driver: 'chest', dir: ['Neck', 'neck'], pin: true },
  Neck: { driver: 'neck', dir: ['Head', 'head'], pin: true },
  Head: { driver: 'head', pin: true },
  ...side('Left', 'L'),
  ...side('Right', 'R'),
};

/** Meshes that can touch the floor (body and clothing; not hair, brows or eyes). */
export const isContactMesh = (name: string) => /suit|^Human$|^base$|body/i.test(name);

export type Limb = 'handL' | 'handR' | 'footL' | 'footR';

/** Limb used for floor contacts, by avatar bone name. */
export function limbOfAvatarBone(name: string): Limb | null {
  const s = name.startsWith('Left') ? 'L' : name.startsWith('Right') ? 'R' : null;
  if (!s) return null;
  if (/Hand/.test(name)) return `hand${s}`;
  if (/Foot|Toe/.test(name)) return `foot${s}`;
  return null;
}

interface DrivenBone {
  bone: THREE.Bone;
  map: MapEntry | null;
  /** Index of the parent in `order`, or -1 when the parent is not a bone. */
  parent: number;
  /** For root bones: parent's matrix in group space (static). */
  parentG: THREE.Matrix4 | null;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  offset: THREE.Quaternion;
  /** Group-space matrix computed this frame. */
  G: THREE.Matrix4;
  /** Nearest mapped ancestor-or-self (used to report contacts by driver bone). */
  driver: BoneName;
}

export interface AvatarSample {
  mesh: number;
  base: THREE.Vector3;
  bones: [number, number, number, number];
  weights: [number, number, number, number];
  limb: Limb | null;
  driver: BoneName;
}

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class AvatarDriver {
  readonly root: THREE.Object3D;
  readonly meshes: THREE.SkinnedMesh[] = [];
  private readonly order: DrivenBone[] = [];
  private readonly byName = new Map<string, DrivenBone>();
  private readonly invGroup = new THREE.Matrix4();
  readonly samples: AvatarSample[] = [];
  /** Per mesh, per skeleton bone: index into `order`. */
  private meshBoneIdx: number[][] = [];
  private skinMats: THREE.Matrix4[][] = [];

  constructor(
    tpl: AvatarTemplate,
    private readonly group: THREE.Object3D,
    private readonly drivers: Record<BoneName, THREE.Bone>,
  ) {
    this.root = cloneSkinned(tpl.root);
    this.root.name = 'instructor-avatar';
    this.root.scale.setScalar(AVATAR_SCALE);
    group.add(this.root);
    group.updateMatrixWorld(true);
    this.invGroup.copy(group.matrixWorld).invert();

    this.root.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) this.meshes.push(o as THREE.SkinnedMesh);
    });
    const visit = (o: THREE.Object3D, parentIdx: number) => {
      let idx = parentIdx;
      if ((o as THREE.Bone).isBone) {
        const bone = o as THREE.Bone;
        const map = AVATAR_MAP[bone.name] ?? null;
        const parentEntry = parentIdx >= 0 ? this.order[parentIdx] : null;
        const d: DrivenBone = {
          bone,
          map,
          parent: parentIdx,
          parentG: parentIdx >= 0 ? null : new THREE.Matrix4().multiplyMatrices(this.invGroup, bone.parent!.matrixWorld),
          restPos: bone.position.clone(),
          restQuat: bone.quaternion.clone(),
          offset: new THREE.Quaternion(),
          G: new THREE.Matrix4().multiplyMatrices(this.invGroup, bone.matrixWorld),
          driver: map?.driver ?? parentEntry?.driver ?? 'root',
        };
        idx = this.order.length;
        this.order.push(d);
        this.byName.set(bone.name, d);
      }
      for (const c of o.children) visit(c, idx);
    };
    visit(this.root, -1);
    this.calibrate();
    this.buildSamples();
  }

  private driverQuatG(b: THREE.Bone, out: THREE.Quaternion) {
    b.getWorldQuaternion(out);
    return out.premultiply(this.groupQuatInv);
  }
  private groupQuatInv = new THREE.Quaternion();

  /**
   * Puts the driver skeleton into the avatar's rest pose (bone directions aligned top-down) and
   * records, per mapped bone, the rotation between driver and avatar frames.
   */
  private calibrate() {
    const saved = Object.values(this.drivers).map((b) => [b, b.quaternion.clone(), b.position.clone()] as const);
    this.group.getWorldQuaternion(this.groupQuatInv).invert();
    for (const b of Object.values(this.drivers)) b.quaternion.identity();
    this.drivers.root.updateMatrixWorld(true);
    for (const d of this.order) {
      if (!d.map?.dir) continue;
      const child = this.byName.get(d.map.dir[0]);
      if (!child) continue;
      const target = _a.setFromMatrixPosition(child.G).sub(_b.setFromMatrixPosition(d.G)).normalize();
      const db = this.drivers[d.map.driver];
      const dc = this.drivers[d.map.dir[1]];
      db.updateMatrixWorld(true);
      const cur = dc.getWorldPosition(new THREE.Vector3()).sub(db.getWorldPosition(new THREE.Vector3()));
      cur.transformDirection(this.invGroup).normalize();
      const swing = _q.setFromUnitVectors(cur, target);
      // world-space (group) rotation applied to the driver bone
      const wq = this.driverQuatG(db, _q2).premultiply(swing);
      const parentQ = this.driverQuatG(db.parent as THREE.Bone, new THREE.Quaternion());
      db.quaternion.copy(parentQ.invert().multiply(wq));
      db.updateMatrixWorld(true);
    }
    for (const d of this.order) {
      if (!d.map) continue;
      const dq = this.driverQuatG(this.drivers[d.map.driver], new THREE.Quaternion());
      d.G.decompose(_p, _q, _s);
      d.offset.copy(dq.invert().multiply(_q));
    }
    for (const [b, q, p] of saved) {
      b.quaternion.copy(q);
      b.position.copy(p);
    }
    this.drivers.root.updateMatrixWorld(true);
  }

  /** Copies the driver pose onto the avatar skeleton. */
  sync() {
    this.group.updateMatrixWorld(true);
    this.invGroup.copy(this.group.matrixWorld).invert();
    this.group.getWorldQuaternion(this.groupQuatInv).invert();
    const scale = _s;
    for (const d of this.order) {
      const parentG = d.parent >= 0 ? this.order[d.parent].G : d.parentG!;
      if (d.map) {
        const drv = this.drivers[d.map.driver];
        const q = this.driverQuatG(drv, _q).multiply(d.offset);
        if (d.map.pin) _p.setFromMatrixPosition(_m.multiplyMatrices(this.invGroup, drv.matrixWorld));
        else _p.set(d.restPos.x, d.restPos.y, d.restPos.z).applyMatrix4(parentG);
        scale.setFromMatrixScale(parentG).multiply(d.bone.scale);
        d.G.compose(_p, q, scale);
        _m2.copy(parentG).invert().multiply(d.G);
        _m2.decompose(d.bone.position, d.bone.quaternion, _a);
      } else if (/^Ponytail\d$/.test(d.bone.name)) {
        // The ponytail hangs: each segment swings part of the way toward gravity.
        _m.multiplyMatrices(parentG, _m2.compose(d.restPos, d.restQuat, d.bone.scale));
        _m.decompose(_p, _q, scale);
        const dir = _a.set(0, 1, 0).applyQuaternion(_q);
        const down = _b.set(0, -1, 0).applyQuaternion(this.groupQuatInv);
        const target = down.lerp(dir, 0.45).normalize();
        _q.premultiply(_q2.setFromUnitVectors(dir, target));
        d.G.compose(_p, _q, scale);
        _m2.copy(parentG).invert().multiply(d.G);
        _m2.decompose(d.bone.position, d.bone.quaternion, _a);
      } else {
        d.G.multiplyMatrices(parentG, _m.compose(d.bone.position, d.bone.quaternion, d.bone.scale));
      }
    }
    this.root.updateMatrixWorld(true);
  }

  private buildSamples() {
    this.meshBoneIdx = this.meshes.map((m) => m.skeleton.bones.map((b) => this.order.findIndex((d) => d.bone === b)));
    this.skinMats = this.meshes.map((m) => m.skeleton.bones.map(() => new THREE.Matrix4()));
    this.meshes.forEach((mesh, mi) => {
      if (!isContactMesh(mesh.name)) return;
      const g = mesh.geometry;
      const pos = g.getAttribute('position');
      const si = g.getAttribute('skinIndex');
      const sw = g.getAttribute('skinWeight');
      const bones = mesh.skeleton.bones;
      for (let i = 0; i < pos.count; i++) {
        const b: [number, number, number, number] = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
        const w: [number, number, number, number] = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)];
        let top = 0;
        for (let k = 1; k < 4; k++) if (w[k] > w[top]) top = k;
        const limb = w[top] > 0.5 ? limbOfAvatarBone(bones[b[top]].name) : null;
        if (!limb && i % 6 !== 0) continue;
        const dIdx = this.meshBoneIdx[mi][b[top]];
        this.samples.push({
          mesh: mi,
          base: new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix),
          bones: b,
          weights: w,
          limb,
          driver: dIdx >= 0 ? this.order[dIdx].driver : 'root',
        });
      }
    });
  }

  /** Visits skinned sample positions in group space (call after sync()). */
  forEachSample(cb: (s: AvatarSample, p: THREE.Vector3) => void) {
    this.meshes.forEach((mesh, mi) => {
      const mats = this.skinMats[mi];
      const idx = this.meshBoneIdx[mi];
      mesh.skeleton.bones.forEach((_, j) => {
        const d = idx[j] >= 0 ? this.order[idx[j]] : null;
        if (d) mats[j].multiplyMatrices(d.G, mesh.skeleton.boneInverses[j]);
        else mats[j].identity();
      });
    });
    const acc = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (const s of this.samples) {
      acc.set(0, 0, 0);
      const mats = this.skinMats[s.mesh];
      for (let k = 0; k < 4; k++) {
        const w = s.weights[k];
        if (w === 0) continue;
        acc.addScaledVector(v.copy(s.base).applyMatrix4(mats[s.bones[k]]), w);
      }
      cb(s, acc);
    }
  }
}
