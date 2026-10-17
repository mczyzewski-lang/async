import * as THREE from 'three';
import type { JointId, PoseState } from '@/content/types';
import { neutralState } from '@/content/poseState';
import { AvatarDriver, getAvatarTemplate, type AvatarSample } from './avatar';
import { BONE_DEFS, BONE_INDEX, JOINT_TO_BONE, createBoneQuats, createSkeleton, poseToQuats, type BoneName } from './skeleton';

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

const HL_MAX = 6;
const LIMBS = ['handL', 'handR', 'footL', 'footR'] as const;

export class InstructorRig {
  readonly group = new THREE.Group();
  readonly bones: Record<BoneName, THREE.Bone>;
  /** The visible avatar (null only when the asset could not be loaded). */
  readonly avatar: AvatarDriver | null;
  private readonly materials: THREE.Material[] = [];

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

  constructor() {
    const { root, byName } = createSkeleton();
    this.bones = byName;
    this.group.add(root);
    this.group.updateMatrixWorld(true);
    const tpl = getAvatarTemplate();
    this.avatar = tpl ? new AvatarDriver(tpl, this.group, byName) : null;
    for (const mesh of this.avatar?.meshes ?? []) {
      // Each rig gets its own materials (highlight uniforms are per instructor).
      const mat = (mesh.material as THREE.Material).clone();
      const std = mat as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        std.metalness = 0;
        // The body carries a roughness map (matte fabric, softer skin); hair and brows use a factor.
        std.roughness = std.roughnessMap ? 1 : /brow/i.test(mesh.name) ? 0.9 : 0.68;
      }
      this.installHighlightShader(mat);
      mesh.material = mat;
      mesh.castShadow = !/brow|high-poly/i.test(mesh.name);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.materials.push(mat);
    }
    this.setPose(neutralState(), 0);
    this.update(0);
  }

  setWireframe(on: boolean) {
    for (const m of this.materials) (m as THREE.MeshStandardMaterial).wireframe = on;
  }

  /** Frees GPU resources; the rig stays usable (React StrictMode re-runs effects). */
  dispose() {
    this.materials.forEach((m) => m.dispose());
  }

  private installHighlightShader(mat: THREE.Material) {
    const u = this.hlUniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRigWorld;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
vRigWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
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
    mat.customProgramCacheKey = () => 'flowspace-avatar-hl-2';
  }

  // ------------------------------------------------------------------ public API

  /** Immediately (duration 0) or smoothly move to a state. Clears any queued segments. */
  setPose(state: PoseState, duration = 0.8, tag = 'pose') {
    this.queue = [];
    this.onQueueDone = null;
    this.startSegment({ state, duration, tag });
    if (duration <= 0) {
      // a jump: no smoothing from the previous pose's balance corrections
      this.tilt.a = this.tilt.b = 0;
      this.tip.angle = this.tipB.angle = 0;
      this.applyInterpolation(1);
    }
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
    this.planContacts(seg);
  }

  // ------------------------------------------------------------------ contact persistence
  /**
   * Interpolating joint angles between two floor poses lifts body parts that should stay down
   * (e.g. the back while rolling into a bridge, the knees while kneeling down), and grounding only
   * pins the lowest point, so the body seems to hover. At the start of every movement we find the
   * parts resting on the mat at BOTH ends; while moving, the whole body is tilted (pitch/roll) and
   * lowered so those parts stay on the mat, without pushing anything through it.
   */
  settle = true;
  /** Driver bones (body parts) kept on the mat during the current movement / hold. */
  persist: BoneName[] = [];
  private holdContacts: BoneName[] = [];
  private tilt = { a: 0, b: 0 };
  private cache: { x: Float32Array; y: Float32Array; z: Float32Array; g: Uint8Array; limb: Int8Array; n: number } | null = null;
  /** Whether the cache matches the current skeleton (rigid whole-body moves keep it valid). */
  private cacheValid = false;
  private static readonly CONTACT_TOL = 0.02;

  /** Fills the sample cache (group-space positions + body part) for the current pose. */
  private fillCache() {
    if (!this.avatar) return null;
    const n = this.avatar.samples.length;
    if (!this.cache || this.cache.x.length !== n) {
      this.cache = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), g: new Uint8Array(n), limb: new Int8Array(n), n };
    }
    const c = this.cache;
    let i = 0;
    this.computeSamples((sm, p) => {
      c.x[i] = p.x;
      c.y[i] = p.y;
      c.z[i] = p.z;
      c.g[i] = BONE_INDEX[sm.driver];
      c.limb[i] = sm.limb ? LIMBS.indexOf(sm.limb) : -1;
      i++;
    });
    this.cacheValid = true;
    return c;
  }

  /** Current samples, re-skinned only when the pose changed non-rigidly. */
  private samples() {
    return this.cacheValid && this.cache ? this.cache : this.fillCache();
  }

  /**
   * Moves the whole body rigidly: rotation R about `pivot`, then lifted by dy. Applied to the root
   * bone and to the cached samples (no re-skinning needed).
   */
  private moveRigid(R: THREE.Quaternion | null, pivot: THREE.Vector3, dy: number) {
    const root = this.bones.root;
    if (R) {
      root.position.sub(pivot).applyQuaternion(R).add(pivot);
      root.quaternion.premultiply(R);
    }
    root.position.y += dy;
    const c = this.cache;
    if (!c || !this.cacheValid) return;
    const v = this._T;
    for (let i = 0; i < c.n; i++) {
      v.set(c.x[i], c.y[i], c.z[i]);
      if (R) v.sub(pivot).applyQuaternion(R).add(pivot);
      c.x[i] = v.x;
      c.y[i] = v.y + dy;
      c.z[i] = v.z;
    }
  }

  /** Lowest point of every body part (height above the mat after grounding) and its joint x/z. */
  private partMins() {
    const c = this.fillCache();
    const n = BONE_DEFS.length;
    const out = { y: new Float32Array(n).fill(Infinity), x: new Float32Array(n), z: new Float32Array(n) };
    if (!c) return out;
    let low = Infinity;
    for (let i = 0; i < c.n; i++) low = Math.min(low, c.y[i]);
    for (let i = 0; i < c.n; i++) {
      const g = c.g[i];
      const h = c.y[i] - low + FLOOR_Y;
      if (h < out.y[g]) out.y[g] = h;
    }
    // where each part is: its joint (the lowest point can jump, e.g. from buttock to outer thigh)
    BONE_DEFS.forEach((d, i) => {
      const p = this.bones[d.name].getWorldPosition(this._C);
      out.x[i] = p.x;
      out.z[i] = p.z;
    });
    return out;
  }

  private planContacts(seg: Segment) {
    this.persist = [];
    this.holdContacts = [];
    if (!this.avatar || seg.duration <= 0) return;
    const tol = FLOOR_Y + InstructorRig.CONTACT_TOL;
    const from = this.partMins();
    // evaluate the target pose, then restore the current one
    const savedQ = BONE_DEFS.map((d) => this.bones[d.name].quaternion.clone());
    const savedP = this.bones.root.position.clone();
    for (const d of BONE_DEFS) this.bones[d.name].quaternion.copy(this.toQ[d.name]);
    this.bones.root.position.set(this.toRoot.x, savedP.y, this.toRoot.y);
    const to = this.partMins();
    BONE_DEFS.forEach((d, i) => this.bones[d.name].quaternion.copy(savedQ[i]));
    this.bones.root.position.copy(savedP);
    this.cacheValid = false;
    BONE_DEFS.forEach((d, i) => {
      if (to.y[i] >= tol) return;
      this.holdContacts.push(d.name);
      // a part that rests on the same spot at both ends stays down (a stepping foot may lift)
      const moved = Math.hypot(to.x[i] - from.x[i], to.z[i] - from.z[i]);
      if (from.y[i] < tol && moved < 0.12) this.persist.push(d.name);
    });
  }

  private tip = { angle: 0, dx: 0, dz: 0 };

  /** How far (m) the centre of mass lies outside the current support area (diagnostics). */
  supportGap() {
    const c = this.samples();
    if (!c) return 0;
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < c.n; i++)
      if (c.y[i] < FLOOR_Y + 0.012) {
        xs.push(c.x[i]);
        zs.push(c.z[i]);
      }
    if (!xs.length) return 1;
    const com = this.getCenterOfMass(this._A);
    const r = nearestOnHull(convexHull(xs, zs), com.x, com.z);
    return r.inside ? 0 : r.dist;
  }
  /** Distance (m) the centre of mass was outside the support area this frame, before balancing. */
  unsupported = 0;
  private tipB = { angle: 0, dx: 0, dz: 0 };
  private balance2(dt: number) {
    const keep = this.tip;
    this.tip = this.tipB;
    this.balance(dt);
    this.tipB = this.tip;
    this.tip = keep;
  }

  /**
   * Balance: a body resting only on its toes while leaning far forward cannot stay in the air. When
   * the centre of mass leaves the support area, the body tips towards it around the nearest support
   * edge until another part (hands, knees, back) meets the mat. Blended softly so it never pops.
   */
  private balance(dt: number) {
    const c = this.samples();
    if (!c) return;
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < c.n; i++)
      if (c.y[i] < FLOOR_Y + 0.012) {
        xs.push(c.x[i]);
        zs.push(c.z[i]);
      }
    const com = this.getCenterOfMass(this._A);
    let target = 0;
    let dx = this.tip.dx;
    let dz = this.tip.dz;
    let qx = 0;
    let qz = 0;
    if (xs.length) {
      const hull = convexHull(xs, zs);
      const { inside, px, pz, dist } = nearestOnHull(hull, com.x, com.z);
      const outside = inside ? 0 : dist;
      if (com.y < 0.8) this.unsupported = Math.max(this.unsupported, outside);
      if (outside > 0.02) {
        const len = Math.hypot(com.x - px, com.z - pz) || 1;
        dx = (com.x - px) / len;
        dz = (com.z - pz) / len;
        qx = px;
        qz = pz;
        // smallest rotation (about the support edge) that brings another point down to the mat
        let theta = THREE.MathUtils.degToRad(45);
        for (let i = 0; i < c.n; i += 2) {
          const sDist = (c.x[i] - px) * dx + (c.z[i] - pz) * dz;
          if (sDist < 0.03) continue;
          const h = c.y[i] - FLOOR_Y;
          if (h < 0.012) continue;
          theta = Math.min(theta, Math.atan2(h, sDist));
        }
        // only near the floor: an upright body shifts its weight when stepping instead of tipping
        target = theta * THREE.MathUtils.smoothstep(outside, 0.02, 0.05) * (1 - THREE.MathUtils.smoothstep(com.y, 0.7, 0.85));
      }
    }
    const k = dt > 0 && this.current && this.current.duration > 0 ? 1 - Math.exp(-dt * 16) : 1;
    this.tip.angle += (target - this.tip.angle) * k;
    this.tip.dx = dx;
    this.tip.dz = dz;
    if (this.tip.angle < 1e-4) return;
    // rotation axis: horizontal, perpendicular to the tipping direction
    const axis = this._n.set(-dz, 0, dx).normalize();
    const R = this._qa.setFromAxisAngle(axis, -this.tip.angle);
    this.moveRigid(R, this._B.set(qx || com.x, FLOOR_Y, qz || com.z), 0);
  }

  /** Tilts and lowers the body so that the persisting contacts rest on the mat. */
  private settleContacts(dt: number) {
    const parts = this.status === 'holding' ? this.holdContacts : this.persist;
    if (!this.settle || parts.length < 2) {
      this.tilt.a = this.tilt.b = 0;
      return;
    }
    const c = this.samples();
    if (!c) return;
    const ids = parts.map((p) => BONE_INDEX[p]);
    // candidate points: the lowest few of each part, plus a sparse set of all points (no penetration)
    const per: number[][] = ids.map(() => []);
    const pen: number[] = [];
    for (let i = 0; i < c.n; i++) {
      const k = ids.indexOf(c.g[i]);
      if (k >= 0) per[k].push(i);
      else if (i % 2 === 0) pen.push(i);
    }
    for (let k = 0; k < per.length; k++) per[k] = per[k].sort((u, v) => c.y[u] - c.y[v]).slice(0, 24);
    let cx = 0;
    let cz = 0;
    for (const g of per) {
      cx += c.x[g[0]];
      cz += c.z[g[0]];
    }
    cx /= per.length;
    cz /= per.length;
    const cy = FLOOR_Y;
    const rotY = (i: number, a: number, b: number) => {
      // p' = c + Rz(b) Rx(a) (p - c); only y is needed
      const x = c.x[i] - cx;
      const y = c.y[i] - cy;
      const z = c.z[i] - cz;
      const y1 = y * Math.cos(a) - z * Math.sin(a);
      return cy + x * Math.sin(b) + y1 * Math.cos(b);
    };
    const evaluate = (a: number, b: number) => {
      const m = per.map((g) => g.reduce((lo, i) => Math.min(lo, rotY(i, a, b)), Infinity));
      let low = Math.min(...m);
      for (const i of pen) low = Math.min(low, rotY(i, a, b));
      const mean = m.reduce((s2, x) => s2 + (FLOOR_Y - x), 0) / m.length;
      const dy = Math.max(FLOOR_Y - low, mean);
      const cost = m.reduce((s2, x) => s2 + (x + dy - FLOOR_Y) ** 2, 0) + 0.004 * (a * a + b * b);
      return { cost, dy };
    };
    const LIM = THREE.MathUtils.degToRad(35);
    let a = this.tilt.a;
    let b = this.tilt.b;
    let best = evaluate(a, b);
    for (let step = THREE.MathUtils.degToRad(4); step > THREE.MathUtils.degToRad(0.2); step /= 2) {
      let moved = true;
      for (let it = 0; it < 8 && moved; it++) {
        moved = false;
        for (const [da, db] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
          const na = THREE.MathUtils.clamp(a + da, -LIM, LIM);
          const nb = THREE.MathUtils.clamp(b + db, -LIM, LIM);
          const r = evaluate(na, nb);
          if (r.cost < best.cost - 1e-9) {
            a = na;
            b = nb;
            best = r;
            moved = true;
          }
        }
      }
    }
    // gentle smoothing so the tilt never pops
    const k = dt > 0 && this.current && this.current.duration > 0 ? 1 - Math.exp(-dt * 14) : 1;
    this.tilt.a += (a - this.tilt.a) * k;
    this.tilt.b += (b - this.tilt.b) * k;
    const R = this._q.setFromEuler(this._e.set(this.tilt.a, 0, this.tilt.b, 'ZYX'));
    this.moveRigid(R, this._v.set(cx, cy, cz), evaluate(this.tilt.a, this.tilt.b).dy);
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

  private _v = new THREE.Vector3();

  /** Visits the avatar's skinned surface samples in group space (after copying the driver pose). */
  private computeSamples(cb: (s: AvatarSample, p: THREE.Vector3) => void) {
    if (!this.avatar) return;
    this.avatar.sync();
    this.avatar.forEachSample(cb);
  }

  private ground() {
    const limbMin: Record<string, number> = { handL: Infinity, handR: Infinity, footL: Infinity, footR: Infinity };
    const c = this.samples();
    if (!c) return { limbMin };
    let minY = Infinity;
    for (let i = 0; i < c.n; i++) {
      const y = c.y[i];
      if (y < minY) minY = y;
      const l = c.limb[i];
      if (l >= 0 && y < limbMin[LIMBS[l]]) limbMin[LIMBS[l]] = y;
    }
    if (minY === Infinity) return { limbMin };
    const dy = FLOOR_Y - minY;
    this.moveRigid(null, this._v, dy);
    return { limbMin: Object.fromEntries(Object.entries(limbMin).map(([k, v]) => [k, v + dy])) };
  }

  private plantLimbs(limbMin: Record<string, number>) {
    if (!this.enableIK) return false;
    const plant = this.targetState.plant ?? {};
    let changed = false;
    const chains: Record<string, [BoneName, BoneName, BoneName]> = {
      handL: ['upperArmL', 'forearmL', 'handL'],
      handR: ['upperArmR', 'forearmR', 'handR'],
      footL: ['thighL', 'shinL', 'footL'],
      footR: ['thighR', 'shinR', 'footR'],
    };
    // Planted limbs of the target fade in near the keyframe (no tugging during long transitions)...
    const fade = this.status === 'holding' ? 1 : Math.max(0, (this.segProgress() - 0.6) / 0.4);
    // ...while hands/feet resting on the mat at both ends of a movement slide along it all the way.
    const persisting = (key: string) =>
      this.status === 'moving' && this.settle && this.persist.some((p) => p === key || p === key.replace('hand', 'fingers').replace('foot', 'toes'));
    for (const key of Object.keys(chains) as Array<keyof typeof chains>) {
      const keep = persisting(key);
      if (!plant[key as 'handL'] && !keep) continue;
      const gap = limbMin[key] - FLOOR_Y;
      const w = keep ? 1 : fade;
      // while moving, a limb already resting on the mat is left alone (IK would only disturb it)
      const still = this.status === 'holding' ? 0.002 : 0.01;
      if (Math.abs(gap) < still || Math.abs(gap) > (keep ? 0.6 : 0.08)) continue;
      const [a, b, c] = chains[key];
      // near-straight limbs can respond to a tiny correction the wrong way; keep only improvements
      const saved = [a, b, c].map((n) => this.bones[n as BoneName].quaternion.clone());
      const y0 = this.bones[c].getWorldPosition(this._T).y;
      this.solveTwoBone(a, b, c, -gap * w);
      const y1 = this.bones[c].getWorldPosition(this._T).y;
      if (Math.sign(y1 - y0) !== Math.sign(-gap) && Math.abs(y1 - y0) > 1e-4) {
        [a, b, c].forEach((n, i) => this.bones[n as BoneName].quaternion.copy(saved[i]));
        this.bones[a].updateMatrixWorld(true);
        continue;
      }
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
    const seen = new Map<BoneName, THREE.Vector3[]>();
    const c = this.samples();
    if (!c) return;
    for (let i = 0; i < c.n; i++) {
      if (c.y[i] - FLOOR_Y >= 0.018) continue;
      const bone = BONE_DEFS[c.g[i]].name;
      const arr = seen.get(bone) ?? [];
      arr.push(new THREE.Vector3(c.x[i], c.y[i], c.z[i]));
      seen.set(bone, arr);
    }
    for (const [bone, pts] of seen) {
      const c = new THREE.Vector3();
      pts.forEach((p) => c.add(p));
      c.multiplyScalar(1 / pts.length);
      c.y = FLOOR_Y;
      this.contacts.push(c);
      this.contactBones.push(bone);
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
    this.cacheValid = false;
    if (!this.paused) this.applyBreathing(this.queue.length ? 0 : dt);
    else this.applyBreathing(0);

    if (this.grounding) {
      this.ground();
      this.settleContacts(dt);
      this.ground();
      this.unsupported = 0;
      if (this.settle) {
        this.balance(dt);
        this.ground();
        this.balance2(dt);
      }
      const { limbMin } = this.ground();
      if (this.plantLimbs(limbMin)) {
        this.cacheValid = false;
        this.ground();
      }
    }
    this.group.updateMatrixWorld(true);
    this.avatar?.sync();

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

/** Convex hull (x/z) of the support points (monotone chain). */
function convexHull(xs: number[], zs: number[]) {
  const pts = xs.map((x, i) => [x, zs[i]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Whether (x, z) lies inside the hull, and the nearest point of the hull to it. */
function nearestOnHull(hull: [number, number][], x: number, z: number) {
  if (hull.length === 1) return { inside: false, px: hull[0][0], pz: hull[0][1], dist: Math.hypot(x - hull[0][0], z - hull[0][1]) };
  let inside = hull.length >= 3;
  let best = Infinity;
  let px = hull[0][0];
  let pz = hull[0][1];
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    if (hull.length >= 3 && (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) inside = false;
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const t = THREE.MathUtils.clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1);
    const cx = a[0] + ex * t;
    const cz = a[1] + ez * t;
    const d = Math.hypot(x - cx, z - cz);
    if (d < best) {
      best = d;
      px = cx;
      pz = cz;
    }
  }
  return { inside, px, pz, dist: best };
}
