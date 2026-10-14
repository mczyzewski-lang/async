/**
 * Railing geometry for six railing designs + wall-mounted handrails.
 * Runs come from engine/railingLayout and already follow flights, landings and corners.
 */
import * as THREE from 'three';
import type { RailingConfig, RailingRun } from '../../engine/types';
import { MESH_TILE, PERF_TILE, WOOD_TILE } from '../textures';
import { Parts, beam, boxUV, cyl, orientedBox, panel, quadPanel, sphere, v3 } from './primitives';

export type RailingBuildInput = Pick<
  RailingConfig,
  'type' | 'height' | 'profile' | 'spacing' | 'handrailStyle' | 'handrailMaterial'
>;

const POST = 0.04;

interface Seg {
  a: THREE.Vector3;
  b: THREE.Vector3;
  L: number;
  d: THREE.Vector3;
  slope: number;
  sloped: boolean;
}

function segsOf(run: RailingRun): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < run.points.length - 1; i++) {
    const p = run.points[i];
    const q = run.points[i + 1];
    const a = v3(p.x, p.y, p.z);
    const b = v3(q.x, q.y, q.z);
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 1e-4) continue;
    out.push({ a, b, L, d: v3((b.x - a.x) / L, 0, (b.z - a.z) / L), slope: (b.y - a.y) / L, sloped: run.sloped[i] });
  }
  return out;
}

const at = (s: Seg, t: number, dy = 0) => v3(s.a.x + s.d.x * t, s.a.y + s.slope * t + dy, s.a.z + s.d.z * t);

function handrailSize(style: RailingBuildInput['handrailStyle']) {
  if (style === 'round') return { w: 0.042, h: 0.042 };
  if (style === 'rect') return { w: 0.05, h: 0.03 };
  return { w: 0.06, h: 0.012 };
}

function addHandrail(P: Parts, pts: THREE.Vector3[], inp: RailingBuildInput) {
  const key = inp.handrailMaterial === 'wood' ? 'wood' : 'railing';
  const hs = handrailSize(inp.handrailStyle);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    let g: THREE.BufferGeometry;
    if (inp.handrailStyle === 'round') g = cyl(a, b, hs.w / 2, 16);
    else g = beam(a, b, hs.w, hs.h);
    if (key === 'wood') boxUV(g, WOOD_TILE.u, WOOD_TILE.v, i * 0.3, 0.2);
    P.add(key, g);
  }
  // joints & end caps
  pts.forEach((p, i) => {
    if (inp.handrailStyle === 'round') P.add(key, sphere(p, hs.w / 2));
    else if (i > 0 && i < pts.length - 1) {
      const g = new THREE.BoxGeometry(hs.w, hs.h * 1.6, hs.w);
      g.translate(p.x, p.y, p.z);
      P.add(key, g);
    }
  });
  P.count('handrailSegments', pts.length - 1);
}

function addPost(P: Parts, base: THREE.Vector3, top: number, d: THREE.Vector3, size = POST) {
  const bottom = Math.max(0, base.y - 0.19);
  P.add('railing', orientedBox(size, top - bottom, size, v3(base.x, bottom, base.z), d));
  P.count('post');
}

function railingRun(P: Parts, run: RailingRun, inp: RailingBuildInput) {
  const segs = segsOf(run);
  if (!segs.length) return;
  const H = inp.height;
  const hs = handrailSize(inp.handrailStyle);
  const hrY = H - hs.h / 2;
  const handPts = [segs[0].a.clone().setY(segs[0].a.y + hrY), ...segs.map((s) => s.b.clone().setY(s.b.y + hrY))];
  const isF = inp.type === 'F';
  // end posts & corner posts (not for solid panels where plates are self-framed)
  const verts = [segs[0].a, ...segs.map((s) => s.b)];
  verts.forEach((p, i) => {
    const d = segs[Math.min(i, segs.length - 1)].d;
    if (isF && i > 0 && i < verts.length - 1) return;
    addPost(P, p, p.y + hrY - hs.h / 2, d);
  });

  for (const s of segs) {
    const pad = POST / 2 + 0.01;
    switch (inp.type) {
      case 'A':
      case 'B': {
        const count = Math.max(1, Math.round((s.L - 2 * pad) / inp.spacing));
        const step = (s.L - 2 * pad) / count;
        const bottomOff = -0.06;
        // bottom rail
        P.add('railing', beam(at(s, 0, bottomOff), at(s, s.L, bottomOff), 0.012, 0.04));
        for (let k = 0; k < count; k++) {
          const t = pad + step * (k + 0.5);
          const b = at(s, t, bottomOff);
          const top = s.a.y + s.slope * t + hrY - hs.h / 2;
          if (inp.type === 'A') P.add('railing', cyl(b, v3(b.x, top, b.z), inp.profile / 2, 8));
          else P.add('railing', orientedBox(inp.profile, top - b.y, 0.01, b, s.d));
          P.count('infill');
        }
        break;
      }
      case 'C': {
        const nPostsMid = Math.max(0, Math.ceil(s.L / 1.0) - 1);
        for (let k = 1; k <= nPostsMid; k++) {
          const t = (s.L * k) / (nPostsMid + 1);
          const b = at(s, t);
          addPost(P, b, b.y + hrY - hs.h / 2, s.d, 0.035);
        }
        const nRods = Math.max(1, Math.floor((H - 0.16) / inp.spacing));
        for (let k = 0; k < nRods; k++) {
          const dy = 0.08 + k * inp.spacing;
          if (dy > H - 0.08) break;
          P.add('railing', cyl(at(s, 0, dy), at(s, s.L, dy), inp.profile / 2, 8));
          P.count('infill');
        }
        break;
      }
      case 'D':
      case 'E': {
        const nP = Math.max(1, Math.ceil(s.L / 1.2));
        const fr = inp.profile;
        for (let k = 0; k < nP; k++) {
          const t0 = (s.L * k) / nP + (k === 0 ? pad : 0.012);
          const t1 = (s.L * (k + 1)) / nP - (k === nP - 1 ? pad : 0.012);
          const yb = -0.05;
          const yt = hrY - hs.h / 2 - 0.03;
          const y0 = s.a.y + s.slope * t0;
          const y1 = s.a.y + s.slope * t1;
          // frame
          P.add('railing', beam(at(s, t0, yb), at(s, t1, yb), 0.012, fr));
          P.add('railing', beam(at(s, t0, yt), at(s, t1, yt), 0.012, fr));
          P.add('railing', orientedBox(fr, yt - yb, 0.012, at(s, t0 + fr / 2, yb), s.d));
          P.add('railing', orientedBox(fr, yt - yb, 0.012, at(s, t1 - fr / 2, yb), s.d));
          // infill sheet
          const o: [number, number][] = [
            [t0 + fr, y0 + s.slope * fr + yb + fr / 2],
            [t1 - fr, y1 - s.slope * fr + yb + fr / 2],
            [t1 - fr, y1 - s.slope * fr + yt - fr / 2],
            [t0 + fr, y0 + s.slope * fr + yt - fr / 2],
          ];
          P.add(inp.type === 'D' ? 'railPerf' : 'railMesh', quadPanel(s.a, s.b, o, inp.type === 'D' ? PERF_TILE : MESH_TILE));
          // connector to handrail
          if (k > 0) addPost(P, at(s, (s.L * k) / nP), s.a.y + s.slope * ((s.L * k) / nP) + hrY - hs.h / 2, s.d, 0.03);
          P.count('panel');
        }
        break;
      }
      case 'F': {
        const yb = -0.07;
        const yt = hrY - hs.h / 2;
        const o: [number, number][] = [
          [0, s.a.y + yb],
          [s.L, s.b.y + yb],
          [s.L, s.b.y + yt],
          [0, s.a.y + yt],
        ];
        P.add('railing', panel(s.a, s.b, o, inp.profile));
        P.count('panel');
        break;
      }
    }
  }
  addHandrail(P, handPts, inp);
}

function wallHandrail(P: Parts, run: RailingRun, inp: RailingBuildInput) {
  const segs = segsOf(run);
  const n = run.wallNormal!;
  const dist = run.wallDistance ?? 0.075;
  const H = 0.9;
  for (const s of segs) {
    const ext = 0.08;
    const a = at(s, -ext, H);
    const b = at(s, s.L + ext, H);
    const key = inp.handrailMaterial === 'wood' ? 'wood' : 'railing';
    const g = cyl(a, b, 0.021, 16);
    if (key === 'wood') boxUV(g, WOOD_TILE.u, WOOD_TILE.v, 0.1, 0.3);
    P.add(key, g);
    P.add(key, sphere(a, 0.021));
    P.add(key, sphere(b, 0.021));
    const nb = Math.max(2, Math.ceil(s.L / 0.9) + 1);
    for (let k = 0; k < nb; k++) {
      const t = (s.L * k) / (nb - 1);
      const p = at(s, t, H - 0.03);
      const w = v3(p.x + n.x * dist, p.y, p.z + n.z * dist);
      P.add('railing', cyl(at(s, t, H - 0.02), p, 0.007, 6));
      P.add('railing', cyl(p, w, 0.007, 6));
      P.add('railing', cyl(w.clone().sub(v3(n.x * 0.008, 0, n.z * 0.008)), w, 0.032, 16));
      P.count('bracket');
    }
    P.count('wallHandrail');
  }
}

export function buildRailings(runs: RailingRun[], inp: RailingBuildInput) {
  const P = new Parts();
  for (const r of runs) {
    if (r.kind === 'wall') wallHandrail(P, r, inp);
    else railingRun(P, r, inp);
  }
  return { geometries: P.merge(), counts: { ...P.counts } };
}
