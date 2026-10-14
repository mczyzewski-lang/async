/**
 * Dimension annotation specs per view (pure data — rendered by three/Dimensions).
 */
import type { FullLayout } from './layout';
import { cm } from './math';
import type { Analysis, Config, V3 } from './types';

export type DimTone = 'room' | 'stair' | 'clear' | 'warn' | 'opening';
export type DimView = 'persp' | 'top' | 'side';

export interface DimSpec {
  id: string;
  a: V3;
  b: V3;
  offset: V3;
  label: string;
  tone: DimTone;
}

const p = (x: number, y: number, z: number): V3 => ({ x, y, z });
const lab = (m: number) => `${cm(m, Math.abs(m * 100 - Math.round(m * 100)) > 0.05 ? 1 : 0)}`;

export function computeDimensions(view: DimView, layout: FullLayout, analysis: Analysis, config: Config): DimSpec[] {
  const { room, stair } = config;
  const W = room.width;
  const D = room.depth;
  const H = room.height;
  const wt = room.wallThickness;
  const fp = analysis.footprint;
  const out: DimSpec[] = [];
  const oF = (room.walls.front ? wt : 0) + 0.45;
  const oR = (room.walls.right ? wt : 0) + 0.45;
  const oB = (room.walls.back ? wt : 0) + 0.45;
  const oL = (room.walls.left ? wt : 0) + 0.45;
  const f1 = layout.flights[0];
  const outerSign = stair.turn === 'right' ? -1 : 1;

  if (view === 'persp') {
    out.push({ id: 'room-w', a: p(0, 0, D), b: p(W, 0, D), offset: p(0, 0, oF), label: lab(W), tone: 'room' });
    out.push({ id: 'room-d', a: p(W, 0, 0), b: p(W, 0, D), offset: p(oR, 0, 0), label: lab(D), tone: 'room' });
    out.push({ id: 'room-h', a: p(W, 0, D), b: p(W, H, D), offset: p(oR, 0, oF), label: lab(H), tone: 'room' });
    out.push({ id: 'fp-x', a: p(fp.minX, 0.004, fp.maxZ), b: p(fp.maxX, 0.004, fp.maxZ), offset: p(0, 0, 0.18), label: lab(fp.maxX - fp.minX), tone: analysis.fitsRoom ? 'stair' : 'warn' });
    out.push({ id: 'fp-z', a: p(fp.maxX, 0.004, fp.minZ), b: p(fp.maxX, 0.004, fp.maxZ), offset: p(0.18, 0, 0), label: lab(fp.maxZ - fp.minZ), tone: analysis.fitsRoom ? 'stair' : 'warn' });
    for (const L of layout.landings) {
      const x = L.rect.maxX;
      const z = L.rect.maxZ;
      out.push({ id: 'landing-y', a: p(x, 0, z), b: p(x, L.topY, z), offset: p(0.12, 0, 0.12), label: `↑ ${lab(L.topY)}`, tone: 'stair' });
    }
    return out;
  }

  if (view === 'top') {
    const y = 0.02;
    out.push({ id: 'room-w', a: p(0, y, 0), b: p(W, y, 0), offset: p(0, 0, -oB), label: lab(W), tone: 'room' });
    out.push({ id: 'room-d', a: p(0, y, 0), b: p(0, y, D), offset: p(-oL, 0, 0), label: lab(D), tone: 'room' });
    out.push({ id: 'fp-x', a: p(fp.minX, y, fp.maxZ), b: p(fp.maxX, y, fp.maxZ), offset: p(0, 0, 0.22), label: lab(fp.maxX - fp.minX), tone: analysis.fitsRoom ? 'stair' : 'warn' });
    out.push({ id: 'fp-z', a: p(fp.maxX, y, fp.minZ), b: p(fp.maxX, y, fp.maxZ), offset: p(0.22, 0, 0), label: lab(fp.maxZ - fp.minZ), tone: analysis.fitsRoom ? 'stair' : 'warn' });
    const c = analysis.clearances;
    const zc = Math.min(Math.max(fp.minZ + 0.25, 0.1), D - 0.1);
    const xc = Math.min(Math.max(fp.minX + 0.25, 0.1), W - 0.1);
    const clr = (id: string, a: V3, b: V3, v: number) => {
      if (Math.abs(v) < 0.015) return;
      out.push({ id, a, b, offset: p(0, 0, 0), label: v < 0 ? `−${lab(-v)}` : lab(v), tone: v < 0 ? 'warn' : 'clear' });
    };
    clr('c-left', p(0, y, zc), p(fp.minX, y, zc), c.left);
    clr('c-right', p(fp.maxX, y, zc), p(W, y, zc), c.right);
    clr('c-back', p(xc, y, 0), p(xc, y, fp.minZ), c.back);
    clr('c-front', p(xc, y, fp.maxZ), p(xc, y, D), c.front);
    layout.flights.forEach((f, i) => {
      const s = f.start;
      const r = f.right;
      const w = f.width / 2;
      out.push({
        id: `fw-${i}`,
        a: p(s.x - r.x * w, y, s.z - r.z * w),
        b: p(s.x + r.x * w, y, s.z + r.z * w),
        offset: p(-f.dir.x * 0.3, 0, -f.dir.z * 0.3),
        label: lab(f.width),
        tone: 'stair',
      });
      const side = outerSign * (w + 0.3);
      out.push({
        id: `run-${i}`,
        a: p(s.x, y, s.z),
        b: p(s.x + f.dir.x * f.run, y, s.z + f.dir.z * f.run),
        offset: p(r.x * side, 0, r.z * side),
        label: `${f.treads} × ${lab(f.going)} = ${lab(f.run)}`,
        tone: 'stair',
      });
    });
    if (layout.landings.length) {
      const L = layout.landings[0];
      const e = { x: f1.start.x + f1.dir.x * f1.run, z: f1.start.z + f1.dir.z * f1.run };
      const ld = stair.landingDepth;
      const side = outerSign * (f1.width / 2 + 0.3);
      out.push({
        id: 'landing-d',
        a: p(e.x, y, e.z),
        b: p(e.x + f1.dir.x * ld, y, e.z + f1.dir.z * ld),
        offset: p(f1.right.x * side, 0, f1.right.z * side),
        label: `spocznik ${lab(ld)}`,
        tone: 'stair',
      });
      if (stair.shape === 'U' && layout.flights[1]) {
        const g = stair.gap;
        const a = { x: f1.start.x - f1.right.x * outerSign * (f1.width / 2), z: f1.start.z - f1.right.z * outerSign * (f1.width / 2) };
        out.push({
          id: 'gap',
          a: p(a.x + f1.dir.x * (f1.run * 0.5), y, a.z + f1.dir.z * (f1.run * 0.5)),
          b: p(a.x + f1.dir.x * (f1.run * 0.5) - f1.right.x * outerSign * g, y, a.z + f1.dir.z * (f1.run * 0.5) - f1.right.z * outerSign * g),
          offset: p(0, 0, 0),
          label: lab(g),
          tone: 'stair',
        });
      }
      void L;
    }
    const O = layout.opening.rect;
    if (isFinite(O.minX)) {
      out.push({ id: 'open-x', a: p(O.minX, y, O.minZ), b: p(O.maxX, y, O.minZ), offset: p(0, 0, 0.12), label: `otwór ${lab(O.maxX - O.minX)}`, tone: 'opening' });
      out.push({ id: 'open-z', a: p(O.minX, y, O.minZ), b: p(O.minX, y, O.maxZ), offset: p(0.12, 0, 0), label: `otwór ${lab(O.maxZ - O.minZ)}`, tone: 'opening' });
    }
    return out;
  }

  // side elevation
  const d = f1.dir;
  const s = f1.start;
  const pre = { x: s.x - d.x * 0.7, z: s.z - d.z * 0.7 };
  out.push({ id: 'h', a: p(pre.x, 0, pre.z), b: p(pre.x, H, pre.z), offset: p(0, 0, 0), label: lab(H), tone: 'room' });
  const pre2 = { x: s.x - d.x * 0.35, z: s.z - d.z * 0.35 };
  out.push({ id: 'slab', a: p(pre2.x, H - room.slabThickness, pre2.z), b: p(pre2.x, H, pre2.z), offset: p(0, 0, 0), label: `strop ${lab(room.slabThickness)}`, tone: 'opening' });
  const h = layout.riserHeight;
  const g = layout.going;
  const s0 = { x: s.x - d.x * 0.12, z: s.z - d.z * 0.12 };
  out.push({ id: 'riser', a: p(s0.x, 0, s0.z), b: p(s0.x, h, s0.z), offset: p(0, 0, 0), label: `h ${cm(h, 1)}`, tone: 'stair' });
  out.push({ id: 'going', a: p(s.x, h + 0.06, s.z), b: p(s.x + d.x * g, h + 0.06, s.z + d.z * g), offset: p(0, 0, 0), label: `s ${cm(g, 1)}`, tone: 'stair' });
  out.push({ id: 'run1', a: p(s.x, 0, s.z), b: p(s.x + d.x * f1.run, 0, s.z + d.z * f1.run), offset: p(0, -0.22, 0), label: lab(f1.run), tone: 'stair' });
  for (const L of layout.landings) {
    const e = { x: s.x + d.x * (f1.run + stair.landingDepth + 0.25), z: s.z + d.z * (f1.run + stair.landingDepth + 0.25) };
    out.push({ id: 'landing-y', a: p(e.x, 0, e.z), b: p(e.x, L.topY, e.z), offset: p(0, 0, 0), label: `spocznik ${lab(L.topY)}`, tone: 'stair' });
  }
  return out;
}
