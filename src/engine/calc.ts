import { LIMITS } from './catalog';
import { clamp } from './math';
import type { RoomConfig, StairConfig, StairShape } from './types';

/** Riser count closest to the preferred riser height, kept inside the 15–20 cm range. */
export function autoRiserCount(height: number, target: number): number {
  let n = Math.max(2, Math.round(height / clamp(target, 0.14, 0.21)));
  while (height / n > LIMITS.riserMax && n < 60) n++;
  while (height / n < LIMITS.riserMin && n > 2) n--;
  return n;
}

export function resolveRiserCount(room: RoomConfig, stair: StairConfig): number {
  if (stair.riserCountMode === 'manual') return clamp(Math.round(stair.riserCount), 2, 60);
  return autoRiserCount(room.height, stair.targetRiser);
}

/** Risers per flight. Each flight has at least 2 risers (1 tread). */
export function resolveSplit(shape: StairShape, total: number, stair: StairConfig): number[] {
  if (shape === 'I') return [total];
  if (total < 4) return [Math.ceil(total / 2), Math.floor(total / 2)];
  const n1 = stair.splitMode === 'manual' ? clamp(Math.round(stair.split), 2, total - 2) : Math.ceil(total / 2);
  return [n1, total - n1];
}

export const blondel = (riser: number, going: number) => 2 * riser + going;
export const pitchDeg = (riser: number, going: number) => (Math.atan2(riser, going) * 180) / Math.PI;

/**
 * Analytic plan size (local frame: u lateral, v along first flight) without building full geometry.
 * Used by the auto-fit search.
 */
export function analyticSize(
  shape: StairShape,
  risers: number[],
  going: number,
  width: number,
  landingDepth: number,
  gap: number,
  nosing: number,
): { u: number; v: number } {
  if (shape === 'I') return { u: width, v: (risers[0] - 1) * going + nosing };
  const R1 = (risers[0] - 1) * going;
  const R2 = (risers[1] - 1) * going;
  if (shape === 'L') {
    return { u: width + R2, v: nosing + R1 + landingDepth };
  }
  // U
  const back = R1 + landingDepth;
  const front = Math.min(-nosing, R1 - R2);
  return { u: 2 * width + gap, v: back - front };
}
