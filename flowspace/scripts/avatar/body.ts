/**
 * Reconstructs the complete MakeHuman body for the avatar. MPFB deletes the skin hidden under
 * clothing; we recover it from the hm08 base mesh: macro targets are fitted (least squares) to the
 * visible vertices, the remaining per-vertex residual is spread smoothly (harmonic interpolation),
 * and skin weights for the recovered region come from the CC0 MPFB game-engine rig weights.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CACHE, TARGETS } from './sources';

export interface Obj {
  V: number[][];
  VT: number[][];
  faces: { v: number[]; t: number[] }[];
}

export function readBaseObj(): Obj {
  const V: number[][] = [];
  const VT: number[][] = [];
  const faces: Obj['faces'] = [];
  let g = '';
  for (const l of readFileSync(resolve(CACHE, 'base.obj'), 'utf8').split('\n')) {
    const p = l.trim().split(/\s+/);
    if (p[0] === 'v') V.push(p.slice(1, 4).map(Number));
    else if (p[0] === 'vt') VT.push(p.slice(1, 3).map(Number));
    else if (p[0] === 'g') g = p[1];
    else if (p[0] === 'f' && g === 'body') {
      const v: number[] = [];
      const t: number[] = [];
      for (const q of p.slice(1)) {
        const [a, b] = q.split('/');
        v.push(+a - 1);
        t.push(+b - 1);
      }
      faces.push({ v, t });
    }
  }
  return { V, VT, faces };
}

export function readTarget(name: string): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (const l of readFileSync(resolve(CACHE, 'targets', name), 'utf8').split('\n')) {
    if (!l || l.startsWith('#')) continue;
    const p = l.trim().split(/\s+/).map(Number);
    if (p.length >= 4) m.set(p[0], [p[1], p[2], p[3]]);
  }
  return m;
}

/** Solves (AᵀA + λI) x = Aᵀb with Gaussian elimination (small dense systems). */
function solve(AtA: number[][], Atb: number[]) {
  const n = Atb.length;
  const M = AtA.map((r, i) => [...r, Atb[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/**
 * @param known base-vertex index → exported position (metres)
 * @returns positions (metres) for every base vertex used by the body faces
 */
export function reconstructBody(obj: Obj, known: Map<number, number[]>) {
  const S = 0.1;
  const targets = TARGETS.map(readTarget);
  const nT = targets.length;
  // unknowns: t (3, one per axis) + c_j
  const n = 3 + nT;
  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb = new Array(n).fill(0);
  const row = new Array(n).fill(0);
  for (const [i, p] of known) {
    for (let a = 0; a < 3; a++) {
      row.fill(0);
      row[a] = 1;
      for (let j = 0; j < nT; j++) row[3 + j] = S * (targets[j].get(i)?.[a] ?? 0);
      const b = p[a] - S * obj.V[i][a];
      for (let r = 0; r < n; r++) {
        if (row[r] === 0) continue;
        Atb[r] += row[r] * b;
        for (let c = 0; c < n; c++) AtA[r][c] += row[r] * row[c];
      }
    }
  }
  for (let j = 0; j < nT; j++) AtA[3 + j][3 + j] += 0.5; // ridge
  const x = solve(AtA, Atb);
  const model = obj.V.map((v, i) => {
    const out = [0, 0, 0];
    for (let a = 0; a < 3; a++) {
      let d = 0;
      for (let j = 0; j < nT; j++) d += x[3 + j] * (targets[j].get(i)?.[a] ?? 0);
      out[a] = S * (v[a] + d) + x[a];
    }
    return out;
  });
  let se = 0;
  for (const [i, p] of known) se += (p[0] - model[i][0]) ** 2 + (p[1] - model[i][1]) ** 2 + (p[2] - model[i][2]) ** 2;
  const rms = Math.sqrt(se / known.size);

  // Harmonic interpolation of the residual over the mesh graph (known vertices fixed).
  const nbr = new Map<number, Set<number>>();
  for (const f of obj.faces)
    f.v.forEach((a, k) => {
      const b = f.v[(k + 1) % f.v.length];
      if (!nbr.has(a)) nbr.set(a, new Set());
      if (!nbr.has(b)) nbr.set(b, new Set());
      nbr.get(a)!.add(b);
      nbr.get(b)!.add(a);
    });
  const res = new Map<number, number[]>();
  for (const i of nbr.keys()) res.set(i, known.has(i) ? known.get(i)!.map((p, a) => p - model[i][a]) : [0, 0, 0]);
  const free = [...nbr.keys()].filter((i) => !known.has(i));
  for (let it = 0; it < 600; it++) {
    for (const i of free) {
      const acc = [0, 0, 0];
      const ns = nbr.get(i)!;
      for (const j of ns) {
        const r = res.get(j)!;
        acc[0] += r[0];
        acc[1] += r[1];
        acc[2] += r[2];
      }
      res.set(i, acc.map((x) => x / ns.size));
    }
  }
  const pos = new Map<number, number[]>();
  for (const i of nbr.keys()) pos.set(i, known.get(i) ?? model[i].map((m, a) => m + res.get(i)![a]));
  return { pos, rms, coeffs: Object.fromEntries(TARGETS.map((t, j) => [t, +x[3 + j].toFixed(3)])) };
}
