import { describe, expect, it } from 'vitest';
import { autoFit } from './autofit';
import { autoRiserCount, blondel, resolveSplit } from './calc';
import { DEFAULT_CONFIG, cloneConfig } from './defaults';
import { applyPreset, PRESETS } from './presets';
import { solve } from './solve';
import type { Config, StairShape } from './types';

const withStair = (c: Config, patch: Partial<Config['stair']>): Config => ({ ...c, stair: { ...c.stair, ...patch } });
const withRoom = (c: Config, patch: Partial<Config['room']>): Config => ({ ...c, room: { ...c.room, ...patch } });

describe('riser calculation', () => {
  it('default U: 350 cm → 20 risers of 17.5 cm, landing at 175 cm', () => {
    const { analysis, layout } = solve(DEFAULT_CONFIG);
    expect(analysis.riserCount).toBe(20);
    expect(analysis.riserHeight).toBeCloseTo(0.175, 6);
    expect(analysis.landingElevations[0]).toBeCloseTo(1.75, 6);
    expect(analysis.flightsRisers).toEqual([10, 10]);
    expect(analysis.flightsTreads).toEqual([9, 9]);
    expect(layout.flights).toHaveLength(2);
    expect(layout.landings).toHaveLength(1);
    expect(analysis.blondel).toBeCloseTo(0.63, 6);
    expect(analysis.status).toBe('ok');
    expect(analysis.fitsRoom).toBe(true);
  });

  it('riser heights always stay within 15–20 cm in auto mode', () => {
    for (let H = 2.5; H <= 4.5; H += 0.05) {
      const n = autoRiserCount(H, 0.175);
      expect(H / n).toBeLessThanOrEqual(0.2 + 1e-9);
      expect(H / n).toBeGreaterThanOrEqual(0.15 - 1e-9);
    }
  });

  it('Test B: 300 → 350 cm floor height recalculates risers and geometry', () => {
    const a = solve(withRoom(DEFAULT_CONFIG, { height: 3.0 }));
    const b = solve(withRoom(DEFAULT_CONFIG, { height: 3.5 }));
    expect(a.analysis.riserCount).not.toBe(b.analysis.riserCount);
    expect(a.analysis.riserCount * a.analysis.riserHeight).toBeCloseTo(3.0, 6);
    expect(b.analysis.riserCount * b.analysis.riserHeight).toBeCloseTo(3.5, 6);
    const topA = a.layout.flights.at(-1)!.topY;
    const topB = b.layout.flights.at(-1)!.topY;
    expect(topA).toBeCloseTo(3.0, 6);
    expect(topB).toBeCloseTo(3.5, 6);
  });

  it('split distributes risers between flights', () => {
    expect(resolveSplit('U', 20, DEFAULT_CONFIG.stair)).toEqual([10, 10]);
    expect(resolveSplit('U', 19, DEFAULT_CONFIG.stair)).toEqual([10, 9]);
    expect(resolveSplit('L', 18, { ...DEFAULT_CONFIG.stair, splitMode: 'manual', split: 5 })).toEqual([5, 13]);
    expect(resolveSplit('I', 18, DEFAULT_CONFIG.stair)).toEqual([18]);
  });

  it('blondel formula', () => {
    expect(blondel(0.175, 0.28)).toBeCloseTo(0.63);
  });
});

describe('shapes', () => {
  it('Test A: U → I changes geometry, footprint, flight count', () => {
    const u = solve(DEFAULT_CONFIG);
    const i = solve(withStair(DEFAULT_CONFIG, { shape: 'I' }));
    expect(u.layout.flights.length).toBe(2);
    expect(i.layout.flights.length).toBe(1);
    expect(i.layout.landings.length).toBe(0);
    expect(i.analysis.footprintSize.z).toBeGreaterThan(u.analysis.footprintSize.z);
    expect(i.analysis.footprintSize.x).toBeLessThan(u.analysis.footprintSize.x);
  });

  it('flights are physically continuous (top of flight = landing = base of next)', () => {
    for (const shape of ['L', 'U'] as StairShape[]) {
      const { layout } = solve(withStair(withRoom(DEFAULT_CONFIG, { width: 4, depth: 5 }), { shape }));
      const [f1, f2] = layout.flights;
      const L = layout.landings[0];
      expect(f1.topY).toBeCloseTo(L.topY, 9);
      expect(f2.baseY).toBeCloseTo(L.topY, 9);
      // flight 1 ends on the landing edge
      const end = { x: f1.start.x + f1.dir.x * f1.run, z: f1.start.z + f1.dir.z * f1.run };
      const onEdge =
        Math.abs(end.x - L.rect.minX) < 1e-6 || Math.abs(end.x - L.rect.maxX) < 1e-6 || Math.abs(end.z - L.rect.minZ) < 1e-6 || Math.abs(end.z - L.rect.maxZ) < 1e-6;
      expect(onEdge).toBe(true);
      // flight 2 starts on the landing edge
      const s = f2.start;
      const onEdge2 =
        Math.abs(s.x - L.rect.minX) < 1e-6 || Math.abs(s.x - L.rect.maxX) < 1e-6 || Math.abs(s.z - L.rect.minZ) < 1e-6 || Math.abs(s.z - L.rect.maxZ) < 1e-6;
      expect(onEdge2).toBe(true);
      // L turns 90°, U turns 180°
      const dotDir = f1.dir.x * f2.dir.x + f1.dir.z * f2.dir.z;
      expect(dotDir).toBeCloseTo(shape === 'L' ? 0 : -1, 9);
    }
  });

  it('left and right turns mirror the second flight', () => {
    const r = solve(withStair(DEFAULT_CONFIG, { turn: 'right' })).layout;
    const l = solve(withStair(DEFAULT_CONFIG, { turn: 'left' })).layout;
    const rr = r.flights[1].start.x - r.flights[0].start.x;
    const ll = l.flights[1].start.x - l.flights[0].start.x;
    expect(Math.sign(rr)).toBe(-Math.sign(ll));
  });

  it('entry direction rotates the staircase in the room', () => {
    const c = withRoom(DEFAULT_CONFIG, { width: 3.9, depth: 2.4 });
    const { layout, analysis } = solve(withStair(c, { placement: { ...c.stair.placement, entry: 'left', alignX: 'start', alignZ: 'center' } }));
    expect(layout.flights[0].dir.x).toBeCloseTo(-1);
    expect(analysis.footprintSize.x).toBeGreaterThan(analysis.footprintSize.z);
  });
});

describe('fit validation', () => {
  it('Test C: reducing depth produces a geometric conflict', () => {
    let lastOk = true;
    for (let d = 3.9; d >= 2.6; d -= 0.1) {
      const { analysis } = solve(withRoom(DEFAULT_CONFIG, { depth: d }));
      lastOk = analysis.fitsRoom;
      if (!lastOk) {
        expect(analysis.status).toBe('fail');
        expect(analysis.issues.some((i) => i.code === 'fit' && i.message.includes('nie mieszczą'))).toBe(true);
        expect(analysis.overflow.back + analysis.overflow.front).toBeGreaterThan(0);
        expect(analysis.suggestions.length).toBeGreaterThan(0);
        break;
      }
    }
    expect(lastOk).toBe(false);
  });

  it('steep stairs are flagged', () => {
    const { analysis } = solve(withStair(DEFAULT_CONFIG, { riserCountMode: 'manual', riserCount: 16 }));
    expect(analysis.riserHeight).toBeGreaterThan(0.2);
    expect(analysis.issues.some((i) => i.code === 'riser-high')).toBe(true);
  });

  it('short manual opening breaks headroom', () => {
    const c = withStair(DEFAULT_CONFIG, { shape: 'I', opening: { mode: 'manual', length: 1.2, width: 1.0 } });
    const { analysis } = solve(withRoom(c, { depth: 6 }));
    expect(analysis.headroomOk).toBe(false);
    expect(analysis.issues.some((i) => i.message === 'Niewystarczająca wysokość przejścia.')).toBe(true);
  });

  it('auto opening keeps ≥ 200 cm headroom', () => {
    for (const shape of ['I', 'L', 'U'] as StairShape[]) {
      const { analysis } = solve(withStair(withRoom(DEFAULT_CONFIG, { width: 5, depth: 6 }), { shape }));
      expect(analysis.headroomOk).toBe(true);
    }
  });

  it('railing gap > 12 cm warns', () => {
    const c = { ...DEFAULT_CONFIG, railing: { ...DEFAULT_CONFIG.railing, spacing: 0.16 } };
    expect(solve(c).analysis.issues.some((i) => i.code === 'rail-gap')).toBe(true);
  });
});

describe('auto fit', () => {
  it('finds a feasible I staircase when the room allows it', () => {
    const c = withStair(withRoom(DEFAULT_CONFIG, { width: 2.0, depth: 6.0 }), { shape: 'I' });
    const r = autoFit(c);
    expect(r.ok).toBe(true);
    const { analysis } = solve(r.config!);
    expect(analysis.fitsRoom).toBe(true);
    expect(analysis.blondel).toBeGreaterThanOrEqual(0.6 - 1e-9);
    expect(analysis.blondel).toBeLessThanOrEqual(0.65 + 1e-9);
  });

  it('repairs a U staircase in a tighter room', () => {
    const c = withRoom(DEFAULT_CONFIG, { depth: 3.5 });
    expect(solve(c).analysis.fitsRoom).toBe(false);
    const r = autoFit(c);
    expect(r.ok).toBe(true);
    expect(solve(r.config!).analysis.fitsRoom).toBe(true);
  });

  it('reports infeasibility instead of generating unrealistic geometry', () => {
    const c = withRoom(DEFAULT_CONFIG, { width: 1.5, depth: 2.0 });
    const r = autoFit(c);
    expect(r.ok).toBe(false);
    expect(r.config).toBeUndefined();
    expect(r.message).toContain('Brak wykonalnej geometrii');
  });

  it('suggests other shapes when current shape cannot fit', () => {
    const r = autoFit(withStair(DEFAULT_CONFIG, { shape: 'I' }));
    expect(r.ok).toBe(false);
    expect(r.alternatives.length).toBeGreaterThan(0);
  });
});

describe('presets', () => {
  it('presets change style only, not geometry', () => {
    for (const p of PRESETS) {
      const c = applyPreset(cloneConfig(DEFAULT_CONFIG), p.id);
      expect(c.room).toEqual(DEFAULT_CONFIG.room);
      expect(c.stair).toEqual(DEFAULT_CONFIG.stair);
      expect(c.structure.type).toBe(p.structure);
    }
  });
});
