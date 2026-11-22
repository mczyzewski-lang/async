import { useEffect, useRef } from 'react';
import type { Span, Timing } from './types';

/**
 * What every film (3D scene + DOM overlay) receives. `now()` is the single source
 * of truth for time: it is driven by the audio element when narration exists, by
 * the playhead clock otherwise, and by the exporter when rendering frames.
 */
export interface Timeline {
  now: () => number;
  timing: Timing;
  /** Start of a cue (seconds). Throws early on typos so scripts and visuals can't drift. */
  cue: (id: string) => Span;
  scene: (id: string) => Span;
  aspect: number;
}

export function makeTimeline(timing: Timing, now: () => number, aspect = 16 / 9): Timeline {
  const get = (map: Record<string, Span>, kind: string) => (id: string) => {
    const s = map[id];
    if (!s) throw new Error(`Unknown ${kind} id "${id}"`);
    return s;
  };
  return { now, timing, cue: get(timing.cues, 'cue'), scene: get(timing.scenes, 'scene'), aspect };
}

/** Shared rAF hub so DOM overlays update imperatively without React re-renders. */
const subs = new Set<() => void>();
let running = false;
function loop() {
  subs.forEach((f) => f());
  if (subs.size) requestAnimationFrame(loop);
  else running = false;
}

export function useTick(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const f = () => ref.current();
    subs.add(f);
    f();
    if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
    return () => void subs.delete(f);
  }, []);
}
