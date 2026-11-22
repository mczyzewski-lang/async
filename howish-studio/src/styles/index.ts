import type { VariantId } from '../engine/types';
import type { FilmModule } from './types';
import cinematic from './cinematic';
import minimal from './minimal';
import playful from './playful';
import xray from './xray';

/** Visual styles are plug-ins: same episode data, different film components. */
export const films: Record<VariantId, FilmModule> = { A: cinematic, B: minimal, C: playful, D: xray };
