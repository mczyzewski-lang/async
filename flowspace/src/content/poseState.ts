import type { BallJoint, PoseDelta, PoseState, SegmentAngles } from './types';

const seg = (flex = 0, side = 0, twist = 0): SegmentAngles => ({ flex, side, twist });
const ball = (elev = 0, plane = 0, rot = 0): BallJoint => ({ elev, plane, rot });

/** Relaxed neutral standing: arms slightly away from the body, palms facing the thighs. */
export function neutralState(): PoseState {
  return {
    root: { pitch: 0, yaw: 0, roll: 0, x: 0, z: 0 },
    spine: seg(),
    chest: seg(),
    neck: seg(),
    head: seg(),
    clavL: { elev: 0, prot: 0 },
    clavR: { elev: 0, prot: 0 },
    shoulderL: ball(7, 10, 0),
    shoulderR: ball(7, 10, 0),
    elbowL: 8,
    elbowR: 8,
    wristL: { flex: 4, dev: 0, pron: 0 },
    wristR: { flex: 4, dev: 0, pron: 0 },
    fingersL: 0.15,
    fingersR: 0.15,
    hipL: ball(2, 0, 4),
    hipR: ball(2, 0, 4),
    kneeL: 1,
    kneeR: 1,
    ankleL: { flex: 0, inv: 0 },
    ankleR: { flex: 0, inv: 0 },
    toesL: 0,
    toesR: 0,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, delta: unknown): T {
  if (!isObj(delta)) return (delta === undefined ? base : (delta as T));
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(delta)) {
    if (v === undefined) continue;
    const b = out[k];
    // `plant` flags are replaced as a whole so a derived pose never inherits stale contacts.
    if (k === 'plant') out[k] = isObj(v) ? { ...v } : v;
    else out[k] = isObj(b) && isObj(v) ? deepMerge(b, v) : isObj(v) ? deepMerge({}, v) : v;
  }
  return out as T;
}

export function clonePose(s: PoseState): PoseState {
  return JSON.parse(JSON.stringify(s)) as PoseState;
}

/** Applies one or more partial deltas to a base state (non-destructive). */
export function pose(base: PoseState, ...deltas: PoseDelta[]): PoseState {
  let out = clonePose(base);
  for (const d of deltas) out = deepMerge(out, d);
  return out;
}

/** Same values for both sides. */
export function both<K extends string, V>(prefix: K, v: V): Record<`${K}L` | `${K}R`, V> {
  return { [`${prefix}L`]: v, [`${prefix}R`]: v } as Record<`${K}L` | `${K}R`, V>;
}

const PAIRS: Array<[keyof PoseState, keyof PoseState]> = [
  ['clavL', 'clavR'],
  ['shoulderL', 'shoulderR'],
  ['elbowL', 'elbowR'],
  ['wristL', 'wristR'],
  ['fingersL', 'fingersR'],
  ['hipL', 'hipR'],
  ['kneeL', 'kneeR'],
  ['ankleL', 'ankleR'],
  ['toesL', 'toesR'],
];

/** Mirrors a pose left↔right (used for the right-side variant of asymmetric poses). */
export function mirrorPose(s: PoseState): PoseState {
  const m = clonePose(s);
  for (const [l, r] of PAIRS) {
    const tmp = m[l];
    (m as unknown as Record<string, unknown>)[l] = m[r];
    (m as unknown as Record<string, unknown>)[r] = tmp;
  }
  const neg = (v: number) => (v === 0 ? 0 : -v);
  for (const k of ['spine', 'chest', 'neck', 'head'] as const) {
    m[k].side = neg(m[k].side);
    m[k].twist = neg(m[k].twist);
  }
  m.root.yaw = neg(m.root.yaw);
  m.root.roll = neg(m.root.roll);
  if (m.root.turn) m.root.turn = neg(m.root.turn);
  m.root.x = neg(m.root.x);
  if (s.plant) {
    m.plant = {
      handL: s.plant.handR,
      handR: s.plant.handL,
      footL: s.plant.footR,
      footR: s.plant.footL,
    };
  }
  return m;
}

/** Linear blend of anatomical parameters (used by the dev lab and breathing offsets). */
export function lerpPose(a: PoseState, b: PoseState, t: number): PoseState {
  const walk = (x: unknown, y: unknown): unknown => {
    if (typeof x === 'number' && typeof y === 'number') return x + (y - x) * t;
    if (isObj(x) && isObj(y)) {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(x)) o[k] = walk(x[k], y[k]);
      return o;
    }
    return t < 0.5 ? x : y;
  };
  return walk(a, b) as PoseState;
}

export function flattenPose(s: PoseState): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'number') out[path] = v;
    else if (isObj(v)) for (const [k, c] of Object.entries(v)) walk(c, path ? `${path}.${k}` : k);
  };
  walk({ ...s, plant: undefined }, '');
  return out;
}

export function setPath(s: PoseState, path: string, value: number): PoseState {
  const out = clonePose(s);
  const parts = path.split('.');
  let cur: Record<string, unknown> = out as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] as Record<string, unknown>;
  cur[parts[parts.length - 1]] = value;
  return out;
}
