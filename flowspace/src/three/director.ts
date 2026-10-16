import type { BaseShape, PoseState, YogaPose } from '@/content/types';
import { mirrorPose } from '@/content/poseState';
import * as S from '@/content/poses/states';
import type { InstructorRig, Segment } from './rig/InstructorRig';

/**
 * Transition planner: moving between very different body orientations (e.g. lying → standing)
 * must not be a single interpolation, otherwise limbs swing through the body. Each edge of this
 * graph lists anatomically sensible intermediate states.
 */
const EDGES: Array<[BaseShape, BaseShape, PoseState[]]> = [
  ['standing', 'allfours', [S.S_forwardFold, S.S_downDogBentKnees]],
  ['allfours', 'kneeling', []],
  ['allfours', 'plank', []],
  ['allfours', 'prone', [S.S_plankKnees]],
  ['plank', 'prone', [S.S_chaturanga]],
  ['kneeling', 'seated', [S.S_kneelHeels]],
  ['seated', 'supine', [S.S_hookLying]],
];

const GRAPH = new Map<BaseShape, Array<{ to: BaseShape; via: PoseState[] }>>();
for (const [a, b, via] of EDGES) {
  GRAPH.set(a, [...(GRAPH.get(a) ?? []), { to: b, via }]);
  GRAPH.set(b, [...(GRAPH.get(b) ?? []), { to: a, via: [...via].reverse() }]);
}

export const BASE_REST: Record<BaseShape, PoseState> = {
  standing: S.S_mountain,
  allfours: S.S_tabletop,
  kneeling: S.S_kneelHeels,
  seated: S.S_easySeated,
  supine: S.S_supine,
  prone: S.S_prone,
  plank: S.S_plank,
};

/** Intermediate states needed to travel between two base shapes (BFS, excluding endpoints). */
export function planBridge(from: BaseShape, to: BaseShape): PoseState[] {
  if (from === to) return [];
  const prev = new Map<BaseShape, { from: BaseShape; via: PoseState[] }>();
  const queue: BaseShape[] = [from];
  const seen = new Set<BaseShape>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const e of GRAPH.get(cur) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { from: cur, via: e.via });
      queue.push(e.to);
    }
  }
  if (!prev.has(to)) return [];
  const chain: PoseState[][] = [];
  let node: BaseShape = to;
  while (node !== from) {
    const p = prev.get(node)!;
    // include the rest state of intermediate bases so the path passes through them cleanly
    chain.unshift(node === to ? p.via : [...p.via, BASE_REST[node]]);
    node = p.from;
  }
  return chain.flat();
}

export type Side = 'none' | 'L' | 'R';

export function keyframeState(pose: YogaPose, keyframeId: string, side: Side): PoseState | null {
  const kf = pose.animation?.keyframes.find((k) => k.id === keyframeId);
  if (!kf) return null;
  return side === 'R' && pose.animation?.mirrorForRight ? mirrorPose(kf.state) : kf.state;
}

/** Drives the rig through pose keyframes, mistakes and transitions. */
export class PoseDirector {
  base: BaseShape = 'standing';
  current: { poseId: string; keyframe: string; side: Side } | null = null;
  constructor(public rig: InstructorRig) {}

  private bridge(toBase: BaseShape, speed: number): Segment[] {
    return planBridge(this.base, toBase).map((s) => ({ state: s, duration: 1.5 / speed, tag: 'bridge' }));
  }

  /** Moves (with a planned route) to a specific keyframe. */
  goToKeyframe(pose: YogaPose, keyframeId: string, side: Side = 'none', opts: { speed?: number; onDone?: () => void } = {}) {
    const anim = pose.animation;
    if (!anim) return;
    const kf = anim.keyframes.find((k) => k.id === keyframeId);
    if (!kf) return;
    const speed = opts.speed ?? 1;
    const segs = this.bridge(kf.base, speed);
    segs.push({ state: keyframeState(pose, keyframeId, side)!, duration: kf.duration / speed, tag: `kf:${pose.id}:${keyframeId}` });
    this.rig.breathingStyle = anim.breathing;
    this.rig.playSequence(segs, opts.onDone);
    this.base = kf.base;
    this.current = { poseId: pose.id, keyframe: keyframeId, side };
  }

  /** Plays the full entry sequence, ending in the held pose. Returns its nominal duration. */
  playEntry(pose: YogaPose, side: Side = 'none', opts: { speed?: number; onDone?: () => void; holdEach?: number } = {}) {
    const anim = pose.animation;
    if (!anim) return 0;
    const speed = opts.speed ?? 1;
    const first = anim.keyframes.find((k) => k.id === anim.entry[0])!;
    const segs: Segment[] = this.bridge(first.base, speed);
    for (const id of anim.entry) {
      const kf = anim.keyframes.find((k) => k.id === id)!;
      segs.push({ state: keyframeState(pose, id, side)!, duration: kf.duration / speed, hold: (opts.holdEach ?? 0.35) / speed, tag: `kf:${pose.id}:${id}` });
    }
    segs[segs.length - 1].hold = 0;
    this.rig.breathingStyle = anim.breathing;
    this.rig.playSequence(segs, opts.onDone);
    const last = anim.keyframes.find((k) => k.id === anim.hold) ?? anim.keyframes[anim.keyframes.length - 1];
    this.base = last.base;
    this.current = { poseId: pose.id, keyframe: last.id, side };
    return segs.reduce((s, x) => s + x.duration + (x.hold ?? 0), 0);
  }

  /** Reverses the entry (exit) back to the first keyframe. */
  playExit(pose: YogaPose, side: Side = 'none', opts: { speed?: number; onDone?: () => void } = {}) {
    const anim = pose.animation;
    if (!anim || !anim.exit.length) {
      opts.onDone?.();
      return;
    }
    const speed = opts.speed ?? 1;
    const segs: Segment[] = anim.exit.map((id) => {
      const kf = anim.keyframes.find((k) => k.id === id)!;
      return { state: keyframeState(pose, id, side)!, duration: (kf.duration * 0.8) / speed, tag: `kf:${pose.id}:${id}` };
    });
    this.rig.playSequence(segs, opts.onDone);
    const lastId = anim.exit[anim.exit.length - 1];
    this.base = anim.keyframes.find((k) => k.id === lastId)!.base;
    this.current = { poseId: pose.id, keyframe: lastId, side };
  }

  /** Shows an arbitrary state (e.g. a mistake) that shares the current base shape. */
  showState(state: PoseState, tag: string, duration = 1.6) {
    this.rig.setPose(state, duration, tag);
  }

  /** Instantly snaps to a keyframe (used when opening a pose page). */
  snapTo(pose: YogaPose, keyframeId: string, side: Side = 'none') {
    const s = keyframeState(pose, keyframeId, side);
    const kf = pose.animation?.keyframes.find((k) => k.id === keyframeId);
    if (!s || !kf) return;
    this.rig.setPose(s, 0, `kf:${pose.id}:${keyframeId}`);
    this.rig.breathingStyle = pose.animation!.breathing;
    this.base = kf.base;
    this.current = { poseId: pose.id, keyframe: keyframeId, side };
  }

  /** Returns to a neutral rest for a base shape (e.g. between session steps). */
  rest(base: BaseShape, speed = 1, onDone?: () => void) {
    const segs = this.bridge(base, speed);
    segs.push({ state: BASE_REST[base], duration: 1.5 / speed, tag: `rest:${base}` });
    this.rig.playSequence(segs, onDone);
    this.base = base;
    this.current = null;
  }
}
