import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BONE_DEFS, BONE_INDEX, bindPositions, type BoneName } from './skeleton';

/**
 * Procedurally generated, skinned instructor.
 *
 * NOTE (asset status): this is an authored procedural character, not a scanned or sculpted
 * production asset. Body proportions follow average adult anthropometry. It is designed to be
 * replaced by a rigged GLB with the same bone names (see README → "3D asset requirements").
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

type W = Array<[BoneName, number]>;

interface Ring {
  /** Position along the axis (y for vertical tubes, z for the foot). */
  t: number;
  a: number;
  b: number;
  /** Offsets on the two cross-section axes. */
  ca?: number;
  cb?: number;
  /** Superellipse exponent (2 = ellipse). */
  p?: number;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Blend weights for a chain of bones with joints at given axis positions (descending or ascending). */
function chainWeights(t: number, chain: Array<{ bone: BoneName; at: number; zone: number }>, descending: boolean): W {
  // chain[0] is the most proximal bone; chain[i].at is the joint where bone i starts.
  let w: W = [[chain[0].bone, 1]];
  for (let i = 1; i < chain.length; i++) {
    const j = chain[i];
    const k = descending ? smooth(j.at + j.zone, j.at - j.zone, t) : smooth(j.at - j.zone, j.at + j.zone, t);
    if (k <= 0) continue;
    w = w.map(([b, x]) => [b, x * (1 - k)] as [BoneName, number]);
    w.push([j.bone, k]);
  }
  return w.filter(([, x]) => x > 0.001);
}

class Builder {
  parts: THREE.BufferGeometry[] = [];

  private finish(
    pos: number[],
    idx: number[],
    weights: W[],
    colors: THREE.Color[],
  ) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const si: number[] = [];
    const sw: number[] = [];
    const col: number[] = [];
    weights.forEach((w, i) => {
      const sorted = [...w].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = sorted.reduce((s, [, x]) => s + x, 0) || 1;
      for (let k = 0; k < 4; k++) {
        si.push(sorted[k] ? BONE_INDEX[sorted[k][0]] : 0);
        sw.push(sorted[k] ? sorted[k][1] / sum : 0);
      }
      col.push(colors[i].r, colors[i].g, colors[i].b);
    });
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.parts.push(g);
  }

  /**
   * Tube along an axis. origin + axis*t is the ring centre; u/v are the cross-section axes.
   */
  tube(opts: {
    rings: Ring[];
    origin: THREE.Vector3;
    axis: THREE.Vector3;
    u: THREE.Vector3;
    v: THREE.Vector3;
    segs: number;
    weight: (t: number, p: THREE.Vector3) => W;
    color: (t: number, p: THREE.Vector3, angle: number) => THREE.Color;
    capStart?: boolean;
    capEnd?: boolean;
  }) {
    const { rings, origin, axis, u, v, segs } = opts;
    const pos: number[] = [];
    const idx: number[] = [];
    const weights: W[] = [];
    const colors: THREE.Color[] = [];
    const p = new THREE.Vector3();
    rings.forEach((r) => {
      const ex = r.p ?? 2;
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const ce = Math.sign(c) * Math.pow(Math.abs(c), 2 / ex);
        const se = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / ex);
        p.copy(origin)
          .addScaledVector(axis, r.t)
          .addScaledVector(u, (r.ca ?? 0) + r.a * ce)
          .addScaledVector(v, (r.cb ?? 0) + r.b * se);
        pos.push(p.x, p.y, p.z);
        weights.push(opts.weight(r.t, p));
        colors.push(opts.color(r.t, p, ang));
      }
    });
    for (let i = 0; i < rings.length - 1; i++) {
      for (let s = 0; s < segs; s++) {
        const a = i * segs + s;
        const b = i * segs + ((s + 1) % segs);
        const c = (i + 1) * segs + s;
        const d = (i + 1) * segs + ((s + 1) % segs);
        idx.push(a, c, b, b, c, d);
      }
    }
    const cap = (ri: number, flip: boolean) => {
      const r = rings[ri];
      const centre = origin.clone().addScaledVector(axis, r.t).addScaledVector(u, r.ca ?? 0).addScaledVector(v, r.cb ?? 0);
      const ci = pos.length / 3;
      pos.push(centre.x, centre.y, centre.z);
      weights.push(opts.weight(r.t, centre));
      colors.push(opts.color(r.t, centre, 0));
      for (let s = 0; s < segs; s++) {
        const a = ri * segs + s;
        const b = ri * segs + ((s + 1) % segs);
        if (flip) idx.push(ci, a, b);
        else idx.push(ci, b, a);
      }
    };
    // Orientation: decide winding from the axis/u/v handedness.
    const descending = rings.length > 1 && rings[1].t < rings[0].t;
    const handed = (new THREE.Vector3().crossVectors(u, v).dot(axis) > 0) !== descending;
    // With axis × v = u (left-handed u,v,axis) the quads face outward as written.
    // Cap normals must point away from the neighbouring ring (after the optional global flip).
    const uv = new THREE.Vector3().crossVectors(u, v);
    const capFlip = (outward: THREE.Vector3) => uv.dot(handed ? outward.clone().negate() : outward) > 0;
    const sgn = descending ? 1 : -1;
    if (opts.capStart) cap(0, capFlip(axis.clone().multiplyScalar(sgn)));
    if (opts.capEnd) cap(rings.length - 1, capFlip(axis.clone().multiplyScalar(-sgn)));
    if (handed) {
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i + 1];
        idx[i + 1] = idx[i + 2];
        idx[i + 2] = t;
      }
    }
    this.finish(pos, idx, weights, colors);
  }

  /** Superellipsoid blob (hands, head parts). */
  blob(opts: {
    centre: THREE.Vector3;
    radii: THREE.Vector3;
    exp?: number;
    rotation?: THREE.Euler;
    w: number;
    h: number;
    deform?: (n: THREE.Vector3, p: THREE.Vector3) => void;
    weight: (p: THREE.Vector3) => W;
    color: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color;
    thetaLength?: number;
  }) {
    const g = new THREE.SphereGeometry(1, opts.w, opts.h, 0, Math.PI * 2, 0, opts.thetaLength ?? Math.PI);
    const ex = opts.exp ?? 2;
    const pa = g.getAttribute('position') as THREE.BufferAttribute;
    const n = new THREE.Vector3();
    const p = new THREE.Vector3();
    const pos: number[] = [];
    const weights: W[] = [];
    const colors: THREE.Color[] = [];
    const q = new THREE.Quaternion().setFromEuler(opts.rotation ?? new THREE.Euler());
    for (let i = 0; i < pa.count; i++) {
      n.fromBufferAttribute(pa, i);
      const f = (x: number) => Math.sign(x) * Math.pow(Math.abs(x), 2 / ex);
      p.set(f(n.x) * opts.radii.x, f(n.y) * opts.radii.y, f(n.z) * opts.radii.z);
      opts.deform?.(n, p);
      p.applyQuaternion(q).add(opts.centre);
      pos.push(p.x, p.y, p.z);
      weights.push(opts.weight(p));
      colors.push(opts.color(p, n));
    }
    // SphereGeometry duplicates seam vertices: merge them so normals are smooth.
    const idx = Array.from(g.getIndex()!.array);
    const keyMap = new Map<string, number>();
    const remap: number[] = [];
    const upos: number[] = [];
    const uw: W[] = [];
    const uc: THREE.Color[] = [];
    for (let i = 0; i < pos.length / 3; i++) {
      const key = `${pos[i * 3].toFixed(5)},${pos[i * 3 + 1].toFixed(5)},${pos[i * 3 + 2].toFixed(5)}`;
      let k = keyMap.get(key);
      if (k === undefined) {
        k = upos.length / 3;
        keyMap.set(key, k);
        upos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        uw.push(weights[i]);
        uc.push(colors[i]);
      }
      remap.push(k);
    }
    const nidx: number[] = [];
    for (let i = 0; i < idx.length; i += 3) {
      const a = remap[idx[i]];
      const b = remap[idx[i + 1]];
      const c = remap[idx[i + 2]];
      if (a !== b && b !== c && a !== c) nidx.push(a, b, c);
    }
    g.dispose();
    this.finish(upos, nidx, uw, uc);
  }
}

export function buildCharacterGeometry(palette: CharacterPalette = DEFAULT_PALETTE): THREE.BufferGeometry {
  const B = bindPositions();
  const b = new Builder();
  const skin = new THREE.Color(palette.skin);
  const top = new THREE.Color(palette.top);
  const legs = new THREE.Color(palette.leggings);
  const hair = new THREE.Color(palette.hair);
  const X = new THREE.Vector3(1, 0, 0);
  const Yv = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);

  // ---------------------------------------------------------------- torso + neck
  const torsoRings: Ring[] = [
    { t: 0.795, a: 0.05, b: 0.045, cb: 0.0 },
    { t: 0.82, a: 0.112, b: 0.078, cb: -0.004 },
    { t: 0.855, a: 0.155, b: 0.098, cb: -0.012, p: 2.2 },
    { t: 0.895, a: 0.168, b: 0.104, cb: -0.013, p: 2.3 },
    { t: 0.935, a: 0.166, b: 0.097, cb: -0.006, p: 2.3 },
    { t: 0.975, a: 0.155, b: 0.09, cb: 0.0, p: 2.3 },
    { t: 1.015, a: 0.141, b: 0.085, cb: 0.003, p: 2.2 },
    { t: 1.032, a: 0.136, b: 0.084, cb: 0.003, p: 2.2 },
    { t: 1.04, a: 0.134, b: 0.083, cb: 0.004, p: 2.2 },
    { t: 1.07, a: 0.127, b: 0.082, cb: 0.004, p: 2.2 },
    { t: 1.11, a: 0.128, b: 0.085, cb: 0.006, p: 2.3 },
    { t: 1.15, a: 0.136, b: 0.09, cb: 0.008, p: 2.4 },
    { t: 1.19, a: 0.146, b: 0.096, cb: 0.011, p: 2.4 },
    { t: 1.23, a: 0.152, b: 0.101, cb: 0.016, p: 2.4 },
    { t: 1.27, a: 0.155, b: 0.104, cb: 0.019, p: 2.4 },
    { t: 1.31, a: 0.158, b: 0.1, cb: 0.015, p: 2.5 },
    { t: 1.35, a: 0.163, b: 0.092, cb: 0.006, p: 2.6 },
    { t: 1.38, a: 0.164, b: 0.084, cb: -0.002, p: 2.6 },
    { t: 1.405, a: 0.15, b: 0.074, cb: -0.008, p: 2.5 },
    { t: 1.428, a: 0.118, b: 0.064, cb: -0.012, p: 2.2 },
    { t: 1.448, a: 0.072, b: 0.054, cb: -0.012 },
    { t: 1.47, a: 0.054, b: 0.051, cb: -0.009 },
    { t: 1.51, a: 0.05, b: 0.049, cb: -0.005 },
    { t: 1.545, a: 0.047, b: 0.047, cb: -0.001 },
    { t: 1.575, a: 0.038, b: 0.038, cb: 0.0 },
  ];
  const torsoChain = [
    { bone: 'root' as BoneName, at: 0, zone: 0 },
    { bone: 'spine' as BoneName, at: B.spine.y, zone: 0.055 },
    { bone: 'chest' as BoneName, at: B.chest.y, zone: 0.06 },
    { bone: 'neck' as BoneName, at: B.neck.y, zone: 0.03 },
    { bone: 'head' as BoneName, at: B.head.y, zone: 0.025 },
  ];
  b.tube({
    rings: torsoRings,
    origin: new THREE.Vector3(0, 0, 0),
    axis: Yv,
    u: X,
    v: Z,
    segs: 26,
    capStart: true,
    capEnd: true,
    weight: (t) => chainWeights(t, torsoChain, false),
    color: (t, p) => {
      if (t < 1.036) return legs;
      // Fitted top with a soft scoop neckline.
      const ax = Math.abs(p.x);
      if (t > 1.43) return skin;
      if (p.z > 0.01 && ax < 0.1 && t > 1.335 + (ax / 0.1) ** 2 * 0.07) return skin;
      return top;
    },
  });

  // ---------------------------------------------------------------- legs
  for (const side of ['L', 'R'] as const) {
    const s = side === 'L' ? 1 : -1;
    const hip = B[`thigh${side}`];
    const legRings: Ring[] = [
      { t: 0.975, a: 0.07, b: 0.075, ca: -0.008 * s },
      { t: 0.9, a: 0.08, b: 0.09, ca: -0.004 * s, cb: -0.006 },
      { t: 0.84, a: 0.08, b: 0.086, ca: 0.002 * s, cb: 0.0 },
      { t: 0.77, a: 0.074, b: 0.078, ca: 0.002 * s, cb: 0.006 },
      { t: 0.69, a: 0.066, b: 0.069, cb: 0.007 },
      { t: 0.61, a: 0.058, b: 0.061, cb: 0.005 },
      { t: 0.54, a: 0.05, b: 0.053, cb: 0.004 },
      { t: 0.495, a: 0.047, b: 0.051, cb: 0.006 },
      { t: 0.455, a: 0.046, b: 0.049, cb: 0.002 },
      { t: 0.415, a: 0.047, b: 0.051, cb: -0.008 },
      { t: 0.36, a: 0.05, b: 0.055, cb: -0.013 },
      { t: 0.3, a: 0.047, b: 0.051, cb: -0.011 },
      { t: 0.235, a: 0.039, b: 0.043, cb: -0.007 },
      { t: 0.175, a: 0.032, b: 0.035, cb: -0.004 },
      { t: 0.136, a: 0.028, b: 0.032, cb: -0.004 },
      { t: 0.126, a: 0.0275, b: 0.031, cb: -0.004 },
      { t: 0.085, a: 0.029, b: 0.034, cb: -0.006 },
      { t: 0.055, a: 0.026, b: 0.03, cb: -0.008 },
    ];
    const chain = [
      { bone: 'root' as BoneName, at: 0, zone: 0 },
      { bone: `thigh${side}` as BoneName, at: hip.y + 0.012, zone: 0.05 },
      { bone: `shin${side}` as BoneName, at: B[`shin${side}`].y, zone: 0.045 },
      { bone: `foot${side}` as BoneName, at: B[`foot${side}`].y + 0.02, zone: 0.025 },
    ];
    b.tube({
      rings: legRings,
      origin: new THREE.Vector3(hip.x, 0, hip.z),
      axis: Yv,
      u: X,
      v: Z,
      segs: 18,
      capStart: true,
      weight: (t) => chainWeights(t, chain, true),
      color: (t) => (t < 0.131 ? skin : legs),
    });

    // Foot: tube along +Z.
    const ankle = B[`foot${side}`];
    const footRings: Ring[] = [
      { t: -0.066, a: 0.018, b: 0.026, cb: 0.042 },
      { t: -0.05, a: 0.027, b: 0.038, cb: 0.044 },
      { t: -0.02, a: 0.031, b: 0.045, cb: 0.05 },
      { t: 0.02, a: 0.034, b: 0.043, cb: 0.048, ca: 0.002 * s },
      { t: 0.06, a: 0.038, b: 0.034, cb: 0.039, ca: 0.004 * s },
      { t: 0.1, a: 0.041, b: 0.026, cb: 0.029, ca: 0.006 * s },
      { t: 0.135, a: 0.042, b: 0.02, cb: 0.021, ca: 0.007 * s },
      { t: 0.165, a: 0.04, b: 0.016, cb: 0.017, ca: 0.007 * s },
      { t: 0.19, a: 0.033, b: 0.013, cb: 0.015, ca: 0.005 * s },
      { t: 0.205, a: 0.02, b: 0.009, cb: 0.014, ca: 0.003 * s },
    ];
    const ballZ = ankle.z + 0.128;
    b.tube({
      rings: footRings,
      origin: new THREE.Vector3(ankle.x, 0, ankle.z),
      axis: Z,
      u: X,
      v: Yv,
      segs: 16,
      capStart: true,
      capEnd: true,
      weight: (_t, p) => {
        const k = smooth(ballZ - 0.025, ballZ + 0.015, p.z);
        const w: W = [[`foot${side}` as BoneName, 1 - k]];
        if (k > 0) w.push([`toes${side}` as BoneName, k]);
        return w;
      },
      color: () => skin,
    });
  }

  // ---------------------------------------------------------------- arms
  for (const side of ['L', 'R'] as const) {
    const s = side === 'L' ? 1 : -1;
    const sh = B[`upperArm${side}`];
    const armRings: Ring[] = [
      { t: 1.455, a: 0.03, b: 0.03, ca: -0.012 * s },
      { t: 1.44, a: 0.048, b: 0.05, ca: -0.004 * s },
      { t: 1.41, a: 0.055, b: 0.056, ca: 0.006 * s },
      { t: 1.37, a: 0.052, b: 0.053, ca: 0.007 * s },
      { t: 1.32, a: 0.045, b: 0.047, ca: 0.004 * s },
      { t: 1.26, a: 0.041, b: 0.044, ca: 0.002 * s },
      { t: 1.2, a: 0.038, b: 0.041 },
      { t: 1.15, a: 0.034, b: 0.037, cb: -0.002 },
      { t: 1.115, a: 0.034, b: 0.036, cb: -0.003 },
      { t: 1.075, a: 0.037, b: 0.037 },
      { t: 1.03, a: 0.036, b: 0.034 },
      { t: 0.975, a: 0.031, b: 0.03 },
      { t: 0.925, a: 0.024, b: 0.026 },
      { t: 0.895, a: 0.019, b: 0.026 },
      { t: 0.872, a: 0.018, b: 0.025 },
    ];
    const chain = [
      { bone: `clav${side}` as BoneName, at: 0, zone: 0 },
      { bone: `upperArm${side}` as BoneName, at: sh.y + 0.034, zone: 0.018 },
      { bone: `forearm${side}` as BoneName, at: B[`forearm${side}`].y, zone: 0.04 },
      { bone: `hand${side}` as BoneName, at: B[`hand${side}`].y + 0.01, zone: 0.012 },
    ];
    b.tube({
      rings: armRings,
      origin: new THREE.Vector3(sh.x, 0, sh.z),
      axis: Yv,
      u: X,
      v: Z,
      segs: 14,
      capStart: true,
      capEnd: true,
      weight: (t) => chainWeights(t, chain, true),
      color: () => skin,
    });

    // Hand: palm + fingers block + thumb. Palm faces medially (-X for the left hand).
    const wr = B[`hand${side}`];
    const fg = B[`fingers${side}`];
    b.blob({
      centre: new THREE.Vector3(wr.x, wr.y - 0.052, wr.z + 0.002),
      radii: new THREE.Vector3(0.0145, 0.058, 0.04),
      exp: 3,
      w: 12,
      h: 10,
      weight: (p) => {
        const k = smooth(fg.y + 0.012, fg.y - 0.012, p.y);
        const w: W = [[`hand${side}` as BoneName, 1 - k]];
        if (k > 0) w.push([`fingers${side}` as BoneName, k]);
        return w;
      },
      color: () => skin,
    });
    b.blob({
      centre: new THREE.Vector3(fg.x, fg.y - 0.034, fg.z - 0.002),
      radii: new THREE.Vector3(0.0115, 0.048, 0.037),
      exp: 3,
      w: 12,
      h: 10,
      deform: (n, p) => {
        // Taper fingertips slightly and give a gentle natural curve.
        if (n.y < 0) p.z *= 1 - 0.18 * -n.y;
        if (n.z > 0.3) p.y *= 0.88;
      },
      weight: () => [[`fingers${side}` as BoneName, 1]],
      color: () => skin,
    });
    // Thumb (along the front/radial side, pointing down-forward).
    b.blob({
      centre: new THREE.Vector3(wr.x - 0.006 * s, wr.y - 0.06, wr.z + 0.042),
      radii: new THREE.Vector3(0.0105, 0.034, 0.0115),
      rotation: new THREE.Euler(0.35, 0, 0.12 * s),
      w: 10,
      h: 8,
      weight: () => [[`hand${side}` as BoneName, 1]],
      color: () => skin,
    });
  }

  // ---------------------------------------------------------------- head
  const hc = B.head.clone().add(new THREE.Vector3(0, 0.088, 0.016));
  b.blob({
    centre: hc,
    radii: new THREE.Vector3(0.077, 0.104, 0.094),
    w: 28,
    h: 22,
    deform: (n, p) => {
      // Narrow jaw and chin, flatter face, fuller occiput.
      if (n.y < 0.1) {
        const k = Math.min(1, (0.1 - n.y) / 1.1);
        p.x *= 1 - 0.32 * k;
        if (n.z < 0) p.z *= 1 - 0.35 * k;
      }
      if (n.z > 0.2) p.z *= 0.96;
      if (n.z < -0.3 && n.y > -0.2) p.z *= 1.05;
    },
    weight: () => [['head', 1]],
    color: () => skin,
  });
  // Nose: subtle, gives the face an orientation without uncanny detail.
  b.blob({
    centre: hc.clone().add(new THREE.Vector3(0, -0.012, 0.09)),
    radii: new THREE.Vector3(0.011, 0.022, 0.013),
    rotation: new THREE.Euler(-0.25, 0, 0),
    w: 8,
    h: 8,
    weight: () => [['head', 1]],
    color: () => skin,
  });
  // Ears.
  for (const s of [1, -1]) {
    b.blob({
      centre: hc.clone().add(new THREE.Vector3(0.074 * s, -0.004, -0.004)),
      radii: new THREE.Vector3(0.01, 0.026, 0.017),
      w: 8,
      h: 8,
      weight: () => [['head', 1]],
      color: () => skin,
    });
  }
  // Hair cap tilted back so the hairline sits higher at the front.
  b.blob({
    centre: hc.clone().add(new THREE.Vector3(0, 0.006, -0.006)),
    radii: new THREE.Vector3(0.083, 0.11, 0.1),
    rotation: new THREE.Euler(-0.6, 0, 0),
    thetaLength: Math.PI * 0.56,
    w: 28,
    h: 14,
    weight: () => [['head', 1]],
    color: () => hair,
  });
  // Low bun.
  b.blob({
    centre: hc.clone().add(new THREE.Vector3(0, 0.03, -0.108)),
    radii: new THREE.Vector3(0.042, 0.038, 0.034),
    w: 14,
    h: 12,
    weight: () => [['head', 1]],
    color: () => hair,
  });

  const merged = mergeGeometries(b.parts, false)!;
  b.parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

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
