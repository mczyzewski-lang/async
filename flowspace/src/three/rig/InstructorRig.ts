import * as THREE from 'three';
import type { JointId, PoseState } from '@/content/types';
import { neutralState } from '@/content/poseState';
import { buildCharacterGeometry, createSkeleton, DEFAULT_PALETTE, type CharacterPalette } from './buildCharacter';
import { BONE_DEFS, BONE_INDEX, JOINT_TO_BONE, createBoneQuats, poseToQuats, type BoneName } from './skeleton';

export const FLOOR_Y = 0.012; // top surface of the yoga mat

const BONE_DELAY: Partial<Record<BoneName, number>> = {
  root: 0, spine: 0.03, chest: 0.05, neck: 0.08, head: 0.1,
  clavL: 0.05, clavR: 0.05, upperArmL: 0.06, upperArmR: 0.06, forearmL: 0.09, forearmR: 0.09,
  handL: 0.12, handR: 0.12, fingersL: 0.12, fingersR: 0.12,
  thighL: 0.02, thighR: 0.02, shinL: 0.05, shinR: 0.05, footL: 0.08, footR: 0.08, toesL: 0.09, toesR: 0.09,
};
const MAX_DELAY = 0.12;

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export interface Segment {
  state: PoseState;
  duration: number;
  /** Seconds to rest at this keyframe before the next segment starts. */
  hold?: number;
  tag?: string;
}

interface Sample {
  index: number;
  base: THREE.Vector3;
  bones: [number, number, number, number];
  weights: [number, number, number, number];
  limb: 'handL' | 'handR' | 'footL' | 'footR' | null;
  bone: number;
}

const HL_MAX = 6;

export class InstructorRig {
  readonly group = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly bones: Record<BoneName, THREE.Bone>;
  readonly material: THREE.MeshStandardMaterial;
  private readonly boneList: THREE.Bone[];
  private readonly boneInverses: THREE.Matrix4[];
  private readonly samples: Sample[] = [];

  /** Playback speed multiplier (0.25–2). */
  speed = 1;
  paused = false;
  /** 0..1 strength of the idle breathing motion while holding. */
  breathingAmount = 1;
  breathingStyle: 'chest' | 'belly' | 'subtle' = 'chest';
  grounding = true;
  enableIK = true;

  private fromQ = createBoneQuats();
  private toQ = createBoneQuats();
  private fromRoot = new THREE.Vector2();
  private toRoot = new THREE.Vector2();
  private queue: Segment[] = [];
  private current: Segment | null = null;
  private segT = 0;
  private holdT = 0;
  private onQueueDone: (() => void) | null = null;
  private breathT = Math.random() * 10;
  private breathBlend = 0;
  private targetState: PoseState = neutralState();
  private rootY = 0;

  status: 'moving' | 'holding' = 'holding';
  currentTag = 'neutral';
  readonly contacts: THREE.Vector3[] = [];
  readonly contactBones: BoneName[] = [];

  private hlUniforms = {
    uHl: { value: Array.from({ length: HL_MAX }, () => new THREE.Vector4(0, -10, 0, 0)) },
    uHlColor: { value: new THREE.Color('#E8735A') },
    uHlStrength: { value: 0 },
  };
  private highlights: JointId[] = [];
  private hlTarget = 0;

  constructor(palette: CharacterPalette = DEFAULT_PALETTE) {
    const { root, bones, byName } = createSkeleton();
    this.bones = byName;
    this.boneList = bones;
    this.group.add(root);
    this.group.updateMatrixWorld(true);
    const geometry = buildCharacterGeometry(palette);
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.72,
      metalness: 0,
    });
    this.installHighlightShader(this.material);
    this.mesh = new THREE.SkinnedMesh(geometry, this.material);
    this.mesh.name = 'instructor';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    const skeleton = new THREE.Skeleton(bones);
    this.mesh.bind(skeleton);
    this.boneInverses = skeleton.boneInverses;
    this.buildSamples(geometry);

    this.setPose(neutralState(), 0);
    this.update(0);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.skeleton.dispose();
  }

  private installHighlightShader(mat: THREE.MeshStandardMaterial) {
    const u = this.hlUniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRigWorld;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvRigWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vRigWorld;
uniform vec4 uHl[${HL_MAX}];
uniform vec3 uHlColor;
uniform float uHlStrength;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float hlK = 0.0;
for (int i = 0; i < ${HL_MAX}; i++) {
  float r = uHl[i].w;
  if (r > 0.0) {
    float d = distance(vRigWorld, uHl[i].xyz);
    hlK = max(hlK, 1.0 - smoothstep(r * 0.35, r, d));
  }
}
diffuseColor.rgb = mix(diffuseColor.rgb, uHlColor, hlK * uHlStrength);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
totalEmissiveRadiance += uHlColor * hlK * uHlStrength * 0.22;`,
        );
    };
    mat.customProgramCacheKey = () => 'flowspace-rig-hl';
  }

  private buildSamples(geometry: THREE.BufferGeometry) {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const si = geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
    const sw = geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
    const limbOf: Record<number, Sample['limb']> = {
      [BONE_INDEX.handL]: 'handL', [BONE_INDEX.fingersL]: 'handL',
      [BONE_INDEX.handR]: 'handR', [BONE_INDEX.fingersR]: 'handR',
      [BONE_INDEX.footL]: 'footL', [BONE_INDEX.toesL]: 'footL',
      [BONE_INDEX.footR]: 'footR', [BONE_INDEX.toesR]: 'footR',
    };
    for (let i = 0; i < pos.count; i++) {
      const bones: [number, number, number, number] = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
      const weights: [number, number, number, number] = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)];
      const limb = weights[0] > 0.5 ? limbOf[bones[0]] ?? null : null;
      // Dense sampling on hands/feet (contacts), sparse elsewhere.
      if (!limb && i % 5 !== 0) continue;
      this.samples.push({
        index: i,
        base: new THREE.Vector3().fromBufferAttribute(pos, i),
        bones,
        weights,
        limb,
        bone: bones[0],
      });
    }
  }

  // ------------------------------------------------------------------ public API

  /** Immediately (duration 0) or smoothly move to a state. Clears any queued segments. */
  setPose(state: PoseState, duration = 0.8, tag = 'pose') {
    this.queue = [];
    this.onQueueDone = null;
    this.startSegment({ state, duration, tag });
    if (duration <= 0) this.applyInterpolation(1);
  }

  /** Plays a sequence of keyframes; calls onDone when the last one is reached. */
  playSequence(segments: Segment[], onDone?: () => void) {
    if (!segments.length) return;
    this.queue = segments.slice(1);
    this.onQueueDone = onDone ?? null;
    this.startSegment(segments[0]);
  }

  get target(): PoseState {
    return this.targetState;
  }

  /** Highlights body regions: warm gold for teaching focus, coral for mistakes. */
  setHighlights(joints: JointId[], tone: 'focus' | 'error' = 'focus') {
    this.highlights = joints.slice(0, HL_MAX);
    this.hlTarget = joints.length ? (tone === 'error' ? 1 : 0.7) : 0;
    this.hlUniforms.uHlColor.value.set(tone === 'error' ? '#E0604A' : '#E3B45C');
    this.highlightTone = joints.length ? tone : 'none';
  }
  highlightTone: 'focus' | 'error' | 'none' = 'none';

  getJointWorld(joint: JointId, out = new THREE.Vector3()): THREE.Vector3 {
    const m = JOINT_TO_BONE[joint];
    out.set(...(m.offset ?? [0, 0, 0]));
    return this.bones[m.bone].localToWorld(out);
  }

  getBoneWorld(bone: BoneName, out = new THREE.Vector3()) {
    return this.bones[bone].getWorldPosition(out);
  }

  /** Approximate centre of mass from segment midpoints (rough mass fractions). */
  getCenterOfMass(out = new THREE.Vector3()) {
    const parts: Array<[BoneName, BoneName | null, number]> = [
      ['root', 'spine', 0.14], ['spine', 'chest', 0.14], ['chest', 'neck', 0.2], ['head', null, 0.08],
      ['thighL', 'shinL', 0.1], ['thighR', 'shinR', 0.1], ['shinL', 'footL', 0.045], ['shinR', 'footR', 0.045],
      ['upperArmL', 'forearmL', 0.028], ['upperArmR', 'forearmR', 0.028], ['forearmL', 'handL', 0.022], ['forearmR', 'handR', 0.022],
    ];
    out.set(0, 0, 0);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    let sum = 0;
    for (const [p, c, w] of parts) {
      this.getBoneWorld(p, a);
      if (c) a.add(this.getBoneWorld(c, b)).multiplyScalar(0.5);
      out.addScaledVector(a, w);
      sum += w;
    }
    return out.multiplyScalar(1 / sum);
  }

  // ------------------------------------------------------------------ internals

  private startSegment(seg: Segment) {
    this.current = seg;
    this.segT = 0;
    this.holdT = 0;
    this.status = 'moving';
    this.currentTag = seg.tag ?? 'pose';
    this.targetState = seg.state;
    for (const def of BONE_DEFS) this.fromQ[def.name].copy(this.bones[def.name].quaternion);
    this.fromRoot.set(this.bones.root.position.x, this.bones.root.position.z);
    poseToQuats(seg.state, this.toQ);
    this.toRoot.set(seg.state.root.x, seg.state.root.z);
  }

  private applyInterpolation(p: number) {
    const span = 1 - MAX_DELAY;
    for (const def of BONE_DEFS) {
      const d = BONE_DELAY[def.name] ?? 0;
      const u = p >= 1 ? 1 : Math.min(1, Math.max(0, (p - d) / span));
      this.bones[def.name].quaternion.slerpQuaternions(this.fromQ[def.name], this.toQ[def.name], smootherstep(u));
    }
    const e = smootherstep(Math.min(1, p));
    this.bones.root.position.x = THREE.MathUtils.lerp(this.fromRoot.x, this.toRoot.x, e);
    this.bones.root.position.z = THREE.MathUtils.lerp(this.fromRoot.y, this.toRoot.y, e);
  }

  private _q = new THREE.Quaternion();
  private _e = new THREE.Euler();

  private applyBreathing(dt: number) {
    const holding = this.status === 'holding';
    this.breathBlend = THREE.MathUtils.damp(this.breathBlend, holding ? 1 : 0, 2.5, dt);
    this.breathT += dt;
    const k = this.breathBlend * this.breathingAmount;
    if (k < 0.001) return;
    // ~5.5 s per breath, inhale slightly shorter than exhale.
    const phase = (this.breathT / 5.5) % 1;
    const wave = phase < 0.42 ? Math.sin((phase / 0.42) * Math.PI * 0.5) : Math.cos(((phase - 0.42) / 0.58) * Math.PI * 0.5);
    const s = wave * k;
    const D = THREE.MathUtils.DEG2RAD;
    const chest = this.breathingStyle === 'belly' ? 0.5 : this.breathingStyle === 'subtle' ? 0.45 : 1;
    this._e.set(-1.4 * s * chest * D, 0, 0);
    this.bones.chest.quaternion.multiply(this._q.setFromEuler(this._e));
    this._e.set(-0.6 * s * D, 0, 0);
    this.bones.spine.quaternion.multiply(this._q.setFromEuler(this._e));
    this._e.set(0, 0, 1.3 * s * chest * D);
    this.bones.clavL.quaternion.multiply(this._q.setFromEuler(this._e));
    this._e.set(0, 0, -1.3 * s * chest * D);
    this.bones.clavR.quaternion.multiply(this._q.setFromEuler(this._e));
    this._e.set(0.5 * s * D, 0, 0);
    this.bones.neck.quaternion.multiply(this._q.setFromEuler(this._e));
  }

  private boneMats: THREE.Matrix4[] = BONE_DEFS.map(() => new THREE.Matrix4());
  private _v = new THREE.Vector3();
  private _acc = new THREE.Vector3();

  private computeSamples(cb: (s: Sample, p: THREE.Vector3) => void) {
    this.group.updateMatrixWorld(true);
    const inv = this._invGroup.copy(this.group.matrixWorld).invert();
    for (let i = 0; i < this.boneList.length; i++) {
      this.boneMats[i].multiplyMatrices(inv, this.boneList[i].matrixWorld).multiply(this.boneInverses[i]);
    }
    for (const s of this.samples) {
      this._acc.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = s.weights[k];
        if (w === 0) continue;
        this._v.copy(s.base).applyMatrix4(this.boneMats[s.bones[k]]);
        this._acc.addScaledVector(this._v, w);
      }
      cb(s, this._acc);
    }
  }
  private _invGroup = new THREE.Matrix4();

  private ground() {
    let minY = Infinity;
    const limbMin: Record<string, number> = { handL: Infinity, handR: Infinity, footL: Infinity, footR: Infinity };
    this.computeSamples((s, p) => {
      if (p.y < minY) minY = p.y;
      if (s.limb && p.y < limbMin[s.limb]) limbMin[s.limb] = p.y;
    });
    const dy = FLOOR_Y - minY;
    this.rootY = this.bones.root.position.y + dy;
    this.bones.root.position.y = this.rootY;
    return { limbMin: Object.fromEntries(Object.entries(limbMin).map(([k, v]) => [k, v + dy])) };
  }

  private plantLimbs(limbMin: Record<string, number>) {
    const plant = this.targetState.plant;
    if (!plant || !this.enableIK) return false;
    let changed = false;
    const chains: Record<string, [BoneName, BoneName, BoneName]> = {
      handL: ['upperArmL', 'forearmL', 'handL'],
      handR: ['upperArmR', 'forearmR', 'handR'],
      footL: ['thighL', 'shinL', 'footL'],
      footR: ['thighR', 'shinR', 'footR'],
    };
    // Fade IK in only when close to the keyframe (prevents tugging during long transitions).
    const w = this.status === 'holding' ? 1 : Math.max(0, (this.segProgress() - 0.6) / 0.4);
    for (const key of Object.keys(chains) as Array<keyof typeof chains>) {
      if (!plant[key as 'handL']) continue;
      const gap = limbMin[key] - FLOOR_Y;
      if (Math.abs(gap) < 0.002 || Math.abs(gap) > 0.08) continue;
      const [a, b, c] = chains[key];
      this.solveTwoBone(a, b, c, -gap * w);
      changed = true;
    }
    return changed;
  }

  private segProgress() {
    if (!this.current) return 1;
    return this.current.duration <= 0 ? 1 : Math.min(1, this.segT / this.current.duration);
  }

  private _A = new THREE.Vector3();
  private _B = new THREE.Vector3();
  private _C = new THREE.Vector3();
  private _T = new THREE.Vector3();
  private _n = new THREE.Vector3();
  private _qa = new THREE.Quaternion();
  private _qb = new THREE.Quaternion();

  private rotateBoneWorld(bone: THREE.Bone, rot: THREE.Quaternion) {
    const parent = bone.parent!;
    parent.getWorldQuaternion(this._qa);
    bone.getWorldQuaternion(this._qb);
    this._qb.premultiply(rot);
    bone.quaternion.copy(this._qa.invert().multiply(this._qb));
    bone.updateMatrixWorld(true);
  }

  /** Moves the end of a two-bone chain by `dy` vertically. */
  private solveTwoBone(an: BoneName, bn: BoneName, cn: BoneName, dy: number) {
    const A = this.bones[an].getWorldPosition(this._A);
    const B = this.bones[bn].getWorldPosition(this._B);
    const C = this.bones[cn].getWorldPosition(this._C);
    const T = this._T.copy(C);
    T.y += dy;
    const la = A.distanceTo(B);
    const lb = B.distanceTo(C);
    const dist = THREE.MathUtils.clamp(A.distanceTo(T), Math.abs(la - lb) + 1e-3, la + lb - 1e-3);
    const ba = new THREE.Vector3().subVectors(A, B).normalize();
    const bc = new THREE.Vector3().subVectors(C, B).normalize();
    const cur = Math.acos(THREE.MathUtils.clamp(ba.dot(bc), -1, 1));
    const des = Math.acos(THREE.MathUtils.clamp((la * la + lb * lb - dist * dist) / (2 * la * lb), -1, 1));
    this._n.crossVectors(ba, bc);
    if (this._n.lengthSq() < 1e-8) {
      // Straight limb: bend around the hinge axis (bone-local X).
      this._n.set(1, 0, 0).transformDirection(this.bones[bn].matrixWorld);
    }
    this._n.normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(this._n, des - cur);
    this.rotateBoneWorld(this.bones[bn], q);
    const C2 = this.bones[cn].getWorldPosition(new THREE.Vector3());
    const from = C2.sub(A).normalize();
    const to = new THREE.Vector3().subVectors(T, A).normalize();
    const q2 = new THREE.Quaternion().setFromUnitVectors(from, to);
    // Keep the end segment's world orientation (palm / sole stays flat).
    const endWorld = this.bones[cn].getWorldQuaternion(new THREE.Quaternion());
    this.rotateBoneWorld(this.bones[an], q2);
    const parentQ = this.bones[cn].parent!.getWorldQuaternion(new THREE.Quaternion());
    this.bones[cn].quaternion.copy(parentQ.invert().multiply(endWorld));
    this.bones[cn].updateMatrixWorld(true);
  }

  private updateContacts() {
    this.contacts.length = 0;
    this.contactBones.length = 0;
    const seen = new Map<number, THREE.Vector3[]>();
    this.computeSamples((s, p) => {
      if (p.y - FLOOR_Y < 0.018) {
        const arr = seen.get(s.bone) ?? [];
        arr.push(p.clone());
        seen.set(s.bone, arr);
      }
    });
    for (const [bone, pts] of seen) {
      const c = new THREE.Vector3();
      pts.forEach((p) => c.add(p));
      c.multiplyScalar(1 / pts.length);
      c.y = FLOOR_Y;
      this.contacts.push(c);
      this.contactBones.push(BONE_DEFS[bone].name);
    }
  }

  private contactTimer = 0;

  update(dt: number) {
    const step = this.paused ? 0 : dt * this.speed;
    if (this.current) {
      if (this.status === 'moving') {
        this.segT += step;
        const p = this.current.duration <= 0 ? 1 : this.segT / this.current.duration;
        this.applyInterpolation(Math.min(1, p));
        if (p >= 1) {
          this.status = 'holding';
          this.holdT = 0;
        }
      } else {
        this.applyInterpolation(1);
        this.holdT += step;
        if (this.queue.length && this.holdT >= (this.current.hold ?? 0)) {
          this.startSegment(this.queue.shift()!);
        } else if (!this.queue.length && this.onQueueDone && this.holdT >= (this.current.hold ?? 0)) {
          const cb = this.onQueueDone;
          this.onQueueDone = null;
          cb();
        }
      }
    }
    // Breathing only when the queue is idle at a held keyframe.
    if (!this.paused) this.applyBreathing(this.queue.length ? 0 : dt);
    else this.applyBreathing(0);

    if (this.grounding) {
      const { limbMin } = this.ground();
      if (this.plantLimbs(limbMin)) this.ground();
    }
    this.group.updateMatrixWorld(true);

    // Highlight uniforms (gentle pulse).
    const hl = this.hlUniforms;
    const cur = hl.uHlStrength.value;
    const pulse = 0.78 + 0.22 * Math.sin(performance.now() / 380);
    hl.uHlStrength.value = THREE.MathUtils.damp(cur, this.hlTarget * pulse, 6, dt || 0.016);
    for (let i = 0; i < HL_MAX; i++) {
      const v = hl.uHl.value[i];
      const j = this.highlights[i];
      if (!j) {
        if (hl.uHlStrength.value < 0.02) v.w = 0;
        continue;
      }
      this.getJointWorld(j, this._v);
      v.set(this._v.x, this._v.y, this._v.z, j === 'pelvis' || j === 'spine' || j === 'chest' ? 0.17 : j === 'head' ? 0.14 : 0.11);
    }

    this.contactTimer -= dt;
    if (this.contactTimer <= 0) {
      this.updateContacts();
      this.contactTimer = 0.12;
    }
  }
}
