import { describe, expect, it } from 'vitest';
import { computeDimensions } from '../engine/dimensions';
import { getAnalysis, getLayout } from '../engine/solve';
import { useStore } from './useStore';

describe('store & views', () => {
  it('Test F: changing wood keeps geometry inputs identical (no rebuild)', () => {
    const s0 = useStore.getState();
    const layout0 = getLayout(s0.config.room, s0.config.stair);
    const structure0 = s0.config.structure;
    const railing0 = s0.config.railing;
    s0.setTreads({ wood: 'walnut' });
    const s1 = useStore.getState();
    expect(s1.config.treads.wood).toBe('walnut');
    expect(s1.config.room).toBe(s0.config.room);
    expect(s1.config.stair).toBe(s0.config.stair);
    expect(s1.config.structure).toBe(structure0);
    expect(s1.config.railing).toBe(railing0);
    expect(getLayout(s1.config.room, s1.config.stair)).toBe(layout0);
  });

  it('Test G: top view has plan dimensions (room, footprint, flights, clearances)', () => {
    const { config } = useStore.getState();
    const layout = getLayout(config.room, config.stair);
    const dims = computeDimensions('top', layout, getAnalysis(layout, config), config);
    const ids = dims.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['room-w', 'room-d', 'fp-x', 'fp-z', 'fw-0', 'fw-1', 'run-0', 'run-1', 'landing-d', 'gap']));
    // plan dimensions lie in a horizontal plane
    for (const d of dims) expect(d.a.y).toBeCloseTo(d.b.y, 6);
    const side = computeDimensions('side', layout, getAnalysis(layout, config), config);
    expect(side.find((d) => d.id === 'h')!.b.y).toBeCloseTo(config.room.height);
  });

  it('presets and reset', () => {
    const s = useStore.getState();
    s.applyPreset('industrial-loft');
    expect(useStore.getState().config.structure.type).toBe('E');
    expect(useStore.getState().config.railing.type).toBe('E');
    useStore.getState().setConfig({ ...useStore.getState().config, stair: { ...useStore.getState().config.stair, shape: 'I' } });
    expect(useStore.getState().config.stair.shape).toBe('I');
  });
});
