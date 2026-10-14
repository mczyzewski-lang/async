/**
 * Railing path generation. Follows the real stair geometry: sloped along flights,
 * horizontal around landings, mitred at corners.
 */
import type { FullLayout, LocalPt, SidePath } from './layout';
import { toWorld } from './layout';
import type { RailingConfig, RailingRun, RoomConfig, SideMode, V2, V3 } from './types';

/** distance from the flight edge to the railing plane */
export const RAIL_OFFSET = 0.035;

type Seg = { a: LocalPt; b: LocalPt; owner: number | 'landing' };

function offsetPolyline(pts: LocalPt[], d: number, sign: number): LocalPt[] {
  const n = pts.length;
  const normals: { u: number; v: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const du = pts[i + 1].u - pts[i].u;
    const dv = pts[i + 1].v - pts[i].v;
    const l = Math.hypot(du, dv) || 1;
    // left of travel in (u,v) frame = (-dv, du)
    normals.push({ u: (-dv / l) * sign, v: (du / l) * sign });
  }
  return pts.map((p, i) => {
    let nu: number, nv: number;
    if (i === 0) ({ u: nu, v: nv } = normals[0]);
    else if (i === n - 1) ({ u: nu, v: nv } = normals[n - 2]);
    else {
      const a = normals[i - 1];
      const b = normals[i];
      let mu = a.u + b.u;
      let mv = a.v + b.v;
      const ml = Math.hypot(mu, mv);
      if (ml < 1e-6) {
        mu = b.u;
        mv = b.v;
      } else {
        mu /= ml;
        mv /= ml;
      }
      const sc = 1 / Math.max(0.2, mu * b.u + mv * b.v);
      nu = mu * sc;
      nv = mv * sc;
    }
    return { u: p.u + nu * d, v: p.v + nv * d, y: p.y };
  });
}

function splitRuns(path: SidePath, includeLanding: boolean): { pts: LocalPt[]; owner: (number | 'landing')[] }[] {
  const segs: Seg[] = [];
  for (let i = 0; i < path.pts.length - 1; i++) segs.push({ a: path.pts[i], b: path.pts[i + 1], owner: path.owner[i] });
  const runs: { pts: LocalPt[]; owner: (number | 'landing')[] }[] = [];
  let cur: { pts: LocalPt[]; owner: (number | 'landing')[] } | null = null;
  for (const s of segs) {
    const keep = s.owner !== 'landing' || includeLanding;
    if (!keep) {
      if (cur) runs.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { pts: [s.a], owner: [] };
    cur.pts.push(s.b);
    cur.owner.push(s.owner);
  }
  if (cur) runs.push(cur);
  return runs;
}


const toV3 = (layout: FullLayout, p: LocalPt): V3 => {
  const w = toWorld(layout.frame, p.u, p.v);
  return { x: w.x, y: p.y, z: w.z };
};

/** Outward (world) unit normal for the side of a local segment */
function worldNormal(layout: FullLayout, a: LocalPt, b: LocalPt, sign: number): V2 {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const l = Math.hypot(du, dv) || 1;
  const nu = (-dv / l) * sign;
  const nv = (du / l) * sign;
  const f = layout.frame;
  return { x: f.right.x * nu + f.fwd.x * nv, z: f.right.z * nu + f.fwd.z * nv };
}

/** Distance from a world point to the wall in direction n, plus wall presence */
export function wallInDirection(room: RoomConfig, p: V2, n: V2): { distance: number; present: boolean } {
  if (n.x < -0.5) return { distance: p.x, present: room.walls.left };
  if (n.x > 0.5) return { distance: room.width - p.x, present: room.walls.right };
  if (n.z < -0.5) return { distance: p.z, present: room.walls.back };
  return { distance: room.depth - p.z, present: room.walls.front };
}

export interface SideInfo {
  side: 'outer' | 'inner';
  mode: SideMode;
  /** per flight segment: distance from flight edge to nearest wall on that side */
  flights: { flight: number; distance: number; present: boolean; adjacent: boolean }[];
  landingSegments: { distance: number; present: boolean; adjacent: boolean; length: number }[];
}

export const WALL_ADJACENT = 0.15;

export function sideInfo(layout: FullLayout, room: RoomConfig, rc: RailingConfig): SideInfo[] {
  const out: SideInfo[] = [];
  for (const side of ['outer', 'inner'] as const) {
    const path = layout.local.paths[side];
    const info: SideInfo = { side, mode: rc[side], flights: [], landingSegments: [] };
    for (let i = 0; i < path.pts.length - 1; i++) {
      const a = path.pts[i];
      const b = path.pts[i + 1];
      const n = worldNormal(layout, a, b, path.sign);
      const mid = toWorld(layout.frame, (a.u + b.u) / 2, (a.v + b.v) / 2);
      const wl = wallInDirection(room, mid, n);
      const adjacent = wl.present && wl.distance <= WALL_ADJACENT && wl.distance >= -0.01;
      const owner = path.owner[i];
      if (owner === 'landing') info.landingSegments.push({ ...wl, adjacent, length: Math.hypot(b.u - a.u, b.v - a.v) });
      else info.flights.push({ flight: owner, ...wl, adjacent });
    }
    out.push(info);
  }
  return out;
}

export function computeRailingRuns(layout: FullLayout, room: RoomConfig, rc: RailingConfig): RailingRun[] {
  const runs: RailingRun[] = [];
  for (const side of ['outer', 'inner'] as const) {
    const mode = rc[side];
    const path = layout.local.paths[side];
    if (mode === 'none') continue;
    if (mode === 'railing') {
      // landing segments adjacent to a wall are skipped automatically (no fall risk)
      splitRuns(path, rc.landing).forEach((r, idx) => {
        const off = offsetPolyline(r.pts, RAIL_OFFSET, path.sign);
        runs.push({
          id: `${side}-${idx}`,
          side,
          kind: 'railing',
          points: off.map((p) => toV3(layout, p)),
          sloped: r.owner.map((o) => o !== 'landing'),
        });
      });
    } else {
      // wall-mounted handrail – one run per flight, positioned near the wall
      for (let i = 0; i < path.pts.length - 1; i++) {
        const owner = path.owner[i];
        if (owner === 'landing') continue;
        const a = path.pts[i];
        const b = path.pts[i + 1];
        const n = worldNormal(layout, a, b, path.sign);
        const mid = toWorld(layout.frame, (a.u + b.u) / 2, (a.v + b.v) / 2);
        const wl = wallInDirection(room, mid, n);
        const dist = wl.present && wl.distance < 0.6 ? Math.max(0.02, wl.distance - 0.075) : 0.06;
        const off = offsetPolyline([a, b], dist, path.sign);
        runs.push({
          id: `${side}-wall-${i}`,
          side,
          kind: 'wall',
          points: off.map((p) => toV3(layout, p)),
          sloped: [true],
          wallNormal: n,
          wallDistance: wl.present && wl.distance < 0.6 ? wl.distance - dist : 0.075,
        });
      }
    }
  }
  if (rc.openingGuard) runs.push(...openingGuardRuns(layout, room));
  return runs;
}

/** Guard railing around the slab opening on the upper floor (except the stair exit). */
export function openingGuardRuns(layout: FullLayout, room: RoomConfig): RailingRun[] {
  const O = layout.opening.rect;
  if (!isFinite(O.minX) || O.maxX - O.minX < 0.1 || O.maxZ - O.minZ < 0.1) return [];
  const H = room.height;
  const e = layout.opening.exitDir;
  const last = layout.flights[layout.flights.length - 1];
  const exitC = { x: last.start.x + last.dir.x * last.run, z: last.start.z + last.dir.z * last.run };
  const off = 0.04;
  const W = room.walls;
  type E = { key: string; fixed: number; a: number; b: number; axis: 'x' | 'z'; out: number; wall: boolean };
  const edges: E[] = [
    { key: 'minX', axis: 'x', fixed: O.minX - off, a: O.minZ - off, b: O.maxZ + off, out: -1, wall: W.left && O.minX < WALL_ADJACENT },
    { key: 'maxX', axis: 'x', fixed: O.maxX + off, a: O.minZ - off, b: O.maxZ + off, out: 1, wall: W.right && room.width - O.maxX < WALL_ADJACENT },
    { key: 'minZ', axis: 'z', fixed: O.minZ - off, a: O.minX - off, b: O.maxX + off, out: -1, wall: W.back && O.minZ < WALL_ADJACENT },
    { key: 'maxZ', axis: 'z', fixed: O.maxZ + off, a: O.minX - off, b: O.maxX + off, out: 1, wall: W.front && room.depth - O.maxZ < WALL_ADJACENT },
  ];
  const exitKey = e.x > 0.5 ? 'maxX' : e.x < -0.5 ? 'minX' : e.z > 0.5 ? 'maxZ' : 'minZ';
  const runs: RailingRun[] = [];
  for (const ed of edges) {
    if (ed.wall) continue;
    // clamp the run inside the room where walls exist
    let a = ed.a;
    let b = ed.b;
    const lo = ed.axis === 'x' ? (W.back ? 0.03 : -Infinity) : W.left ? 0.03 : -Infinity;
    const hi = ed.axis === 'x' ? (W.front ? room.depth - 0.03 : Infinity) : W.right ? room.width - 0.03 : Infinity;
    a = Math.max(a, lo);
    b = Math.min(b, hi);
    let intervals: [number, number][] = [[a, b]];
    if (ed.key === exitKey) {
      const c = ed.axis === 'x' ? exitC.z : exitC.x;
      const ha = last.width / 2 + 0.08;
      intervals = [
        [a, c - ha],
        [c + ha, b],
      ];
    }
    intervals.forEach(([p, q], i) => {
      if (q - p < 0.15) return;
      const pt = (t: number): V3 => (ed.axis === 'x' ? { x: ed.fixed, y: H, z: t } : { x: t, y: H, z: ed.fixed });
      runs.push({ id: `guard-${ed.key}-${i}`, side: 'guard', kind: 'railing', points: [pt(p), pt(q)], sloped: [false] });
    });
  }
  return runs;
}
