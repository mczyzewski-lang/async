import type { Rect, V2 } from './types';

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

export const v2 = (x: number, z: number): V2 => ({ x, z });
export const add = (a: V2, b: V2): V2 => ({ x: a.x + b.x, z: a.z + b.z });
export const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, z: a.z - b.z });
export const mul = (a: V2, s: number): V2 => ({ x: a.x * s, z: a.z * s });
export const dot = (a: V2, b: V2) => a.x * b.x + a.z * b.z;
export const len = (a: V2) => Math.hypot(a.x, a.z);
export const norm = (a: V2): V2 => {
  const l = len(a) || 1;
  return { x: a.x / l, z: a.z / l };
};
/** walker's right for a world plan direction (y up) */
export const rightOf = (d: V2): V2 => ({ x: -d.z, z: d.x });

export const emptyRect = (): Rect => ({ minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });

export function rectFromPoints(pts: V2[]): Rect {
  const r = emptyRect();
  for (const p of pts) {
    r.minX = Math.min(r.minX, p.x);
    r.maxX = Math.max(r.maxX, p.x);
    r.minZ = Math.min(r.minZ, p.z);
    r.maxZ = Math.max(r.maxZ, p.z);
  }
  return r;
}

export function unionRect(a: Rect, b: Rect): Rect {
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minZ: Math.min(a.minZ, b.minZ),
    maxZ: Math.max(a.maxZ, b.maxZ),
  };
}

export const rectW = (r: Rect) => r.maxX - r.minX;
export const rectD = (r: Rect) => r.maxZ - r.minZ;
export const rectCenter = (r: Rect): V2 => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });

export function rectInside(inner: Rect, outer: Rect, eps = 1e-4) {
  return (
    inner.minX >= outer.minX - eps &&
    inner.maxX <= outer.maxX + eps &&
    inner.minZ >= outer.minZ - eps &&
    inner.maxZ <= outer.maxZ + eps
  );
}

export function rectIntersects(a: Rect, b: Rect, eps = 1e-4) {
  return a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps;
}

export function clipRect(r: Rect, bounds: Rect): Rect {
  return {
    minX: Math.max(r.minX, bounds.minX),
    maxX: Math.min(r.maxX, bounds.maxX),
    minZ: Math.max(r.minZ, bounds.minZ),
    maxZ: Math.min(r.maxZ, bounds.maxZ),
  };
}

export function expandRect(r: Rect, d: number): Rect {
  return { minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + d };
}

/** Simple identity-based memoisation of the last call. */
export function memoLast<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let lastArgs: A | null = null;
  let lastResult: R;
  return (...args: A) => {
    if (lastArgs && lastArgs.length === args.length && lastArgs.every((a, i) => a === args[i])) return lastResult;
    lastResult = fn(...args);
    lastArgs = args;
    return lastResult;
  };
}

/** Sutherland–Hodgman clip of a polygon by half-plane a*x + b*y + c >= 0 */
export function clipPolygon(poly: [number, number][], a: number, b: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const fp = a * p[0] + b * p[1] + c;
    const fq = a * q[0] + b * q[1] + c;
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export const cm = (m: number, d = 0) => {
  const s = (m * 100).toFixed(d);
  return (/^-0(\.0+)?$/.test(s) ? s.slice(1) : s).replace('.', ',');
};
export const fmtCm = (m: number, d = 0) => `${cm(m, d)} cm`;
