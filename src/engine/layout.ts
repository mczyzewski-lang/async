/**
 * Staircase shape generation: builds flights and landings for I / L / U shapes
 * in a local plan frame (u = walker's right, v = ascent of first flight),
 * then places them in the room (world metres, x ∈ [0,W], z ∈ [0,D], y up).
 */
import { resolveRiserCount, resolveSplit } from './calc';
import { computeOpening } from './opening';
import { add, emptyRect, mul, rectFromPoints, rightOf, unionRect, v2 } from './math';
import type {
  EntryDir,
  FlightSolved,
  LandingSolved,
  Layout,
  Rect,
  RoomConfig,
  StairConfig,
  V2,
} from './types';

export interface LocalPt {
  u: number;
  v: number;
  y: number;
}

export interface SidePath {
  pts: LocalPt[];
  /** per segment owner: flight index or 'landing' */
  owner: (number | 'landing')[];
  /** +1: railing is on walker's left of travel, -1: on the right */
  sign: 1 | -1;
}

interface LocalFlight {
  start: { u: number; v: number };
  dir: { u: number; v: number };
  n: number;
  baseY: number;
  topY: number;
  baseOn: 'floor' | 'landing';
  topOn: 'landing' | 'slab';
  landingBelow: number | null;
  landingAbove: number | null;
}

interface LocalLanding {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  topY: number;
}

export interface LocalLayout {
  flights: LocalFlight[];
  landings: LocalLanding[];
  paths: { outer: SidePath; inner: SidePath };
}

export const ENTRY_DIRS: Record<EntryDir, V2> = {
  back: { x: 0, z: -1 },
  front: { x: 0, z: 1 },
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 },
};

/** Build the local (u,v) description for the given shape. */
export function buildLocal(room: RoomConfig, stair: StairConfig): LocalLayout & { N: number; h: number; split: number[] } {
  const N = resolveRiserCount(room, stair);
  const h = room.height / N;
  const g = stair.going;
  const w = stair.flightWidth;
  const s = stair.turn === 'right' ? 1 : -1;
  const shape = stair.shape;
  const split = resolveSplit(shape, N, stair);
  const H = room.height;

  if (shape === 'I') {
    const R = (N - 1) * g;
    return {
      N,
      h,
      split,
      flights: [
        { start: { u: 0, v: 0 }, dir: { u: 0, v: 1 }, n: N, baseY: 0, topY: H, baseOn: 'floor', topOn: 'slab', landingBelow: null, landingAbove: null },
      ],
      landings: [],
      paths: {
        outer: { pts: [{ u: -w / 2, v: 0, y: h }, { u: -w / 2, v: R, y: H }], owner: [0], sign: 1 },
        inner: { pts: [{ u: w / 2, v: 0, y: h }, { u: w / 2, v: R, y: H }], owner: [0], sign: -1 },
      },
    };
  }

  const [n1, n2] = split;
  const R1 = (n1 - 1) * g;
  const R2 = (n2 - 1) * g;
  const Ly = n1 * h;
  const Ld = Math.max(stair.landingDepth, 0.5);

  if (shape === 'L') {
    const f2v = R1 + Ld - w / 2;
    const flights: LocalFlight[] = [
      { start: { u: 0, v: 0 }, dir: { u: 0, v: 1 }, n: n1, baseY: 0, topY: Ly, baseOn: 'floor', topOn: 'landing', landingBelow: null, landingAbove: 0 },
      { start: { u: (s * w) / 2, v: f2v }, dir: { u: s, v: 0 }, n: n2, baseY: Ly, topY: H, baseOn: 'landing', topOn: 'slab', landingBelow: 0, landingAbove: null },
    ];
    const landings: LocalLanding[] = [{ minU: -w / 2, maxU: w / 2, minV: R1, maxV: R1 + Ld, topY: Ly }];
    const outerPts: LocalPt[] = [
      { u: (-s * w) / 2, v: 0, y: h },
      { u: (-s * w) / 2, v: R1, y: Ly },
      { u: (-s * w) / 2, v: R1 + Ld, y: Ly },
      { u: (s * w) / 2, v: R1 + Ld, y: Ly },
      { u: (s * w) / 2 + s * R2, v: R1 + Ld, y: H },
    ];
    const innerPts: LocalPt[] = [
      { u: (s * w) / 2, v: 0, y: h },
      { u: (s * w) / 2, v: R1, y: Ly },
    ];
    const innerOwner: (number | 'landing')[] = [0];
    if (Ld - w > 0.005) {
      innerPts.push({ u: (s * w) / 2, v: R1 + Ld - w, y: Ly });
      innerOwner.push('landing');
    }
    innerPts.push({ u: (s * w) / 2 + s * R2, v: R1 + Ld - w, y: H });
    innerOwner.push(1);
    return {
      N,
      h,
      split,
      flights,
      landings,
      paths: {
        outer: { pts: outerPts, owner: [0, 'landing', 'landing', 1], sign: s as 1 | -1 },
        inner: { pts: innerPts, owner: innerOwner, sign: -s as 1 | -1 },
      },
    };
  }

  // U
  const gap = Math.max(stair.gap, 0.02);
  const c2 = s * (w + gap);
  const flights: LocalFlight[] = [
    { start: { u: 0, v: 0 }, dir: { u: 0, v: 1 }, n: n1, baseY: 0, topY: Ly, baseOn: 'floor', topOn: 'landing', landingBelow: null, landingAbove: 0 },
    { start: { u: c2, v: R1 }, dir: { u: 0, v: -1 }, n: n2, baseY: Ly, topY: H, baseOn: 'landing', topOn: 'slab', landingBelow: 0, landingAbove: null },
  ];
  const lu = [-w / 2, c2 - w / 2, w / 2, c2 + w / 2];
  const landings: LocalLanding[] = [{ minU: Math.min(...lu), maxU: Math.max(...lu), minV: R1, maxV: R1 + Ld, topY: Ly }];
  const outerPts: LocalPt[] = [
    { u: (-s * w) / 2, v: 0, y: h },
    { u: (-s * w) / 2, v: R1, y: Ly },
    { u: (-s * w) / 2, v: R1 + Ld, y: Ly },
    { u: c2 + (s * w) / 2, v: R1 + Ld, y: Ly },
    { u: c2 + (s * w) / 2, v: R1, y: Ly },
    { u: c2 + (s * w) / 2, v: R1 - R2, y: H },
  ];
  const innerPts: LocalPt[] = [
    { u: (s * w) / 2, v: 0, y: h },
    { u: (s * w) / 2, v: R1, y: Ly },
    { u: c2 - (s * w) / 2, v: R1, y: Ly },
    { u: c2 - (s * w) / 2, v: R1 - R2, y: H },
  ];
  return {
    N,
    h,
    split,
    flights,
    landings,
    paths: {
      outer: { pts: outerPts, owner: [0, 'landing', 'landing', 'landing', 1], sign: s as 1 | -1 },
      inner: { pts: innerPts, owner: [0, 'landing', 1], sign: -s as 1 | -1 },
    },
  };
}

/** Maps a local (u,v) point into world given placement frame */
export interface Frame {
  origin: V2;
  fwd: V2;
  right: V2;
}

export const toWorld = (f: Frame, u: number, v: number): V2 => add(f.origin, add(mul(f.right, u), mul(f.fwd, v)));
export const dirToWorld = (f: Frame, du: number, dv: number): V2 => add(mul(f.right, du), mul(f.fwd, dv));

function localFlightRect(fl: LocalFlight, w: number, g: number, nos: number) {
  const run = (fl.n - 1) * g;
  const r = { u: fl.dir.v, v: -fl.dir.u }; // right of dir in local (u,v)
  const pts = [] as { u: number; v: number }[];
  for (const lat of [-w / 2, w / 2]) {
    for (const along of [-nos, run]) {
      pts.push({ u: fl.start.u + r.u * lat + fl.dir.u * along, v: fl.start.v + r.v * lat + fl.dir.v * along });
    }
  }
  return pts;
}

/** Margin around the stair footprint reserved for railings when aligning to walls */
export const PLACE_MARGIN = 0.05;

export function computeLayout(room: RoomConfig, stair: StairConfig): Layout & { local: LocalLayout; frame: Frame; split: number[] } {
  const local = buildLocal(room, stair);
  const { N, h, split } = local;
  const g = stair.going;
  const w = stair.flightWidth;
  const nos = stair.nosing;

  const fwd = ENTRY_DIRS[stair.placement.entry];
  const right = rightOf(fwd);
  const frame0: Frame = { origin: v2(0, 0), fwd, right };

  // local footprint corners
  const localPts: { u: number; v: number }[] = [];
  for (const fl of local.flights) localPts.push(...localFlightRect(fl, w, g, nos));
  for (const l of local.landings) {
    localPts.push({ u: l.minU, v: l.minV }, { u: l.maxU, v: l.maxV }, { u: l.minU, v: l.maxV }, { u: l.maxU, v: l.minV });
  }
  const r0 = rectFromPoints(localPts.map((p) => toWorld(frame0, p.u, p.v)));
  const sizeX = r0.maxX - r0.minX;
  const sizeZ = r0.maxZ - r0.minZ;

  const pl = stair.placement;
  const gapW = pl.wallGap;
  const alignPos = (mode: string, size: number, roomSize: number, manual: number) => {
    switch (mode) {
      case 'start':
        return gapW;
      case 'end':
        return roomSize - gapW - size;
      case 'center':
        return (roomSize - size) / 2;
      default:
        return manual;
    }
  };
  const minX = alignPos(pl.alignX, sizeX, room.width, pl.offsetX);
  const minZ = alignPos(pl.alignZ, sizeZ, room.depth, pl.offsetZ);
  const origin = v2(minX - r0.minX, minZ - r0.minZ);
  const frame: Frame = { origin, fwd, right };

  const flights: FlightSolved[] = local.flights.map((fl, i) => {
    const start = toWorld(frame, fl.start.u, fl.start.v);
    const dir = dirToWorld(frame, fl.dir.u, fl.dir.v);
    const rgt = rightOf(dir);
    const run = (fl.n - 1) * g;
    const rect = rectFromPoints(localFlightRect(fl, w, g, nos).map((p) => toWorld(frame, p.u, p.v)));
    const treadRects = [] as { rect: Rect; topY: number }[];
    for (let k = 0; k < fl.n - 1; k++) {
      const a = k * g - nos;
      const b = (k + 1) * g;
      const pts: V2[] = [];
      for (const lat of [-w / 2, w / 2]) for (const al of [a, b]) pts.push(add(start, add(mul(rgt, lat), mul(dir, al))));
      treadRects.push({ rect: rectFromPoints(pts), topY: fl.baseY + (k + 1) * h });
    }
    return {
      index: i,
      start,
      dir,
      right: rgt,
      width: w,
      risers: fl.n,
      treads: fl.n - 1,
      riserHeight: h,
      going: g,
      baseY: fl.baseY,
      topY: fl.topY,
      run,
      baseOn: fl.baseOn,
      topOn: fl.topOn,
      landingBelow: fl.landingBelow,
      landingAbove: fl.landingAbove,
      yaw: Math.atan2(dir.x, dir.z),
      rect,
      treadRects,
    };
  });

  const landings: LandingSolved[] = local.landings.map((l, i) => ({
    index: i,
    rect: rectFromPoints([toWorld(frame, l.minU, l.minV), toWorld(frame, l.maxU, l.maxV)]),
    topY: l.topY,
    thickness: stair.treadThickness,
  }));

  let footprint = emptyRect();
  for (const f of flights) footprint = unionRect(footprint, f.rect);
  for (const l of landings) footprint = unionRect(footprint, l.rect);

  const base = {
    shape: stair.shape,
    riserCount: N,
    riserHeight: h,
    going: g,
    flights,
    landings,
    footprint,
    entryDir: fwd,
    origin,
    fwd,
    right,
  };
  const opening = computeOpening(base, room, stair);
  return { ...base, opening, local, frame, split };
}

export type FullLayout = ReturnType<typeof computeLayout>;
