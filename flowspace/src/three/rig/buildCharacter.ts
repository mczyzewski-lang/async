import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { neutralState, pose } from '@/content/poseState';
import type { PoseState } from '@/content/types';
import { BONE_DEFS, BONE_INDEX, bindPositions, createBoneQuats, poseToQuats, type BoneName } from './skeleton';

/**
 * Procedurally generated, skinned instructor.
 *
 * The body is ONE continuous surface: anatomical volumes (ellipsoids and tapered capsules attached
 * to bones) are blended with smooth signed-distance unions and polygonised with surface nets.
 * Shoulders flow into the chest and hips into the thighs, so limbs never detach from the trunk.
 * Skin weights are derived per body region from the position along each limb chain.
 *
 * Asset status: procedural, not a sculpted production character. Replaceable by a rigged GLB with
 * the same bone names (README → "3D asset requirements").
 */

export interface CharacterPalette {
  skin: string;
  top: string;
  leggings: string;
  hair: string;
}

export const DEFAULT_PALETTE: CharacterPalette = {
  skin: '#C99474',
  top: '#8C9A80',
  leggings: '#4A4B4F',
  hair: '#4A3428',
};

/** Bind pose: arms slightly abducted (A-pose) so arm volumes do not fuse with the ribcage. */
export const BIND_POSE: PoseState = pose(neutralState(), {
  shoulderL: { elev: 62, plane: 0, rot: 0 },
  shoulderR: { elev: 62, plane: 0, rot: 0 },
  elbowL: 0,
  elbowR: 0,
  wristL: { flex: 0, dev: 0, pron: 0 },
  wristR: { flex: 0, dev: 0, pron: 0 },
  fingersL: 0,
  fingersR: 0,
  hipL: { elev: 3, plane: 0, rot: 0 },
  hipR: { elev: 3, plane: 0, rot: 0 },
  kneeL: 0,
  kneeR: 0,
});

export function createSkeleton(): { root: THREE.Bone; bones: THREE.Bone[]; byName: Record<BoneName, THREE.Bone> } {
  const byName = {} as Record<BoneName, THREE.Bone>;
  const bones: THREE.Bone[] = [];
  for (const def of BONE_DEFS) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(...def.offset);
    if (def.parent) byName[def.parent].add(bone);
    byName[def.name] = bone;
    bones.push(bone);
  }
  return { root: byName.root, bones, byName };
}

/** Puts a skeleton into the bind pose (used for geometry generation and for binding). */
export function applyBindPose(byName: Record<BoneName, THREE.Bone>, root: THREE.Bone) {
  const q = poseToQuats(BIND_POSE, createBoneQuats(), false);
  for (const def of BONE_DEFS) byName[def.name].quaternion.copy(q[def.name]);
  root.position.set(...BONE_DEFS[0].offset);
  root.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------------------------
// Signed distance primitives
// ---------------------------------------------------------------------------------------------

type Region = 'torso' | 'head' | 'hair' | 'armL' | 'armR' | 'legL' | 'legR';

interface Prim {
  d: (x: number, y: number, z: number) => number;
  box: THREE.Box3;
}

const _p = new THREE.Vector3();

function ellipsoid(m: THREE.Matrix4, r: THREE.Vector3): Prim {
  const e = m.clone().invert().elements;
  const box = new THREE.Box3(r.clone().negate(), r.clone()).applyMatrix4(m);
  const irx = 1 / r.x;
  const iry = 1 / r.y;
  const irz = 1 / r.z;
  return {
    box,
    d: (x, y, z) => {
      const lx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const ly = e[1] * x + e[5] * y + e[9] * z + e[13];
      const lz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const ax = lx * irx;
      const ay = ly * iry;
      const az = lz * irz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
      const bx = ax * irx;
      const by = ay * iry;
      const bz = az * irz;
      const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      return k1 < 1e-9 ? -Math.min(r.x, r.y, r.z) : (k0 * (k0 - 1)) / k1;
    },
  };
}

/** Capsule with different end radii (round cone). */
function roundCone(a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number): Prim {
  const ba = b.clone().sub(a);
  const l2 = ba.lengthSq();
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const box = new THREE.Box3().setFromPoints([a, b]).expandByScalar(Math.max(r1, r2));
  return {
    box,
    d: (x, y, z) => {
      const px = x - a.x;
      const py = y - a.y;
      const pz = z - a.z;
      const yv = px * ba.x + py * ba.y + pz * ba.z;
      const zv = yv - l2;
      const qx = px * l2 - ba.x * yv;
      const qy = py * l2 - ba.y * yv;
      const qz = pz * l2 - ba.z * yv;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = yv * yv * l2;
      const z2 = zv * zv * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
      if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - r1;
    },
  };
}

function plane(point: THREE.Vector3, normal: THREE.Vector3) {
  const n = normal.clone().normalize();
  return (x: number, y: number, z: number) => (x - point.x) * n.x + (y - point.y) * n.y + (z - point.z) * n.z;
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

function boxDistance(b: THREE.Box3, x: number, y: number, z: number) {
  const dx = Math.max(b.min.x - x, 0, x - b.max.x);
  const dy = Math.max(b.min.y - y, 0, y - b.max.y);
  const dz = Math.max(b.min.z - z, 0, z - b.max.z);
  return dx === 0 && dy === 0 && dz === 0 ? 0 : Math.sqrt(dx * dx + dy * dy + dz * dz);
}

interface RegionField {
  prims: Prim[];
  k: number;
  box: THREE.Box3;
  post?: (x: number, y: number, z: number, d: number) => number;
}

function regionDistance(r: RegionField, x: number, y: number, z: number) {
  const out = boxDistance(r.box, x, y, z);
  if (out > 0) return out + 0.02;
  let d = 1e9;
  for (const p of r.prims) {
    if (boxDistance(p.box, x, y, z) > d + r.k) continue;
    d = smin(d, p.d(x, y, z), r.k);
  }
  return r.post ? r.post(x, y, z, d) : d;
}

// ---------------------------------------------------------------------------------------------
// Body volumes (offsets are relative to bone origins in the vertical rest frame)
// ---------------------------------------------------------------------------------------------

function buildRegions(world: Record<BoneName, THREE.Matrix4>) {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const at = (bone: BoneName, off: THREE.Vector3) => world[bone].clone().multiply(new THREE.Matrix4().makeTranslation(off.x, off.y, off.z));
  const pt = (bone: BoneName, off: THREE.Vector3) => off.clone().applyMatrix4(world[bone]);
  const E = (bone: BoneName, off: THREE.Vector3, r: THREE.Vector3) => ellipsoid(at(bone, off), r);
  const RC = (bone: BoneName, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number) => roundCone(pt(bone, a), pt(bone, b), r1, r2);

  const torso: Prim[] = [
    E('root', v(0, -0.03, -0.012), v(0.157, 0.105, 0.1)),
    E('root', v(0.068, -0.075, -0.042), v(0.083, 0.092, 0.074)),
    E('root', v(-0.068, -0.075, -0.042), v(0.083, 0.092, 0.074)),
    E('spine', v(0, 0.02, 0.004), v(0.123, 0.11, 0.079)),
    E('chest', v(0, 0.02, 0.012), v(0.14, 0.12, 0.094)),
    E('chest', v(0, 0.11, 0.0), v(0.152, 0.1, 0.09)),
    E('chest', v(0.05, 0.05, 0.066), v(0.052, 0.044, 0.036)),
    E('chest', v(-0.05, 0.05, 0.066), v(0.052, 0.044, 0.036)),
    RC('chest', v(-0.118, 0.168, -0.016), v(0.118, 0.168, -0.016), 0.052, 0.052),
    E('chest', v(0, 0.18, -0.032), v(0.105, 0.058, 0.066)),
    RC('neck', v(0, -0.035, 0.004), v(0, 0.1, 0.014), 0.051, 0.045),
  ];

  const head: Prim[] = [
    E('head', v(0, 0.088, 0.016), v(0.076, 0.1, 0.092)),
    E('head', v(0, 0.036, 0.026), v(0.054, 0.048, 0.06)),
    E('head', v(0, 0.074, 0.1), v(0.0105, 0.019, 0.013)),
    E('head', v(0.074, 0.082, 0.004), v(0.012, 0.025, 0.017)),
    E('head', v(-0.074, 0.082, 0.004), v(0.012, 0.025, 0.017)),
  ];

  const hairShell = E('head', v(0, 0.092, 0.006), v(0.084, 0.107, 0.1));
  const bun = E('head', v(0, 0.118, -0.098), v(0.044, 0.04, 0.036));
  // Hairline: high at the forehead, low at the nape.
  const hairCut = plane(pt('head', v(0, 0.135, 0.09)), v(0, -0.18, 0.115));

  const arm = (s: 'L' | 'R'): Prim[] => {
    const sx = s === 'L' ? 1 : -1;
    const ua = `upperArm${s}` as BoneName;
    const fa = `forearm${s}` as BoneName;
    const h = `hand${s}` as BoneName;
    return [
      E(ua, v(0.008 * sx, -0.02, -0.002), v(0.05, 0.07, 0.054)),
      RC(ua, v(0, 0, 0), v(0, -0.275, 0), 0.044, 0.035),
      E(ua, v(0, -0.13, 0.012), v(0.04, 0.085, 0.043)),
      E(ua, v(0, -0.12, -0.014), v(0.042, 0.09, 0.04)),
      RC(fa, v(0, 0.005, 0), v(0, -0.236, 0), 0.036, 0.024),
      E(fa, v(0.002 * sx, -0.07, 0.004), v(0.039, 0.075, 0.037)),
      E(h, v(0, 0.006, 0), v(0.019, 0.022, 0.027)),
    ];
  };

  const leg = (s: 'L' | 'R'): Prim[] => {
    const sx = s === 'L' ? 1 : -1;
    const th = `thigh${s}` as BoneName;
    const sh = `shin${s}` as BoneName;
    const ft = `foot${s}` as BoneName;
    const to = `toes${s}` as BoneName;
    return [
      RC(th, v(-0.006 * sx, 0.03, -0.006), v(0, -0.42, 0.004), 0.082, 0.048),
      E(th, v(0.008 * sx, -0.17, 0.024), v(0.066, 0.14, 0.058)),
      E(th, v(0.012 * sx, -0.05, -0.022), v(0.078, 0.1, 0.074)),
      E(sh, v(0, 0.0, 0.012), v(0.046, 0.05, 0.048)),
      E(sh, v(0, -0.12, -0.022), v(0.047, 0.1, 0.048)),
      RC(sh, v(0, 0, 0), v(0, -0.385, -0.004), 0.044, 0.026),
      E(ft, v(0, -0.028, -0.026), v(0.031, 0.04, 0.038)),
      E(ft, v(0.005 * sx, -0.045, 0.058), v(0.041, 0.027, 0.085)),
      E(to, v(0.004 * sx, -0.003, 0.03), v(0.039, 0.015, 0.045)),
    ];
  };

  const mk = (prims: Prim[], k: number, post?: RegionField['post']): RegionField => {
    const box = new THREE.Box3();
    prims.forEach((p) => box.union(p.box));
    box.expandByScalar(k + 0.01);
    return { prims, k, box, post };
  };

  const regions: Record<Region, RegionField> = {
    torso: mk(torso, 0.045),
    head: mk(head, 0.022),
    hair: mk([hairShell, bun], 0.02, (x, y, z) => smin(-smin(-hairShell.d(x, y, z), -hairCut(x, y, z), 0.012), bun.d(x, y, z), 0.01)),
    armL: mk(arm('L'), 0.022),
    armR: mk(arm('R'), 0.022),
    legL: mk(leg('L'), 0.03),
    legR: mk(leg('R'), 0.03),
  };
  return regions;
}

function fieldAt(regions: Record<Region, RegionField>, x: number, y: number, z: number) {
  const t = regionDistance(regions.torso, x, y, z);
  const al = regionDistance(regions.armL, x, y, z);
  const ar = regionDistance(regions.armR, x, y, z);
  const ll = regionDistance(regions.legL, x, y, z);
  const lr = regionDistance(regions.legR, x, y, z);
  const hd = regionDistance(regions.head, x, y, z);
  const hr = regionDistance(regions.hair, x, y, z);
  let d = smin(t, al, 0.03);
  d = smin(d, ar, 0.03);
  d = smin(d, ll, 0.035);
  d = smin(d, lr, 0.035);
  d = smin(d, hd, 0.025);
  d = smin(d, hr, 0.008);
  return { d, t, al, ar, ll, lr, hd, hr };
}

// ---------------------------------------------------------------------------------------------
// Surface nets polygonisation
// ---------------------------------------------------------------------------------------------

function surfaceNets(f: (x: number, y: number, z: number) => number, box: THREE.Box3, h: number) {
  const nx = Math.ceil((box.max.x - box.min.x) / h) + 1;
  const ny = Math.ceil((box.max.y - box.min.y) / h) + 1;
  const nz = Math.ceil((box.max.z - box.min.z) / h) + 1;
  const ox = box.min.x;
  const oy = box.min.y;
  const oz = box.min.z;
  const vals = new Float32Array(nx * ny * nz);
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  // Coarse-to-fine: sample a coarse grid first and evaluate the exact field only near the surface.
  const C = 4;
  const cx = Math.ceil((nx - 1) / C) + 1;
  const cy = Math.ceil((ny - 1) / C) + 1;
  const cz = Math.ceil((nz - 1) / C) + 1;
  const coarse = new Float32Array(cx * cy * cz);
  const cid = (i: number, j: number, k: number) => i + cx * (j + cy * k);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) coarse[cid(i, j, k)] = f(ox + i * C * h, oy + j * C * h, oz + k * C * h);
  const band = C * h * 1.1;
  for (let k = 0; k < nz; k++) {
    const kc = Math.min(cz - 2, Math.floor(k / C));
    const tk = k / C - kc;
    for (let j = 0; j < ny; j++) {
      const jc = Math.min(cy - 2, Math.floor(j / C));
      const tj = j / C - jc;
      for (let i = 0; i < nx; i++) {
        const ic = Math.min(cx - 2, Math.floor(i / C));
        const ti = i / C - ic;
        const c00 = coarse[cid(ic, jc, kc)] * (1 - ti) + coarse[cid(ic + 1, jc, kc)] * ti;
        const c10 = coarse[cid(ic, jc + 1, kc)] * (1 - ti) + coarse[cid(ic + 1, jc + 1, kc)] * ti;
        const c01 = coarse[cid(ic, jc, kc + 1)] * (1 - ti) + coarse[cid(ic + 1, jc, kc + 1)] * ti;
        const c11 = coarse[cid(ic, jc + 1, kc + 1)] * (1 - ti) + coarse[cid(ic + 1, jc + 1, kc + 1)] * ti;
        const approx = (c00 * (1 - tj) + c10 * tj) * (1 - tk) + (c01 * (1 - tj) + c11 * tj) * tk;
        vals[idx(i, j, k)] = Math.abs(approx) > band ? approx : f(ox + i * h, oy + j * h, oz + k * h);
      }
    }
  }

  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          cv[c] = vals[idx(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
          if (cv[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of edges) {
          if (cv[a] < 0 === cv[b] < 0) continue;
          const t = cv[a] / (cv[a] - cv[b]);
          sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
          sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
          sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
          n++;
        }
        cellVert[cidx(i, j, k)] = pos.length / 3;
        pos.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h);
      }

  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, b, c, a, c, d);
    else tris.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = vals[idx(i, j, k)] < 0;
        if (v0 !== vals[idx(i + 1, j, k)] < 0)
          quad(cellVert[cidx(i, j - 1, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j - 1, k)], v0);
        if (v0 !== vals[idx(i, j + 1, k)] < 0)
          quad(cellVert[cidx(i - 1, j, k - 1)], cellVert[cidx(i - 1, j, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j, k - 1)], v0);
        if (v0 !== vals[idx(i, j, k + 1)] < 0)
          quad(cellVert[cidx(i - 1, j - 1, k)], cellVert[cidx(i, j - 1, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], v0);
      }
  return { pos, tris };
}

// ---------------------------------------------------------------------------------------------
// Skin weights
// ---------------------------------------------------------------------------------------------

type W = Array<[BoneName, number]>;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Arc-length parameter of the closest point on a polyline. */
function chainParam(p: THREE.Vector3, pts: THREE.Vector3[]) {
  let best = Infinity;
  let bestS = 0;
  let acc = 0;
  const seg = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pts.length - 1; i++) {
    seg.subVectors(pts[i + 1], pts[i]);
    const len = seg.length();
    const t = THREE.MathUtils.clamp(tmp.subVectors(p, pts[i]).dot(seg) / (len * len), 0, 1);
    const d = tmp.copy(pts[i]).addScaledVector(seg, t).distanceTo(p);
    if (d < best) {
      best = d;
      bestS = acc + t * len;
    }
    acc += len;
  }
  return bestS;
}

/** Blend along a chain: joints[i] is the arc position where bones[i+1] takes over. */
function chainBlend(s: number, bones: BoneName[], joints: number[], zones: number[]): W {
  let w: W = [[bones[0], 1]];
  for (let i = 0; i < joints.length; i++) {
    const k = smooth(joints[i] - zones[i], joints[i] + zones[i], s);
    if (k <= 0) continue;
    w = w.map(([b, x]) => [b, x * (1 - k)] as [BoneName, number]);
    w.push([bones[i + 1], k]);
  }
  return w.filter(([, x]) => x > 0.002);
}

function mix(a: W, b: W, t: number): W {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const m = new Map<BoneName, number>();
  a.forEach(([k, x]) => m.set(k, (m.get(k) ?? 0) + x * (1 - t)));
  b.forEach(([k, x]) => m.set(k, (m.get(k) ?? 0) + x * t));
  return [...m.entries()];
}

// ---------------------------------------------------------------------------------------------
// Hands (finer than the voxel grid: palm + capsule fingers)
// ---------------------------------------------------------------------------------------------

function handGeometry(side: 'L' | 'R', world: Record<BoneName, THREE.Matrix4>, rest: Record<BoneName, THREE.Vector3>, skin: THREE.Color) {
  const s = side === 'L' ? 1 : -1;
  const hand = `hand${side}` as BoneName;
  const fing = `fingers${side}` as BoneName;
  const parts: Array<{ g: THREE.BufferGeometry; bone: BoneName; blend?: boolean }> = [];
  const wr = rest[hand];
  const fg = rest[fing];
  const palm = new THREE.SphereGeometry(1, 16, 12);
  const pa = palm.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i);
    const y = pa.getY(i);
    const z = pa.getZ(i);
    const f = (q: number) => Math.sign(q) * Math.pow(Math.abs(q), 0.62);
    pa.setXYZ(i, f(x) * 0.0135, f(y) * 0.05 * (y < 0 ? 1 : 0.92), f(z) * 0.039 * (y < 0 ? 1 : 0.85));
  }
  palm.translate(wr.x - 0.002 * s, wr.y - 0.048, wr.z + 0.002);
  parts.push({ g: palm, bone: hand, blend: true });
  const zs = [0.027, 0.009, -0.009, -0.026];
  const lens = [0.07, 0.078, 0.073, 0.058];
  const rads = [0.0085, 0.0088, 0.0083, 0.0072];
  zs.forEach((z, i) => {
    const c = new THREE.CapsuleGeometry(rads[i], lens[i], 4, 10);
    c.translate(0, -lens[i] / 2 - 0.004, 0);
    c.rotateX((i - 1.5) * -0.035);
    c.translate(fg.x - 0.001 * s, fg.y + 0.012, fg.z + z);
    parts.push({ g: c, bone: fing });
  });
  const t1 = new THREE.CapsuleGeometry(0.0115, 0.03, 4, 10);
  t1.translate(0, -0.02, 0);
  t1.rotateX(0.7);
  t1.rotateZ(0.12 * s);
  t1.translate(wr.x - 0.006 * s, wr.y - 0.022, wr.z + 0.03);
  parts.push({ g: t1, bone: hand });
  const t2 = new THREE.CapsuleGeometry(0.0095, 0.03, 4, 10);
  t2.translate(0, -0.018, 0);
  t2.rotateX(0.25);
  t2.translate(wr.x - 0.008 * s, wr.y - 0.058, wr.z + 0.054);
  parts.push({ g: t2, bone: hand });

  const out: THREE.BufferGeometry[] = [];
  for (const { g, bone, blend } of parts) {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const m = world[bone].clone().multiply(new THREE.Matrix4().makeTranslation(-rest[bone].x, -rest[bone].y, -rest[bone].z));
    const si: number[] = [];
    const sw: number[] = [];
    const col: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      _p.fromBufferAttribute(p, i).applyMatrix4(m);
      p.setXYZ(i, _p.x, _p.y, _p.z);
      if (blend) {
        const k = smooth(fg.y + 0.014, fg.y - 0.012, y);
        si.push(BONE_INDEX[hand], BONE_INDEX[fing], 0, 0);
        sw.push(1 - k, k, 0, 0);
      } else {
        si.push(BONE_INDEX[bone], 0, 0, 0);
        sw.push(1, 0, 0, 0);
      }
      col.push(skin.r, skin.g, skin.b);
    }
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setAttribute('aCloth', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
    g.setAttribute('aHair', new THREE.Float32BufferAttribute(new Float32Array(p.count), 1));
    g.setAttribute('aBind', new THREE.Float32BufferAttribute(Array.from(p.array as Float32Array), 3));
    out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

let cache: THREE.BufferGeometry | null = null;
let cacheKey = '';
const DEFAULT_KEY = JSON.stringify(DEFAULT_PALETTE) + 0.0095;

/** Installs a precomputed geometry (see characterAsset.ts) for the default palette. */
export function setCharacterGeometryCache(g: THREE.BufferGeometry) {
  cache = g;
  cacheKey = DEFAULT_KEY;
}

/** Builds (once, then cached) the skinned body geometry in the bind pose. */
/** Bind-pose height of the leggings' ankle cuff (used by the garment shader). */
export const ANKLE_CUFF_Y = 0.07 + 0.062;

export function buildCharacterGeometry(palette: CharacterPalette = DEFAULT_PALETTE, resolution = 0.0095): THREE.BufferGeometry {
  const key = JSON.stringify(palette) + resolution;
  if (cache && cacheKey === key) return cache.clone();

  const { root, byName } = createSkeleton();
  applyBindPose(byName, root);
  const rest = bindPositions();
  const world = Object.fromEntries(BONE_DEFS.map((b) => [b.name, byName[b.name].matrixWorld.clone()])) as Record<BoneName, THREE.Matrix4>;
  const J = (b: BoneName) => new THREE.Vector3().setFromMatrixPosition(world[b]);
  const regions = buildRegions(world);

  const bounds = new THREE.Box3();
  (Object.keys(regions) as Region[]).forEach((r) => bounds.union(regions[r].box));
  bounds.expandByScalar(resolution * 2);
  const F = (x: number, y: number, z: number) => fieldAt(regions, x, y, z).d;
  const T0 = performance.now();
  const { pos, tris } = surfaceNets(F, bounds, resolution);
  const T1 = performance.now();

  // Project vertices onto the surface; smooth normals from the field gradient.
  const n = pos.length / 3;
  const normals = new Float32Array(n * 3);
  const e = resolution * 0.35;
  for (let i = 0; i < n; i++) {
    let x = pos[i * 3];
    let y = pos[i * 3 + 1];
    let z = pos[i * 3 + 2];
    let gx = 0;
    let gy = 0;
    let gz = 0;
    for (let it = 0; it < 2; it++) {
      const d = F(x, y, z);
      gx = F(x + e, y, z) - F(x - e, y, z);
      gy = F(x, y + e, z) - F(x, y - e, z);
      gz = F(x, y, z + e) - F(x, y, z - e);
      const glen = Math.hypot(gx, gy, gz) || 1;
      const step = THREE.MathUtils.clamp(d / (glen / (2 * e)), -resolution * 0.5, resolution * 0.5);
      x -= (step * gx) / glen;
      y -= (step * gy) / glen;
      z -= (step * gz) / glen;
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const gl = Math.hypot(gx, gy, gz) || 1;
    normals[i * 3] = gx / gl;
    normals[i * 3 + 1] = gy / gl;
    normals[i * 3 + 2] = gz / gl;
  }

  const T2 = performance.now();
  // ------------------------------------------------------------------ weights & colours
  const skin = new THREE.Color(palette.skin);
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  const clothAttr = new Float32Array(n);
  const hairAttr = new Float32Array(n);

  const torsoBones: BoneName[] = ['root', 'spine', 'chest', 'neck', 'head'];
  const torsoJoints = [rest.spine.y, rest.chest.y, rest.neck.y, rest.head.y];
  const armChain = (s: 'L' | 'R') => {
    const pts = [J(`clav${s}` as BoneName), J(`upperArm${s}` as BoneName), J(`forearm${s}` as BoneName), J(`hand${s}` as BoneName), J(`fingers${s}` as BoneName)];
    const sShoulder = pts[0].distanceTo(pts[1]);
    const sElbow = sShoulder + pts[1].distanceTo(pts[2]);
    const sWrist = sElbow + pts[2].distanceTo(pts[3]);
    return { pts, joints: [sShoulder + 0.022, sElbow, sWrist + 0.006], zones: [0.03, 0.045, 0.014] };
  };
  const arms = { L: armChain('L'), R: armChain('R') };
  // One continuous clavicle→upper-arm transition measured along the bind-pose arm axis, shared by
  // torso and arm vertices; this keeps the deltoid smooth when the arm is raised overhead.
  const shoulderInfo = (sd: 'L' | 'R') => {
    const joint = J(`upperArm${sd}` as BoneName);
    const dir = J(`forearm${sd}` as BoneName).sub(joint).normalize();
    return { joint, dir };
  };
  const shoulders = { L: shoulderInfo('L'), R: shoulderInfo('R') };
  const _d = new THREE.Vector3();
  const shoulderW = (sd: 'L' | 'R', p: THREE.Vector3): W => {
    const a = _d.subVectors(p, shoulders[sd].joint).dot(shoulders[sd].dir);
    const u = smooth(-0.06, 0.07, a);
    const chest = (1 - u) * smooth(0.0, -0.1, a) * 0.4;
    return [[`upperArm${sd}` as BoneName, u], [`clav${sd}` as BoneName, 1 - u - chest], ['chest', chest]];
  };
  const legChain = (s: 'L' | 'R') => {
    const hip = J(`thigh${s}` as BoneName);
    const pts = [hip.clone().add(new THREE.Vector3(0, 0.12, 0)), hip, J(`shin${s}` as BoneName), J(`foot${s}` as BoneName)];
    const sHip = pts[0].distanceTo(pts[1]);
    const sKnee = sHip + pts[1].distanceTo(pts[2]);
    return { pts, joints: [sHip + 0.01, sKnee], zones: [0.05, 0.048] };
  };
  const legsC = { L: legChain('L'), R: legChain('R') };
  const P = new THREE.Vector3();
  const BLEND_BAND = 0.022;
  const ADJACENT: Record<Region, Region[]> = {
    torso: ['armL', 'armR', 'legL', 'legR', 'head'],
    armL: ['torso'],
    armR: ['torso'],
    legL: ['torso', 'legR'],
    legR: ['torso', 'legL'],
    head: ['torso', 'hair'],
    hair: ['head'],
  };
  const regionWeights = (region: Region, P: THREE.Vector3): W => {
    let w: W;
    if (region === 'torso') {
      w = chainBlend(P.y, torsoBones, torsoJoints, [0.055, 0.06, 0.03, 0.025]);
      // Shoulder caps follow the same continuous clavicle→arm transition as the arm itself.
      for (const sd of ['L', 'R'] as const) {
        const lateral = sd === 'L' ? P.x : -P.x;
        if (lateral < 0.04) continue;
        const k = smooth(0.2, 0.11, P.distanceTo(shoulders[sd].joint)) * smooth(0.04, 0.1, lateral);
        if (k > 0) w = mix(w, shoulderW(sd, P), k);
      }
    } else if (region === 'armL' || region === 'armR') {
      const s = region === 'armL' ? 'L' : 'R';
      const ch = arms[s];
      const sp = chainParam(P, ch.pts);
      const limb = chainBlend(sp, [`upperArm${s}`, `forearm${s}`, `hand${s}`] as BoneName[], ch.joints.slice(1), ch.zones.slice(1));
      const sw0 = shoulderW(s, P);
      const u = sw0.find(([b]) => b === `upperArm${s}`)?.[1] ?? 0;
      w = mix(sw0, limb, u);
    } else if (region === 'legL' || region === 'legR') {
      const s = region === 'legL' ? 'L' : 'R';
      const ch = legsC[s];
      const ankle = J(`foot${s}` as BoneName);
      const ball = J(`toes${s}` as BoneName);
      const sp = chainParam(P, ch.pts);
      const upper = chainBlend(sp, ['root', `thigh${s}`, `shin${s}`] as BoneName[], ch.joints, ch.zones);
      const kt = smooth(ball.z - 0.025, ball.z + 0.012, P.z);
      const foot: W = [[`foot${s}` as BoneName, 1 - kt], [`toes${s}` as BoneName, kt]];
      const kf = smooth(ankle.y + 0.06, ankle.y + 0.005, P.y);
      w = mix(upper, foot, kf);
    } else if (region === 'head') {
      w = mix([['head', 1]], [['neck', 1]], smooth(rest.head.y + 0.02, rest.head.y - 0.02, P.y));
    } else {
      w = [['head', 1]];
    }
    return w;
  };

  for (let i = 0; i < n; i++) {
    P.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const f = fieldAt(regions, P.x, P.y, P.z);
    const cands: Array<[Region, number]> = [
      ['torso', f.t], ['armL', f.al], ['armR', f.ar], ['legL', f.ll], ['legR', f.lr], ['head', f.hd], ['hair', f.hr],
    ];
    // Blend the weights of every region within the smooth-union band, so vertices on either
    // side of a seam (e.g. armpit, shoulder cap) follow the same bones and the skin never tears.
    const [best, dmin] = cands.reduce((a, b) => (b[1] < a[1] ? b : a));
    let w: W = [];
    let tot = 0;
    let cloth = 0;
    for (const [r, d] of cands) {
      if (r !== best && !ADJACENT[best].includes(r)) continue;
      // Arms only merge with the torso around the shoulder (in the bind pose the hands hang near the hips).
      if ((r === 'armL' || r === 'armR' || best === 'armL' || best === 'armR') && (r === 'torso' || best === 'torso')) {
        const side = r === 'armR' || best === 'armR' ? 'R' : 'L';
        if (P.distanceTo(J(`upperArm${side}` as BoneName)) > 0.17) continue;
      }
      const k = smooth(BLEND_BAND, 0, d - dmin);
      if (k <= 0) continue;
      w = tot === 0 ? regionWeights(r, P) : mix(w, regionWeights(r, P), k / (tot + k));
      tot += k;
      if (r === 'torso' || r === 'legL' || r === 'legR') cloth += k;
    }
    clothAttr[i] = cloth / tot;
    hairAttr[i] = smooth(0.007, -0.005, f.hr - Math.min(f.hd, f.t));
    const sorted = w.filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = sorted.reduce((a, [, x]) => a + x, 0) || 1;
    for (let k = 0; k < 4; k++) {
      si[i * 4 + k] = sorted[k] ? BONE_INDEX[sorted[k][0]] : 0;
      sw[i * 4 + k] = sorted[k] ? sorted[k][1] / sum : 0;
    }
  }

  void T0;
  void T1;
  void T2;
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  body.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  body.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  body.setAttribute('aCloth', new THREE.BufferAttribute(clothAttr, 1));
  body.setAttribute('aHair', new THREE.BufferAttribute(hairAttr, 1));
  body.setAttribute('aBind', new THREE.Float32BufferAttribute(pos, 3));
  body.setIndex(tris);

  const hands = [...handGeometry('L', world, rest, skin), ...handGeometry('R', world, rest, skin)];
  const merged = mergeGeometries([body, ...hands], false)!;
  merged.computeBoundingSphere();
  cache = merged;
  cacheKey = key;
  return merged.clone();
}
