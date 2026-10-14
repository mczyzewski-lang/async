/**
 * Upper floor opening and headroom calculations.
 */
import { LIMITS } from './catalog';
import { add, clipRect, emptyRect, mul, rectFromPoints, rectInside, unionRect } from './math';
import type { FlightSolved, LandingSolved, Opening, Rect, RoomConfig, StairConfig, V2 } from './types';

interface LayoutLike {
  flights: FlightSolved[];
  landings: LandingSolved[];
  footprint: Rect;
}

export const HEADROOM_MARGIN = 0.05;
const RAIL_MARGIN = 0.05;

export const roomRect = (room: RoomConfig): Rect => ({ minX: 0, maxX: room.width, minZ: 0, maxZ: room.depth });

/** All walking surfaces (treads + landings) with their plan rect and elevation */
export function walkingSurfaces(l: LayoutLike) {
  const out: { rect: Rect; topY: number; flight: number | null; step: number }[] = [];
  l.flights.forEach((f, fi) => f.treadRects.forEach((t, k) => out.push({ ...t, flight: fi, step: k })));
  l.landings.forEach((ld) => out.push({ rect: ld.rect, topY: ld.topY, flight: null, step: -1 }));
  return out;
}

/** Build the slab opening rectangle anchored at the exit (top riser) line. */
export function computeOpening(l: LayoutLike, room: RoomConfig, stair: StairConfig): Opening {
  const last = l.flights[l.flights.length - 1];
  const e = last.dir;
  const exitCenter = add(last.start, mul(e, last.run));
  const a = add(exitCenter, mul(last.right, -last.width / 2));
  const b = add(exitCenter, mul(last.right, last.width / 2));
  const slabBottom = room.height - room.slabThickness;
  const need = LIMITS.headroom + HEADROOM_MARGIN;

  // elements that would violate headroom if covered by slab must lie in the opening
  let req = rectFromPoints([a, b]);
  for (const s of walkingSurfaces(l)) {
    if (slabBottom - s.topY < need) req = unionRect(req, s.rect);
  }
  // the last flight is always inside the opening
  req = unionRect(req, last.rect);
  // expand except on the exit side (slab begins exactly at the exit line)
  const ex = { ...req };
  ex.minX -= e.x > 0.5 ? RAIL_MARGIN : e.x < -0.5 ? 0 : RAIL_MARGIN;
  ex.maxX += e.x < -0.5 ? RAIL_MARGIN : e.x > 0.5 ? 0 : RAIL_MARGIN;
  ex.minZ -= e.z > 0.5 ? RAIL_MARGIN : e.z < -0.5 ? 0 : RAIL_MARGIN;
  ex.maxZ += e.z < -0.5 ? RAIL_MARGIN : e.z > 0.5 ? 0 : RAIL_MARGIN;
  // snap the exit side exactly to the exit line
  if (e.x > 0.5) ex.maxX = exitCenter.x;
  if (e.x < -0.5) ex.minX = exitCenter.x;
  if (e.z > 0.5) ex.maxZ = exitCenter.z;
  if (e.z < -0.5) ex.minZ = exitCenter.z;

  const alongX = Math.abs(e.x) > 0.5;
  const autoLength = alongX ? ex.maxX - ex.minX : ex.maxZ - ex.minZ;
  const autoWidth = alongX ? ex.maxZ - ex.minZ : ex.maxX - ex.minX;

  let rect: Rect = ex;
  let length = autoLength;
  let width = autoWidth;
  if (stair.opening.mode === 'manual') {
    length = stair.opening.length;
    width = stair.opening.width;
    if (alongX) {
      const cz = (ex.minZ + ex.maxZ) / 2;
      rect = e.x > 0
        ? { minX: exitCenter.x - length, maxX: exitCenter.x, minZ: cz - width / 2, maxZ: cz + width / 2 }
        : { minX: exitCenter.x, maxX: exitCenter.x + length, minZ: cz - width / 2, maxZ: cz + width / 2 };
    } else {
      const cx = (ex.minX + ex.maxX) / 2;
      rect = e.z > 0
        ? { minX: cx - width / 2, maxX: cx + width / 2, minZ: exitCenter.z - length, maxZ: exitCenter.z }
        : { minX: cx - width / 2, maxX: cx + width / 2, minZ: exitCenter.z, maxZ: exitCenter.z + length };
    }
  }
  rect = clipRect(rect, roomRect(room));
  if (rect.maxX < rect.minX || rect.maxZ < rect.minZ) rect = emptyRect();
  return { rect, exitDir: e, exitLine: { a, b }, length, width, autoLength, autoWidth };
}

export interface HeadroomResult {
  min: number | null;
  /** surfaces that violate the headroom requirement */
  violations: { rect: Rect; topY: number; headroom: number }[];
}

/** Vertical clearance from walking surfaces to the slab soffit (where the slab covers them). */
export function computeHeadroom(l: LayoutLike, opening: Opening, room: RoomConfig): HeadroomResult {
  const slabBottom = room.height - room.slabThickness;
  const rr = roomRect(room);
  let min: number | null = null;
  const violations: HeadroomResult['violations'] = [];
  for (const s of walkingSurfaces(l)) {
    // parts outside the room are reported as a fit conflict instead
    if (!rectInside(s.rect, rr, 0.002)) continue;
    if (rectInside(s.rect, opening.rect, 0.002)) continue;
    const hr = slabBottom - s.topY;
    if (hr <= 0) continue; // above the slab soffit (at the exit) – not a headroom case
    if (min === null || hr < min) min = hr;
    if (hr < LIMITS.headroom) violations.push({ rect: s.rect, topY: s.topY, headroom: hr });
  }
  return { min, violations };
}

/** Distance from exit line to the wall the user walks towards. Infinity when that wall is absent. */
export function exitClearance(l: LayoutLike, room: RoomConfig): number {
  const last = l.flights[l.flights.length - 1];
  const e = last.dir;
  const p: V2 = add(last.start, mul(e, last.run));
  if (e.x > 0.5) return room.walls.right ? room.width - p.x : Infinity;
  if (e.x < -0.5) return room.walls.left ? p.x : Infinity;
  if (e.z > 0.5) return room.walls.front ? room.depth - p.z : Infinity;
  return room.walls.back ? p.z : Infinity;
}
