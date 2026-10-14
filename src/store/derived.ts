import { getAnalysis, getLayout, getRuns } from '../engine/solve';
import { useStore } from './useStore';

export function useLayout() {
  const room = useStore((s) => s.config.room);
  const stair = useStore((s) => s.config.stair);
  return getLayout(room, stair);
}

export function useRuns() {
  const layout = useLayout();
  const room = useStore((s) => s.config.room);
  const outer = useStore((s) => s.config.railing.outer);
  const inner = useStore((s) => s.config.railing.inner);
  const landing = useStore((s) => s.config.railing.landing);
  const guard = useStore((s) => s.config.railing.openingGuard);
  return getRuns(layout, room, outer, inner, landing, guard);
}

export function useAnalysis() {
  const layout = useLayout();
  const config = useStore((s) => s.config);
  return getAnalysis(layout, config);
}
