import type { FC } from 'react';
import type { Timeline } from '../engine/timeline';

export interface FilmModule {
  /** Rendered inside the R3F <Canvas>. Must be a pure function of tl.now(). */
  Film: FC<{ tl: Timeline }>;
  /** DOM layer above the canvas (titles, labels, counters). */
  Overlay: FC<{ tl: Timeline }>;
  background: string;
  shadows?: boolean;
  /** three.js tone mapping off for flat graphic styles */
  flat?: boolean;
}
