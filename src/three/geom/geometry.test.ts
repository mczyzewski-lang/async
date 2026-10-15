import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../engine/defaults';
import { solve } from '../../engine/solve';
import type { Config, RailingType, StructureType } from '../../engine/types';
import { buildRailings } from './railing';
import { buildStair } from './stair';

const build = (c: Config) => {
  const { layout } = solve(c);
  return buildStair({ layout, room: c.room, structure: c.structure, treads: c.treads, treadThickness: c.stair.treadThickness, nosing: c.stair.nosing });
};
const withStructure = (t: StructureType, extra: Partial<Config['structure']> = {}): Config => ({ ...DEFAULT_CONFIG, structure: { ...DEFAULT_CONFIG.structure, type: t, ...extra } });

import type * as THREE from 'three';
const vertexCount = (g: Partial<Record<string, THREE.BufferGeometry>>, k: string) => g[k]?.getAttribute('position').count ?? 0;

describe('steel structures', () => {
  it('Test D: mono stringer vs double side stringers produce different steel geometry', () => {
    const a = build(withStructure('A'));
    const b = build(withStructure('B'));
    expect(a.counts.stringer).toBe(2); // one per flight
    expect(b.counts.stringer).toBe(4); // two per flight
    expect(a.counts.bracket).toBe(18);
    expect(b.counts.bracket ?? 0).toBe(0);
    expect(vertexCount(a.geometries, 'steel')).not.toBe(vertexCount(b.geometries, 'steel'));
  });

  it('all five structures build distinct geometry with treads', () => {
    const counts = new Set<number>();
    for (const t of ['A', 'B', 'C', 'D', 'E'] as StructureType[]) {
      const g = build(withStructure(t));
      expect(g.counts.tread).toBe(18);
      expect(g.geometries.steel).toBeTruthy();
      expect(g.geometries.wood).toBeTruthy();
      counts.add(vertexCount(g.geometries, 'steel'));
    }
    expect(counts.size).toBe(5);
  });

  it('Test H: landing is supported (posts reach the floor) for every structure', () => {
    for (const t of ['A', 'B', 'C', 'D', 'E'] as StructureType[]) {
      const g = build(withStructure(t, { landingSupport: 'posts4' }));
      expect(g.counts.landing).toBe(1);
      expect(g.counts.post).toBeGreaterThanOrEqual(2);
      const pos = g.geometries.steel!.attributes.position;
      let minY = Infinity;
      for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
      expect(minY).toBeCloseTo(0, 3);
    }
  });

  it('self-supporting landing has no posts and continuous beams for every structure', () => {
    for (const t of ['A', 'B', 'C', 'D', 'E'] as StructureType[]) {
      const g = build(withStructure(t, { landingSupport: 'cantilever' }));
      expect(g.counts.landing).toBe(1);
      if (t !== 'E') expect(g.counts.post ?? 0).toBe(0); // E keeps only its mid-span flight posts
      expect(g.counts.cantileverBeam).toBeGreaterThanOrEqual(2);
    }
  });

  it('integrated support uses two posts, independent uses four', () => {
    expect(build(withStructure('B', { landingSupport: 'posts4' })).counts.post).toBe(4);
    expect(build(withStructure('B', { landingSupport: 'posts2' })).counts.post).toBe(2);
  });

  it('closed risers add riser boards where supported', () => {
    const open = build(withStructure('B', { risers: 'open' }));
    const closed = build(withStructure('B', { risers: 'closed' }));
    expect(open.counts.riser ?? 0).toBe(0);
    expect(closed.counts.riser).toBeGreaterThan(0);
  });
});

describe('railings', () => {
  const rails = (t: RailingType, c: Config = DEFAULT_CONFIG) => {
    const { runs } = solve(c);
    return { runs, ...buildRailings(runs, { ...c.railing, type: t }) };
  };

  it('Test E: vertical bars vs perforated panels produce different geometry on flights and landing', () => {
    const a = rails('A');
    const d = rails('D');
    expect(a.counts.infill).toBeGreaterThan(20);
    expect(a.geometries.railPerf).toBeUndefined();
    expect(d.geometries.railPerf).toBeTruthy();
    expect(d.counts.panel).toBeGreaterThanOrEqual(6);
  });

  it('outer railing follows flight 1 → landing → flight 2 continuously', () => {
    const { runs } = solve(DEFAULT_CONFIG);
    const outer = runs.find((r) => r.side === 'outer')!;
    expect(outer.points.length).toBe(6);
    expect(outer.sloped).toEqual([true, false, false, false, true]);
    expect(outer.points[1].y).toBeCloseTo(1.75);
    expect(outer.points[5].y).toBeCloseTo(3.5);
  });

  it('all six railing types build', () => {
    for (const t of ['A', 'B', 'C', 'D', 'E', 'F'] as RailingType[]) {
      const r = rails(t);
      expect(Object.keys(r.geometries).length).toBeGreaterThan(0);
    }
  });

  it('wall handrail mode creates wall runs', () => {
    const c: Config = { ...DEFAULT_CONFIG, railing: { ...DEFAULT_CONFIG.railing, outer: 'wall' } };
    const { runs } = solve(c);
    expect(runs.filter((r) => r.kind === 'wall').length).toBe(2);
  });
});
