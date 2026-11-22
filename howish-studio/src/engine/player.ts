import { create } from 'zustand';
import { currentEpisode } from '../episodes';
import { buildTiming, cueOffsets, fromCommon, narrationText, sceneAt, toCommon } from './timing';
import type { Timing, VariantId, VoiceoverManifest } from './types';

export const VARIANTS: VariantId[] = ['A', 'B', 'C', 'D'];
const ep = currentEpisode;

/** Mutable clock — read every frame by films, never through React state. */
export const clock = { time: 0 };

export interface ServerStatus {
  online: boolean;
  hasKey: boolean;
  hasVoice: boolean;
  voiceId: string;
  modelId: string;
  speed: number;
  ffmpeg: boolean;
}

interface PlayerState {
  /** Variant whose timeline `clock.time` is expressed in (and whose narration plays). */
  master: VariantId;
  compare: boolean;
  syncCompare: boolean;
  playing: boolean;
  rate: number;
  subs: boolean;
  sceneId: string;
  manifests: Partial<Record<VariantId, VoiceoverManifest | null>>;
  timings: Record<VariantId, Timing>;
  status: ServerStatus;
  /** false until the first server/voiceover check has finished */
  checked: boolean;
  generating: VariantId | null;
  voiceError: string | null;
  setMaster: (v: VariantId) => void;
  setCompare: (on: boolean) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  restart: () => void;
  setRate: (r: number) => void;
  set: (p: Partial<PlayerState>) => void;
  refresh: () => Promise<void>;
  generate: (v: VariantId, opts?: { voiceId?: string; speed?: number; force?: boolean }) => Promise<void>;
}

const audio: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null;
if (audio) audio.preload = 'auto';

const initialTimings = () => Object.fromEntries(VARIANTS.map((v) => [v, buildTiming(ep.variants[v], null)])) as Record<VariantId, Timing>;

function loadAudioFor(v: VariantId, manifests: PlayerState['manifests'], timing: Timing) {
  if (!audio) return;
  const m = manifests[v];
  const src = m && timing.source === 'audio' ? m.audioPath : '';
  if (src) {
    if (!audio.src.endsWith(src)) audio.src = src;
  } else if (audio.getAttribute('src')) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}
const audioReady = () => !!audio && !!audio.getAttribute('src');

export const usePlayer = create<PlayerState>((set, get) => ({
  master: 'A',
  compare: false,
  syncCompare: true,
  playing: false,
  rate: 1,
  subs: true,
  sceneId: ep.variants.A.scenes[0].id,
  manifests: {},
  timings: initialTimings(),
  status: { online: false, hasKey: false, hasVoice: false, voiceId: '', modelId: '', speed: 1, ffmpeg: false },
  checked: false,
  generating: null,
  voiceError: null,
  set: (p) => set(p),
  setMaster: (v) => {
    const s = get();
    if (v === s.master) return;
    // keep the same logical point of the story when switching variant
    clock.time = fromCommon(toCommon(clock.time, s.timings[s.master]), s.timings[v]);
    set({ master: v, sceneId: sceneAt(clock.time, s.timings[v]) });
    loadAudioFor(v, s.manifests, s.timings[v]);
    if (audioReady()) {
      audio!.currentTime = clock.time;
      audio!.playbackRate = s.rate;
      if (s.playing) void audio!.play().catch(() => {});
    }
  },
  setCompare: (on) => set({ compare: on }),
  play: () => {
    const s = get();
    if (clock.time >= s.timings[s.master].duration - 0.05) get().seek(0);
    set({ playing: true });
    if (audioReady()) {
      audio!.playbackRate = s.rate;
      audio!.currentTime = Math.min(clock.time, audio!.duration || clock.time);
      void audio!.play().catch(() => {});
    }
  },
  pause: () => {
    set({ playing: false });
    audio?.pause();
  },
  toggle: () => (get().playing ? get().pause() : get().play()),
  seek: (t) => {
    const s = get();
    const d = s.timings[s.master].duration;
    clock.time = Math.min(d, Math.max(0, t));
    if (audioReady()) audio!.currentTime = Math.min(clock.time, (audio!.duration || d) - 0.01);
    const id = sceneAt(clock.time, s.timings[s.master]);
    if (id !== s.sceneId) set({ sceneId: id });
  },
  restart: () => {
    get().seek(0);
    get().play();
  },
  setRate: (r) => {
    set({ rate: r });
    if (audio) audio.playbackRate = r;
  },
  refresh: async () => {
    let status: ServerStatus = { ...get().status, online: false };
    const manifests: PlayerState['manifests'] = {};
    try {
      const r = await fetch('/api/status');
      if (r.ok && r.headers.get('content-type')?.includes('json')) status = { ...(await r.json()), online: true };
      if (status.online)
        await Promise.all(
          VARIANTS.map(async (v) => {
            const j = await (await fetch(`/api/voiceover?episode=${ep.id}&variant=${v}`)).json();
            manifests[v] = j.manifest;
          }),
        );
    } catch {
      /* static hosting: run silent with estimated timing */
    }
    const timings = Object.fromEntries(VARIANTS.map((v) => [v, buildTiming(ep.variants[v], manifests[v])])) as Record<VariantId, Timing>;
    const s = get();
    const u = toCommon(clock.time, s.timings[s.master]);
    clock.time = fromCommon(u, timings[s.master]);
    set({ status, manifests, timings, checked: true });
    loadAudioFor(s.master, manifests, timings[s.master]);
  },
  generate: async (v, opts) => {
    set({ generating: v, voiceError: null });
    try {
      const variant = ep.variants[v];
      const r = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: ep.id, variantId: v, text: narrationText(variant), cues: cueOffsets(variant), voiceId: opts?.voiceId || variant.voiceId, speed: opts?.speed, force: opts?.force }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      get().pause();
      await get().refresh();
    } catch (e) {
      set({ voiceError: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ generating: null });
    }
  },
}));

/** Time on variant `v`'s own timeline for the current master time. */
export function timeFor(v: VariantId): number {
  const s = usePlayer.getState();
  if (v === s.master) return clock.time;
  if (!s.syncCompare) return Math.min(clock.time, s.timings[v].duration);
  return fromCommon(toCommon(clock.time, s.timings[s.master]), s.timings[v]);
}

/** Advance the master clock. Audio, when present, IS the clock. */
let last = 0;
export function tick(nowMs: number) {
  const s = usePlayer.getState();
  const dt = last ? Math.min(0.5, (nowMs - last) / 1000) : 0;
  last = nowMs;
  if (!s.playing) return;
  const timing = s.timings[s.master];
  const useAudio = audioReady() && !audio!.paused && !audio!.ended && audio!.readyState >= 2;
  if (useAudio) clock.time = audio!.currentTime;
  else clock.time += dt * s.rate;
  if (clock.time >= timing.duration) {
    clock.time = timing.duration;
    s.pause();
  }
  const id = sceneAt(clock.time, timing);
  if (id !== s.sceneId) usePlayer.setState({ sceneId: id });
}
