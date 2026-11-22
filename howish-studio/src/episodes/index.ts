import { flightEpisode } from './flight';
import type { Episode } from '../engine/types';

/** Register new episodes here; the lab picks one with ?episode=<id>. */
export const episodes: Record<string, Episode> = { [flightEpisode.id]: flightEpisode };
export const currentEpisode: Episode = episodes[new URLSearchParams(globalThis.location?.search ?? '').get('episode') ?? ''] ?? flightEpisode;
