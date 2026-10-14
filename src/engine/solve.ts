/**
 * Orchestration: memoised selectors from config -> layout -> railing runs -> analysis.
 * Rendering code consumes these; no geometry math lives in React components.
 */
import { computeLayout } from './layout';
import { memoLast } from './math';
import { computeRailingRuns } from './railingLayout';
import type { Config, RailingConfig, RoomConfig, StairConfig } from './types';
import { computeAnalysis } from './validate';
import type { FullLayout } from './layout';

export const getLayout = memoLast((room: RoomConfig, stair: StairConfig) => computeLayout(room, stair));

export const getRuns = memoLast(
  (layout: FullLayout, room: RoomConfig, outer: RailingConfig['outer'], inner: RailingConfig['inner'], landing: boolean, openingGuard: boolean) =>
    computeRailingRuns(layout, room, { outer, inner, landing, openingGuard } as RailingConfig),
);

export const getAnalysis = memoLast((layout: FullLayout, config: Config) => {
  const runs = getRuns(layout, config.room, config.railing.outer, config.railing.inner, config.railing.landing, config.railing.openingGuard);
  return computeAnalysis(layout, config, runs);
});

/** Full non-memoised solve — used by tests and auto-fit */
export function solve(config: Config) {
  const layout = computeLayout(config.room, config.stair);
  const runs = computeRailingRuns(layout, config.room, config.railing);
  const analysis = computeAnalysis(layout, config, runs);
  return { layout, runs, analysis };
}
