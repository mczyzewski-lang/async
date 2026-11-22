import { describe, expect, it } from 'vitest';
import { buildFlow } from './flow';

describe('joukowski flow', () => {
  const flow = buildFlow({ alphaDeg: 6 });
  it('far field is the undisturbed freestream', () => {
    const v: [number, number] = [0, 0];
    flow.velocity(-40, 10, v);
    expect(v[0]).toBeCloseTo(1, 2);
    expect(v[1]).toBeCloseTo(0, 2);
  });
  it('air is faster / lower pressure above the wing, slower / higher below', () => {
    expect(flow.cp(-0.1, 0.16)).toBeLessThan(-0.3);
    expect(flow.cp(-0.1, -0.12)).toBeGreaterThan(0);
  });
  it('air leaves the wing heading downward (downwash)', () => {
    const v: [number, number] = [0, 0];
    flow.velocity(0.75, -0.02, v);
    expect(v[1]).toBeLessThan(-0.03);
  });
  it('upper parcels do NOT wait for lower ones (no equal transit time)', () => {
    const up = flow.lines.filter((l) => l.side === 1).sort((a, b) => a.y0 - b.y0)[0];
    const lo = flow.lines.filter((l) => l.side === -1).sort((a, b) => b.y0 - a.y0)[0];
    const tAt = (l: typeof up, x: number) => { for (let i = 0; i < l.n; i++) if (l.pts[i * 2] > x) return i; return l.n; };
    expect(tAt(up, 0.8)).toBeLessThan(tAt(lo, 0.8));
  });
});
