/**
 * Steel structure, wooden treads & landing geometry for all five structure designs.
 * Each structure has its own physically meaningful geometry built in the flight frame
 * (local x = walker's left, y = up from flight base, z = ascent direction).
 */
import * as THREE from 'three';
import { clipPolygon } from '../../engine/math';
import type { FullLayout } from '../../engine/layout';
import type { FlightSolved, LandingSolved, Rect, RoomConfig, StructureConfig, TreadConfig } from '../../engine/types';
import { WOOD_TILE } from '../textures';
import { Parts, beam, box, boxUV, flightMatrix, profile, roundedBox, v3 } from './primitives';

export interface StairBuildInput {
  layout: FullLayout;
  room: RoomConfig;
  structure: Pick<StructureConfig, 'type' | 'risers' | 'landingSupport'>;
  treads: Pick<TreadConfig, 'edge'>;
  treadThickness: number;
  nosing: number;
}

interface FlightCtx {
  f: FlightSolved;
  h: number;
  g: number;
  t: number;
  nos: number;
  w: number;
  n: number;
  nT: number;
  zEnd: number;
  topRel: number;
  s: number;
  cosA: number;
  floor: boolean;
  slab: boolean;
  m: THREE.Matrix4;
}

/** structure specific constants */
const A = { bw: 0.12, bd: 0.2, plate: 0.012, web: 0.06 };
const B = { pt: 0.012, pd: 0.26, rise: 0.03 };
const C = { pt: 0.018, inset: 0.05, depth: 0.11 };
const D = { e: 0.01, ribInset: 0.14, ribDepth: 0.07, ribT: 0.012 };
const E = { sw: 0.05, sd: 0.1, inset: 0.13, m: 0.03 };

const LANDING_FRAME: Record<string, number> = { A: 0.14, B: 0.24, C: 0.18, D: 0.1, E: 0.12 };

function ctxFor(f: FlightSolved, inp: StairBuildInput): FlightCtx {
  const h = f.riserHeight;
  const g = f.going;
  const nT = f.treads;
  return {
    f,
    h,
    g,
    t: inp.treadThickness,
    nos: inp.nosing,
    w: f.width,
    n: f.risers,
    nT,
    zEnd: nT * g,
    topRel: f.risers * h,
    s: h / g,
    cosA: g / Math.hypot(g, h),
    floor: f.baseOn === 'floor',
    slab: f.topOn === 'slab',
    m: flightMatrix(f.start.x, f.baseY, f.start.z, f.yaw),
  };
}

/** lowest point of the structure (relative to flight base) at position z — used for landing headers */
function structureBottom(c: FlightCtx, type: string, z: number) {
  const { s, t, h } = c;
  switch (type) {
    case 'A': {
      const bT = -(t + A.plate + 0.015);
      return s * z + bT - A.bd / c.cosA;
    }
    case 'B':
      return s * z + h + B.rise - B.pd / c.cosA;
    case 'C':
      return s * z - t - C.depth / c.cosA;
    case 'D':
      return s * z - (t + D.e) - D.ribDepth / c.cosA;
    default: {
      const bT = -(t + 0.06);
      return s * z + bT - E.sd / c.cosA;
    }
  }
}

function parallelogram(c: FlightCtx, top: (z: number) => number, depthV: number, zStart: number, zEnd: number, clipTop?: number) {
  let poly: [number, number][] = [
    [zStart, top(zStart)],
    [zEnd, top(zEnd)],
    [zEnd, top(zEnd) - depthV],
    [zStart, top(zStart) - depthV],
  ];
  if (c.floor) poly = clipPolygon(poly, 0, 1, 0); // y >= 0
  if (clipTop !== undefined) poly = clipPolygon(poly, 0, -1, clipTop); // y <= clipTop
  return poly;
}

// ---------------------------------------------------------------------------
// Treads (common)
// ---------------------------------------------------------------------------
function addTreads(P: Parts, c: FlightCtx, inp: StairBuildInput, width: number) {
  const { t, g, h, nos } = c;
  const depth = g + nos;
  const rounded = inp.treads.edge === 'rounded';
  for (let i = 0; i < c.nT; i++) {
    const cy = (i + 1) * h - t / 2;
    const cz = i * g + (g - nos) / 2;
    const geo = rounded ? roundedBox(width, t, depth, 0.007, 0, 0, 0) : box(width, t, depth, 0, 0, 0);
    boxUV(geo, WOOD_TILE.u, WOOD_TILE.v, (i * 0.37) % 1, (i * 0.23) % 1);
    geo.translate(0, cy, cz);
    P.add('wood', geo, c.m);
    P.count('tread');
    // LED strip under the nosing
    const led = box(width - 0.1, 0.006, 0.012, 0, (i + 1) * h - t - 0.004, i * g - nos + 0.018);
    P.add('led', led, c.m);
  }
}

function addWoodRisers(P: Parts, c: FlightCtx, width: number) {
  const { t, g, h } = c;
  const rt = 0.018;
  const last = c.slab ? c.nT : c.n; // top riser into landing
  for (let i = 0; i < last; i++) {
    const y0 = i * h;
    const y1 = (i + 1) * h - t;
    const geo = box(width, y1 - y0, rt, 0, 0, 0);
    boxUV(geo, WOOD_TILE.u, WOOD_TILE.v, 0.5, (i * 0.31) % 1);
    geo.translate(0, (y0 + y1) / 2, i * g + rt / 2 + 0.002);
    P.add('wood', geo, c.m);
    P.count('riser');
  }
}

// ---------------------------------------------------------------------------
// A — central mono stringer
// ---------------------------------------------------------------------------
function buildA(P: Parts, c: FlightCtx, inp: StairBuildInput) {
  const { s, t, g, h, nos, w } = c;
  const bT = -(t + A.plate + 0.015);
  const top = (z: number) => s * z + bT;
  const dv = A.bd / c.cosA;
  const zStart = c.floor ? -bT / s + 0.02 : 0;
  P.add('steel', profile(parallelogram(c, top, dv, zStart, c.zEnd), A.bw, 0), c.m);
  P.count('stringer');
  for (let i = 0; i < c.nT; i++) {
    const under = (i + 1) * h - t;
    const zA = i * g - nos + 0.06;
    const zB = (i + 1) * g - 0.06;
    const bot = (z: number) => (c.floor ? Math.max(top(z) - 0.01, 0) : top(z) - 0.01);
    // vertical web bracket
    const web: [number, number][] = [
      [zA, bot(zA)],
      [zB, bot(zB)],
      [zB, under - A.plate],
      [zA, under - A.plate],
    ];
    P.add('steel', profile(web, A.web, 0), c.m);
    // cantilever cleat plate
    P.add('steel', box(w * 0.66, A.plate, g + nos - 0.08, 0, under - A.plate / 2, i * g + (g - nos) / 2), c.m);
    P.count('bracket');
  }
  addTreads(P, c, inp, w);
  // anchors
  if (c.floor) {
    const zb = (dv - bT) / s;
    P.add('steel', box(0.26, 0.012, zb - zStart + 0.14, 0, 0.006, (zStart + zb) / 2), c.m);
    P.count('baseplate');
  }
  if (c.slab) {
    P.add('steel', box(A.bw + 0.1, dv + 0.08, 0.015, 0, top(c.zEnd) - dv / 2, c.zEnd - 0.0075), c.m);
    P.count('anchorplate');
  }
}

// ---------------------------------------------------------------------------
// B — double side stringers (flat plates), treads between
// ---------------------------------------------------------------------------
function buildB(P: Parts, c: FlightCtx, inp: StairBuildInput) {
  const { s, t, g, h, nos, w } = c;
  const top = (z: number) => s * z + h + B.rise;
  const dv = B.pd / c.cosA;
  const zStart = c.floor ? -nos - 0.015 : 0;
  const poly = parallelogram(c, top, dv, zStart, c.zEnd, c.topRel);
  for (const sx of [-1, 1]) {
    P.add('steel', profile(poly, B.pt, sx * (w / 2 - B.pt / 2)), c.m);
    P.count('stringer');
  }
  const tw = w - 2 * B.pt;
  for (let i = 0; i < c.nT; i++) {
    for (const sx of [-1, 1]) {
      P.add('steel', box(0.03, 0.03, (g + nos) * 0.8, sx * (w / 2 - B.pt - 0.015), (i + 1) * h - t - 0.015, i * g + (g - nos) / 2), c.m);
    }
    P.count('cleat', 2);
  }
  addTreads(P, c, inp, tw);
  if (inp.structure.risers === 'closed') addWoodRisers(P, c, tw);
  if (c.floor) {
    for (const sx of [-1, 1]) P.add('steel', box(0.08, 0.01, 0.2, sx * (w / 2 - 0.04), 0.005, zStart + 0.25), c.m);
  }
  if (c.slab) {
    for (const sx of [-1, 1]) P.add('steel', box(0.1, 0.16, 0.012, sx * (w / 2 - 0.05), c.topRel - 0.1, c.zEnd - 0.006), c.m);
  }
}

// ---------------------------------------------------------------------------
// C — zigzag (sawtooth) stringers
// ---------------------------------------------------------------------------
function zigzagPoly(c: FlightCtx, tOff: number, depth: number): [number, number][] {
  const { s, g, h, nT } = c;
  const dz = depth / c.cosA;
  const bottom = (z: number) => s * z - tOff - dz;
  const pts: [number, number][] = [];
  pts.push([0, h - tOff]);
  for (let i = 0; i < nT; i++) {
    pts.push([(i + 1) * g, (i + 1) * h - tOff]);
    pts.push([(i + 1) * g, (i + 2) * h - tOff]);
  }
  // pts ends at (zEnd, n*h - tOff)
  pts.push([c.zEnd, bottom(c.zEnd)]);
  if (c.floor) {
    const zb = (tOff + dz) / s;
    pts.push([zb, 0]);
    pts.push([0, 0]);
  } else {
    pts.push([0, bottom(0)]);
  }
  return pts;
}

function buildC(P: Parts, c: FlightCtx, inp: StairBuildInput) {
  const { w } = c;
  const poly = zigzagPoly(c, c.t, C.depth);
  for (const sx of [-1, 1]) {
    P.add('steel', profile(poly, C.pt, sx * (w / 2 - C.inset)), c.m);
    P.count('stringer');
  }
  addTreads(P, c, inp, w);
  if (inp.structure.risers === 'closed') addWoodRisers(P, c, w - 0.002);
  if (c.floor) for (const sx of [-1, 1]) P.add('steel', box(0.08, 0.01, 0.22, sx * (w / 2 - C.inset), 0.005, 0.14), c.m);
  if (c.slab) for (const sx of [-1, 1]) P.add('steel', box(0.09, 0.14, 0.012, sx * (w / 2 - C.inset), c.topRel - c.t - 0.07, c.zEnd + 0.006), c.m);
}

// ---------------------------------------------------------------------------
// D — folded steel plate
// ---------------------------------------------------------------------------
function buildD(P: Parts, c: FlightCtx, inp: StairBuildInput) {
  const { g, h, t, w, nT } = c;
  const e = D.e;
  const Pp: [number, number][] = [];
  Pp.push([0, c.floor ? 0 : -t]);
  Pp.push([0, h - t]);
  for (let i = 0; i < nT; i++) {
    Pp.push([(i + 1) * g, (i + 1) * h - t]);
    Pp.push([(i + 1) * g, (i + 2) * h - t]);
  }
  const Q: [number, number][] = Pp.map(([z, y], i) => {
    if (i === 0) return [z + e, y];
    if (i === Pp.length - 1) return [z + e, y];
    return [z + e, y - e];
  });
  const poly = [...Pp, ...Q.reverse()];
  P.add('steel', profile(poly, w, 0), c.m);
  P.count('foldedPlate');
  // hidden stiffening ribs following the fold
  const rib = zigzagPoly(c, t + e, D.ribDepth);
  for (const sx of [-1, 1]) {
    P.add('steel', profile(rib, D.ribT, sx * (w / 2 - D.ribInset)), c.m);
    P.count('rib');
  }
  addTreads(P, c, inp, w);
  if (c.floor) P.add('steel', box(w, 0.008, 0.08, 0, 0.004, 0.04 + e), c.m);
}

// ---------------------------------------------------------------------------
// E — exposed welded frame
// ---------------------------------------------------------------------------
function buildE(P: Parts, c: FlightCtx, inp: StairBuildInput) {
  const { s, t, g, h, nos, w } = c;
  const bT = -(t + 0.06);
  const top = (z: number) => s * z + bT;
  const dv = E.sd / c.cosA;
  const zStart = c.floor ? -bT / s + 0.02 : 0;
  const poly = parallelogram(c, top, dv, zStart, c.zEnd);
  const xs = [-(w / 2 - E.inset), w / 2 - E.inset];
  for (const x of xs) {
    P.add('steel', profile(poly, E.sw, x), c.m);
    P.count('stringer');
  }
  const M = E.m;
  for (let i = 0; i < c.nT; i++) {
    const yF = (i + 1) * h - t - M / 2;
    const z0 = i * g - nos + M / 2 + 0.01;
    const z1 = (i + 1) * g - M / 2 - 0.005;
    // tread frame
    P.add('steel', box(w - 0.04, M, M, 0, yF, z0), c.m);
    P.add('steel', box(w - 0.04, M, M, 0, yF, z1), c.m);
    for (const sx of [-1, 1]) P.add('steel', box(M, M, z1 - z0, sx * (w / 2 - 0.02 - M / 2), yF, (z0 + z1) / 2), c.m);
    // struts down to stringers
    for (const x of xs) {
      for (const z of [z0, z1]) {
        const yb = c.floor ? Math.max(top(z), 0) : top(z);
        const yt = yF - M / 2;
        if (yt - yb > 0.01) P.add('steel', box(M, yt - yb + 0.005, M, x, (yt + yb + 0.005) / 2, z), c.m);
      }
    }
    P.count('treadFrame');
  }
  addTreads(P, c, inp, w);
  if (inp.structure.risers === 'closed') addWoodRisers(P, c, w - 0.04);
  // intermediate posts under long flights
  if (c.zEnd > 1.6) {
    const zm = c.zEnd * (c.floor ? 0.62 : 0.5);
    const yTopPost = top(zm) - dv;
    const yBase = -c.f.baseY; // world floor in local
    for (const x of xs) {
      if (yTopPost - yBase > 0.05) {
        P.add('steel', box(0.06, yTopPost - yBase, 0.06, x, (yTopPost + yBase) / 2, zm), c.m);
        P.add('steel', box(0.16, 0.012, 0.16, x, yBase + 0.006, zm), c.m);
        P.count('post');
      }
    }
  }
  if (c.floor) for (const x of xs) P.add('steel', box(0.12, 0.012, 0.3, x, 0.006, (zStart + (dv - bT) / s) / 2), c.m);
  if (c.slab) for (const x of xs) P.add('steel', box(0.1, dv + 0.06, 0.012, x, top(c.zEnd) - dv / 2, c.zEnd - 0.006), c.m);
}

// ---------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------
type Edge = 'minX' | 'maxX' | 'minZ' | 'maxZ';

function topJointEdge(f: FlightSolved): Edge {
  if (f.dir.z < -0.5) return 'maxZ';
  if (f.dir.z > 0.5) return 'minZ';
  if (f.dir.x < -0.5) return 'maxX';
  return 'minX';
}
function bottomJointEdge(f: FlightSolved): Edge {
  if (f.dir.z > 0.5) return 'maxZ';
  if (f.dir.z < -0.5) return 'minZ';
  if (f.dir.x > 0.5) return 'maxX';
  return 'minX';
}
const opposite: Record<Edge, Edge> = { minX: 'maxX', maxX: 'minX', minZ: 'maxZ', maxZ: 'minZ' };

function buildLanding(P: Parts, L: LandingSolved, inp: StairBuildInput, ctxs: FlightCtx[]) {
  const type = inp.structure.type;
  const t = inp.treadThickness;
  const r = L.rect;
  const Ly = L.topY;
  const W = r.maxX - r.minX;
  const Dd = r.maxZ - r.minZ;
  const cx = (r.minX + r.maxX) / 2;
  const cz = (r.minZ + r.maxZ) / 2;
  // wooden landing top
  const top = inp.treads.edge === 'rounded' ? roundedBox(W, t, Dd, 0.006, 0, 0, 0) : box(W, t, Dd, 0, 0, 0);
  top.translate(cx, Ly - t / 2, cz);
  boxUV(top, WOOD_TILE.u, WOOD_TILE.v, 0.13, 0.41);
  P.add('wood', top);
  P.count('landing');

  // frame depth per edge (below the wood)
  const base = LANDING_FRAME[type];
  const depth: Record<Edge, number> = { minX: base, maxX: base, minZ: base, maxZ: base };
  const attached = new Set<Edge>();
  let firstFlightTopEdge: Edge | null = null;
  for (const c of ctxs) {
    if (c.f.landingAbove === L.index) {
      const e = topJointEdge(c.f);
      attached.add(e);
      firstFlightTopEdge = firstFlightTopEdge ?? e;
      const need = c.topRel - structureBottom(c, type, c.zEnd) - t;
      depth[e] = Math.max(depth[e], need);
    }
    if (c.f.landingBelow === L.index) {
      const e = bottomJointEdge(c.f);
      attached.add(e);
      const need = -structureBottom(c, type, 0) - t;
      depth[e] = Math.max(depth[e], need);
    }
  }
  const support = inp.structure.landingSupport;
  const cantilever = support === 'cantilever';
  if (cantilever) {
    // self-supporting landing: a deep, rigid torsion-box frame welded to the flight stringers
    const dMax = Math.max(base + 0.1, ...Object.values(depth));
    for (const e of Object.keys(depth) as Edge[]) depth[e] = dMax;
  }
  const yTop = Ly - t;
  const thick = type === 'B' || type === 'C' ? 0.014 : type === 'D' ? 0.012 : 0.06;
  const edges: { e: Edge; a: THREE.Vector3; b: THREE.Vector3; inward: THREE.Vector3 }[] = [
    { e: 'minX', a: v3(r.minX, 0, r.minZ), b: v3(r.minX, 0, r.maxZ), inward: v3(1, 0, 0) },
    { e: 'maxX', a: v3(r.maxX, 0, r.minZ), b: v3(r.maxX, 0, r.maxZ), inward: v3(-1, 0, 0) },
    { e: 'minZ', a: v3(r.minX, 0, r.minZ), b: v3(r.maxX, 0, r.minZ), inward: v3(0, 0, 1) },
    { e: 'maxZ', a: v3(r.minX, 0, r.maxZ), b: v3(r.maxX, 0, r.maxZ), inward: v3(0, 0, -1) },
  ];
  for (const ed of edges) {
    const d = depth[ed.e];
    const alongX = ed.e === 'minZ' || ed.e === 'maxZ';
    const len = alongX ? W : Dd;
    const mx = (ed.a.x + ed.b.x) / 2 + ed.inward.x * thick / 2;
    const mz = (ed.a.z + ed.b.z) / 2 + ed.inward.z * thick / 2;
    const g = alongX ? box(len, d, thick, mx, yTop - d / 2, mz) : box(thick, d, len, mx, yTop - d / 2, mz);
    P.add('steel', g);
  }
  P.count('landingFrame', 4);
  // internal joists / deck plate
  if (type === 'D') {
    P.add('steel', box(W, 0.008, Dd, cx, yTop - 0.004, cz));
  } else {
    const jd = Math.min(base, 0.12);
    const alongX = W < Dd; // joists across the short span
    const nJ = Math.max(1, Math.floor((alongX ? Dd : W) / 0.45));
    for (let k = 1; k <= nJ; k++) {
      const f = k / (nJ + 1);
      if (alongX) P.add('steel', box(W - 0.02, jd, 0.04, cx, yTop - jd / 2, r.minZ + Dd * f));
      else P.add('steel', box(0.04, jd, Dd - 0.02, r.minX + W * f, yTop - jd / 2, cz));
    }
  }

  // supports
  if (cantilever) {
    // stringers continue under the landing as one rigid frame — no posts
    const bw = type === 'A' ? A.bw : 0.06;
    for (const c of ctxs) {
      const top = c.f.landingAbove === L.index;
      const bottom = c.f.landingBelow === L.index;
      if (!top && !bottom) continue;
      const e = top ? topJointEdge(c.f) : bottomJointEdge(c.f);
      const along = e === 'minZ' || e === 'maxZ' ? Dd : W;
      const sgn = top ? 1 : -1;
      const base0 = top
        ? { x: c.f.start.x + c.f.dir.x * c.f.run, z: c.f.start.z + c.f.dir.z * c.f.run }
        : { x: c.f.start.x, z: c.f.start.z };
      const d = depth[e];
      for (const x of stringerXs(type, c.w)) {
        // local x = walker's left = -right
        const px = base0.x - c.f.right.x * x;
        const pz = base0.z - c.f.right.z * x;
        const a = v3(px, yTop - d / 2, pz);
        const b = v3(px + c.f.dir.x * along * sgn, yTop - d / 2, pz + c.f.dir.z * along * sgn);
        P.add('steel', beam(a, b, bw, d));
        P.count('cantileverBeam');
      }
    }
  }
  const wallEdges: Edge[] = [];
  const room = inp.room;
  if (support === 'wall' || cantilever) {
    if (room.walls.left && r.minX <= 0.15) wallEdges.push('minX');
    if (room.walls.right && room.width - r.maxX <= 0.15) wallEdges.push('maxX');
    if (room.walls.back && r.minZ <= 0.15) wallEdges.push('minZ');
    if (room.walls.front && room.depth - r.maxZ <= 0.15) wallEdges.push('maxZ');
  }
  const corners: { x: number; z: number; edges: Edge[] }[] = [
    { x: r.minX, z: r.minZ, edges: ['minX', 'minZ'] },
    { x: r.maxX, z: r.minZ, edges: ['maxX', 'minZ'] },
    { x: r.minX, z: r.maxZ, edges: ['minX', 'maxZ'] },
    { x: r.maxX, z: r.maxZ, edges: ['maxX', 'maxZ'] },
  ];
  let postCorners = corners;
  if (cantilever) {
    postCorners = [];
    for (const we of wallEdges) {
      const ed = edges.find((x) => x.e === we)!;
      const alongX = we === 'minZ' || we === 'maxZ';
      const len = alongX ? W : Dd;
      const out = ed.inward.clone().multiplyScalar(-1);
      const d = depth[we] + 0.06;
      const mx = (ed.a.x + ed.b.x) / 2 + out.x * 0.01;
      const mz = (ed.a.z + ed.b.z) / 2 + out.z * 0.01;
      P.add('steel', alongX ? box(len - 0.04, d, 0.012, mx, yTop - d / 2, mz) : box(0.012, d, len - 0.04, mx, yTop - d / 2, mz));
      P.count('wallAnchor');
    }
  } else if (support === 'posts2' && firstFlightTopEdge) {
    const far = opposite[firstFlightTopEdge];
    postCorners = corners.filter((c) => c.edges.includes(far));
  } else if (support === 'wall' && wallEdges.length) {
    // wall anchor plates along adjacent edges; posts only at corners not touching a wall
    for (const we of wallEdges) {
      const ed = edges.find((x) => x.e === we)!;
      const alongX = we === 'minZ' || we === 'maxZ';
      const len = alongX ? W : Dd;
      const out = ed.inward.clone().multiplyScalar(-1);
      const mx = (ed.a.x + ed.b.x) / 2 + out.x * 0.01;
      const mz = (ed.a.z + ed.b.z) / 2 + out.z * 0.01;
      const d = depth[we] + 0.06;
      P.add('steel', alongX ? box(len - 0.04, d, 0.012, mx, yTop - d / 2, mz) : box(0.012, d, len - 0.04, mx, yTop - d / 2, mz));
      P.count('wallAnchor');
    }
    postCorners = corners.filter((c) => !c.edges.some((e) => wallEdges.includes(e)));
  }
  const ps = type === 'A' ? 0.1 : 0.08;
  for (const pc of postCorners) {
    const inset = ps / 2 + thick + 0.005;
    const px = pc.x + (pc.edges.includes('minX') ? inset : -inset);
    const pz = pc.z + (pc.edges.includes('minZ') ? inset : -inset);
    const d = Math.max(depth[pc.edges[0]], depth[pc.edges[1]]);
    const yB = yTop - d;
    if (yB > 0.05) {
      P.add('steel', box(ps, yB, ps, px, yB / 2, pz));
      P.add('steel', box(ps + 0.1, 0.012, ps + 0.1, px, 0.006, pz));
      P.add('steel', box(ps + 0.04, 0.01, ps + 0.04, px, yB - 0.005, pz));
      P.count('post');
    }
  }
}

/** lateral (flight-local, + = walker's left) positions of the main longitudinal members */
function stringerXs(type: string, w: number): number[] {
  switch (type) {
    case 'A':
      return [0];
    case 'B':
      return [-(w / 2 - B.pt - 0.03), w / 2 - B.pt - 0.03];
    case 'C':
      return [-(w / 2 - C.inset), w / 2 - C.inset];
    case 'D':
      return [-(w / 2 - D.ribInset), w / 2 - D.ribInset];
    default:
      return [-(w / 2 - E.inset), w / 2 - E.inset];
  }
}

export function buildStair(inp: StairBuildInput) {
  const P = new Parts();
  const ctxs = inp.layout.flights.map((f) => ctxFor(f, inp));
  for (const c of ctxs) {
    switch (inp.structure.type) {
      case 'A':
        buildA(P, c, inp);
        break;
      case 'B':
        buildB(P, c, inp);
        break;
      case 'C':
        buildC(P, c, inp);
        break;
      case 'D':
        buildD(P, c, inp);
        break;
      case 'E':
        buildE(P, c, inp);
        break;
    }
  }
  for (const L of inp.layout.landings) buildLanding(P, L, inp, ctxs);
  const counts = { ...P.counts };
  return { geometries: P.merge(), counts };
}

export type StairGeometry = ReturnType<typeof buildStair>;

/** used by tests */
export function rectArea(r: Rect) {
  return (r.maxX - r.minX) * (r.maxZ - r.minZ);
}

