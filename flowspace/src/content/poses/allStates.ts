import type { PoseState } from '../types';
import * as states from './states';

/** Every authored state by export name (used by the dev lab and the validation script). */
export const ALL_STATES: Record<string, PoseState> = Object.fromEntries(
  Object.entries(states).filter(([k]) => k.startsWith('S_')),
) as Record<string, PoseState>;
