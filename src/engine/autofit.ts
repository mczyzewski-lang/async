/**
 * "Dopasuj automatycznie" — searches for the most comfortable feasible geometry
 * for the available space. Never fabricates geometry: returns null when nothing fits.
 */
import { analyticSize, autoRiserCount } from './calc';
import { LIMITS } from './catalog';
import { solve } from './solve';
import type { Config, EntryDir, StairConfig, StairShape } from './types';

export interface AutoFitResult {
  ok: boolean;
  config?: Config;
  message: string;
  details: string[];
  alternatives: StairShape[];
}

interface Candidate {
  cost: number;
  stair: StairConfig;
}

const ENTRIES: EntryDir[] = ['back', 'front', 'left', 'right'];
const MARGIN = 0.05; // railing allowance on each side

function candidates(config: Config, shape: StairShape): Candidate[] {
  const { room, stair } = config;
  const H = room.height;
  const out: Candidate[] = [];
  const nMin = Math.ceil(H / LIMITS.riserMax - 1e-9);
  const nMax = Math.floor(H / LIMITS.riserMin + 1e-9);
  const widths: number[] = [];
  for (let w = stair.flightWidth; w >= 0.8 - 1e-9; w -= 0.05) widths.push(Math.round(w * 1000) / 1000);
  if (!widths.length) widths.push(0.8);
  const gap = stair.gap;

  for (let N = nMin; N <= nMax; N++) {
    const h = H / N;
    if (h > LIMITS.riserMax + 1e-9 || h < LIMITS.riserMin - 1e-9) continue;
    const gLo = Math.max(LIMITS.goingComfortMin - 0.01, LIMITS.blondelMin - 2 * h);
    const gHi = Math.min(0.32, LIMITS.blondelMax - 2 * h);
    for (let g = Math.ceil(gLo * 200) / 200; g <= gHi + 1e-9; g += 0.005) {
      const gR = Math.round(g * 1000) / 1000;
      const splits: number[][] = [];
      if (shape === 'I') splits.push([N]);
      else if (shape === 'U') {
        const c = Math.ceil(N / 2);
        for (const n1 of [c, c - 1, c + 1]) if (n1 >= 3 && N - n1 >= 3) splits.push([n1, N - n1]);
      } else {
        for (let n1 = 3; n1 <= N - 3; n1++) splits.push([n1, N - n1]);
      }
      for (const w of widths) {
        const lds = shape === 'I' ? [w] : [w, w + 0.1];
        for (const split of splits) {
          if (split.some((n) => n > LIMITS.maxRisersPerFlight)) continue;
          for (const Ld of lds) {
            const sz = analyticSize(shape, split, gR, w, Ld, gap, stair.nosing);
            for (const entry of ENTRIES) {
              const alongZ = entry === 'back' || entry === 'front';
              const sx = (alongZ ? sz.u : sz.v) + 2 * MARGIN;
              const szz = (alongZ ? sz.v : sz.u) + 2 * MARGIN;
              if (sx > room.width + 1e-9 || szz > room.depth + 1e-9) continue;
              const bl = 2 * h + gR;
              let cost = ((bl - 0.63) * 100) ** 2 + 0.6 * ((h - 0.175) * 100) ** 2;
              if (gR < 0.27) cost += 0.5 * ((0.27 - gR) * 100) ** 2;
              cost += (stair.flightWidth - w) * 100 * 2.5;
              cost += (Ld - w) * 100 * 0.08;
              if (split.length === 2) cost += shape === 'U' ? Math.abs(split[0] - split[1]) * 1.5 : Math.abs(split[0] - split[1]) * 0.15;
              if (entry !== stair.placement.entry) cost += 0.4;
              if (shape !== stair.shape) cost += 0;
              const auto = autoRiserCount(H, stair.targetRiser);
              const balanced = shape === 'I' ? true : split[0] === Math.ceil(N / 2);
              out.push({
                cost,
                stair: {
                  ...stair,
                  shape,
                  flightWidth: w,
                  going: gR,
                  riserCountMode: N === auto ? 'auto' : 'manual',
                  riserCount: N,
                  splitMode: balanced ? 'auto' : 'manual',
                  split: split[0],
                  landingDepth: Ld,
                  placement: {
                    ...stair.placement,
                    entry,
                    alignX: stair.placement.alignX === 'manual' ? 'center' : stair.placement.alignX,
                    alignZ: stair.placement.alignZ === 'manual' ? 'center' : stair.placement.alignZ,
                  },
                  opening: { ...stair.opening, mode: 'auto' },
                },
              });
            }
          }
        }
      }
    }
  }
  return out.sort((a, b) => a.cost - b.cost);
}

function firstFeasible(config: Config, shape: StairShape): Config | null {
  const cands = candidates(config, shape);
  for (const c of cands.slice(0, 80)) {
    for (const align of [null, 'center'] as const) {
      const stair = align ? { ...c.stair, placement: { ...c.stair.placement, alignX: align, alignZ: align } } : c.stair;
      const cfg: Config = { ...config, stair };
      const { analysis } = solve(cfg);
      const hardErr = analysis.issues.some((i) => i.level === 'error');
      if (analysis.fitsRoom && analysis.headroomOk && !hardErr) return cfg;
    }
  }
  return null;
}

export function autoFit(config: Config): AutoFitResult {
  const shape = config.stair.shape;
  const best = firstFeasible(config, shape);
  const others = (['I', 'L', 'U'] as StairShape[]).filter((s) => s !== shape);
  if (best) {
    const { analysis } = solve(best);
    const s = best.stair;
    const changes: string[] = [];
    const o = config.stair;
    if (analysis.riserCount !== solve(config).analysis.riserCount) changes.push(`liczba stopni: ${analysis.riserCount}`);
    if (Math.abs(s.going - o.going) > 1e-6) changes.push(`głębokość stopnia: ${(s.going * 100).toFixed(1).replace('.', ',')} cm`);
    if (Math.abs(s.flightWidth - o.flightWidth) > 1e-6) changes.push(`szerokość biegu: ${Math.round(s.flightWidth * 100)} cm`);
    if (s.placement.entry !== o.placement.entry) changes.push('zmieniony kierunek wejścia');
    if (Math.abs(s.landingDepth - o.landingDepth) > 1e-6 && shape !== 'I') changes.push(`spocznik: ${Math.round(s.landingDepth * 100)} cm`);
    if (s.split !== o.split && shape !== 'I') changes.push(`podział biegów: ${analysis.flightsRisers.join(' + ')}`);
    return {
      ok: true,
      config: best,
      message: changes.length ? 'Znaleziono wygodną geometrię mieszczącą się w przestrzeni.' : 'Bieżąca geometria jest już optymalna.',
      details: changes,
      alternatives: [],
    };
  }
  const alternatives = others.filter((sh) => firstFeasible(config, sh) !== null);
  return {
    ok: false,
    message: `Brak wykonalnej geometrii schodów typu ${shape} w tej przestrzeni.`,
    details: alternatives.length
      ? [`W tej przestrzeni zmieszczą się schody typu ${alternatives.join(' lub ')}.`]
      : ['Żaden kształt schodów nie mieści się wygodnie — zwiększ wymiary przestrzeni.'],
    alternatives,
  };
}

/** Auto-fit restricted to a different shape (used by the alternative-shape buttons) */
export function autoFitShape(config: Config, shape: StairShape): Config | null {
  return firstFeasible({ ...config, stair: { ...config.stair, shape } }, shape);
}
