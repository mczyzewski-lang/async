/** Pure, time-driven animation helpers. Everything is a function of t — no state. */
import * as THREE from 'three';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export type Ease = (p: number) => number;
export const ease = {
  linear: (p: number) => p,
  inOut: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  out: (p: number) => 1 - Math.pow(1 - p, 3),
  in: (p: number) => p * p * p,
  outBack: (p: number) => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2),
  outElastic: (p: number) =>
    p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  smooth: (p: number) => p * p * (3 - 2 * p),
} satisfies Record<string, Ease>;

/** 0 before a, 1 after b, eased in between. */
export function ramp(t: number, a: number, b: number, e: Ease = ease.inOut): number {
  if (b <= a) return t >= a ? 1 : 0;
  return e(clamp01((t - a) / (b - a)));
}

/** Visibility window: fades in at `a`, out at `b`. */
export function win(t: number, a: number, b: number, fadeIn = 0.5, fadeOut = 0.5): number {
  return Math.min(ramp(t, a, a + fadeIn, ease.out), 1 - ramp(t, b - fadeOut, b, ease.in));
}

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export interface CamKey {
  t: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
  /** Easing INTO this key from the previous one. */
  ease?: Ease;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Sample a camera track. Segments are eased; holds are expressed as repeated keys. */
export function sampleCam(keys: CamKey[], t: number, out: { pos: THREE.Vector3; look: THREE.Vector3; fov: number }) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const k0 = keys[i];
  const k1 = keys[Math.min(i + 1, keys.length - 1)];
  const p = k1.t > k0.t ? (k1.ease ?? ease.inOut)(clamp01((t - k0.t) / (k1.t - k0.t))) : 1;
  out.pos.copy(_a.fromArray(k0.pos)).lerp(_b.fromArray(k1.pos), p);
  out.look.copy(_a.fromArray(k0.look)).lerp(_b.fromArray(k1.look), p);
  out.fov = lerp(k0.fov ?? 40, k1.fov ?? k0.fov ?? 40, p);
}
