import { ambient } from './ambient';

/**
 * Calm background music for practice.
 *
 * Two sources:
 * 1. Pre-generated loops listed in `public/audio/music/manifest.json` (e.g. produced with
 *    scripts/generate-music.ts via the ElevenLabs Music API). They are looped seamlessly by
 *    overlapping the end of each pass with the start of the next one (equal-power crossfade).
 * 2. A generative fallback synthesised live with WebAudio: slow pad chords with soft
 *    pentatonic bell notes and a small generated reverb — always available, no files needed.
 */

export interface MusicTrack {
  id: string;
  title: string;
  file: string;
  /** Seconds of overlap used when looping. */
  crossfade?: number;
}

export const GENERATIVE_ID = 'generative';

let manifest: Promise<MusicTrack[]> | null = null;

export function loadMusicManifest(): Promise<MusicTrack[]> {
  if (!manifest) {
    manifest = fetch(`${import.meta.env.BASE_URL}audio/music/manifest.json`)
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((m: { tracks?: MusicTrack[] }) => (Array.isArray(m.tracks) ? m.tracks : []))
      .catch(() => []);
  }
  return manifest;
}

// D major pentatonic colour; chords as semitone offsets from D3.
const ROOT = 146.83;
const CHORDS = [
  [0, 7, 14, 16, 21], // Dadd9
  [-3, 4, 9, 12, 16], // Bm7
  [-7, 0, 7, 11, 14], // Gmaj7
  [-5, 2, 9, 14, 16], // Aadd9 / sus colour
];
const BELL = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const hz = (semi: number) => ROOT * Math.pow(2, semi / 12);

class MusicEngine {
  private out: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private stopFns: Array<() => void> = [];
  private timers: number[] = [];
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private current: string | null = null;
  private stopTimer = 0;

  private setup() {
    const ctx = ambient.context();
    if (!ctx) return null;
    if (!this.out) {
      this.out = ctx.createGain();
      this.out.gain.value = 0;
      this.duckGain = ctx.createGain();
      this.out.connect(this.duckGain).connect(ctx.destination);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(ctx, 3.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.55;
      this.reverb.connect(wet).connect(this.out);
    }
    return ctx;
  }

  private impulse(ctx: AudioContext, seconds: number) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  /** Starts (or switches to) a track; `auto` picks the first file track, else the generative one. */
  async start(trackId: string, volume: number) {
    const ctx = this.setup();
    if (!ctx || !this.out) return;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = 0;
    }
    const tracks = await loadMusicManifest();
    const track = trackId === GENERATIVE_ID ? null : (tracks.find((t) => t.id === trackId) ?? (trackId === 'auto' ? tracks[0] : null) ?? null);
    const id = track?.id ?? GENERATIVE_ID;
    if (this.current === id && this.stopFns.length) {
      this.setVolume(volume);
      return;
    }
    this.stopSources();
    this.current = id;
    let ok = false;
    if (track) ok = await this.playFile(ctx, track);
    if (this.current !== id) return; // switched/stopped while loading
    if (!ok) {
      this.current = GENERATIVE_ID;
      this.playGenerative(ctx);
    }
    this.setVolume(volume);
  }

  private loadBuffer(ctx: AudioContext, file: string) {
    let p = this.buffers.get(file);
    if (!p) {
      p = fetch(`${import.meta.env.BASE_URL}audio/music/${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.buffers.set(file, p);
    }
    return p;
  }

  private async playFile(ctx: AudioContext, track: MusicTrack) {
    const buf = await this.loadBuffer(ctx, track.file);
    if (!buf || !this.out) return false;
    const xf = Math.min(track.crossfade ?? 6, buf.duration / 4);
    const period = buf.duration - xf;
    let next = ctx.currentTime + 0.05;
    let alive = true;
    const sources = new Set<AudioBufferSourceNode>();
    const schedule = () => {
      if (!alive || !this.out) return;
      // Keep two passes scheduled ahead; each pass fades in/out over the overlap (equal power).
      while (next < ctx.currentTime + period + 1) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        const t = next;
        const curveIn = new Float32Array(32).map((_, i) => Math.sin((i / 31) * Math.PI * 0.5));
        const curveOut = new Float32Array(32).map((_, i) => Math.cos((i / 31) * Math.PI * 0.5));
        g.gain.setValueAtTime(0, t);
        g.gain.setValueCurveAtTime(curveIn, t, xf);
        g.gain.setValueCurveAtTime(curveOut, t + period, xf);
        src.connect(g).connect(this.out);
        src.start(t);
        src.stop(t + buf.duration + 0.05);
        sources.add(src);
        src.onended = () => {
          sources.delete(src);
          g.disconnect();
        };
        next += period;
      }
      this.timers.push(window.setTimeout(schedule, Math.max(1000, (period / 2) * 1000)));
    };
    schedule();
    this.stopFns.push(() => {
      alive = false;
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* not started */
        }
      });
    });
    return true;
  }

  private playGenerative(ctx: AudioContext) {
    if (!this.out || !this.reverb) return;
    const out = this.out;
    const reverb = this.reverb;
    const padBus = ctx.createBiquadFilter();
    padBus.type = 'lowpass';
    padBus.frequency.value = 900;
    padBus.Q.value = 0.3;
    const padGain = ctx.createGain();
    padGain.gain.value = 1.1;
    padBus.connect(padGain);
    padGain.connect(out);
    padGain.connect(reverb);
    // A very slow filter sweep keeps the pad breathing.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.03;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 260;
    lfo.connect(lfoG).connect(padBus.frequency);
    lfo.start();
    let alive = true;
    const chordLen = 13;
    let ci = 0;
    let t = ctx.currentTime + 0.1;
    const voices = new Set<OscillatorNode>();

    const chord = () => {
      if (!alive) return;
      // Schedule a little ahead so timers can be lazy on mobile.
      while (t < ctx.currentTime + chordLen * 1.5) {
        const notes = CHORDS[ci % CHORDS.length];
        notes.forEach((semi, k) => {
          for (const det of [-5, 5]) {
            const o = ctx.createOscillator();
            o.type = k === 0 ? 'sine' : 'triangle';
            o.frequency.value = hz(semi - (k === 0 ? 12 : 0));
            o.detune.value = det + (Math.random() - 0.5) * 4;
            const g = ctx.createGain();
            const peak = (k === 0 ? 0.05 : 0.026) / 2;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(peak, t + 4.5);
            g.gain.setValueAtTime(peak, t + chordLen - 1);
            g.gain.linearRampToValueAtTime(0, t + chordLen + 4);
            o.connect(g).connect(padBus);
            o.start(t);
            o.stop(t + chordLen + 4.2);
            voices.add(o);
            o.onended = () => {
              voices.delete(o);
              g.disconnect();
            };
          }
        });
        t += chordLen;
        ci++;
      }
      this.timers.push(window.setTimeout(chord, 4000));
    };

    const bell = () => {
      if (!alive) return;
      const st = ctx.currentTime + 0.05;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const semi = BELL[Math.floor(Math.random() * BELL.length)] + 12;
        const at = st + i * (0.45 + Math.random() * 0.5);
        [1, 2.0, 3.01].forEach((m, h) => {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = hz(semi) * m;
          const g = ctx.createGain();
          const peak = 0.03 / (h * 2.5 + 1);
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(peak, at + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 3.2 - h);
          const pan = ctx.createStereoPanner?.();
          if (pan) {
            pan.pan.value = (Math.random() - 0.5) * 0.9;
            o.connect(g).connect(pan).connect(reverb);
            pan.connect(out);
          } else {
            o.connect(g).connect(reverb);
            g.connect(out);
          }
          o.start(at);
          o.stop(at + 3.4);
          voices.add(o);
          o.onended = () => voices.delete(o);
        });
      }
      this.timers.push(window.setTimeout(bell, 3500 + Math.random() * 6500));
    };

    chord();
    this.timers.push(window.setTimeout(bell, 2500));
    this.stopFns.push(() => {
      alive = false;
      voices.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* not started */
        }
      });
      lfo.stop();
      padGain.disconnect();
    });
  }

  setVolume(v: number) {
    const ctx = ambient.context();
    if (!ctx || !this.out) return;
    this.out.gain.cancelScheduledValues(ctx.currentTime);
    this.out.gain.setValueAtTime(this.out.gain.value, ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(v * 1.5, ctx.currentTime + 2.5);
  }

  /** Lowers the music while the instructor speaks. */
  duck(seconds: number) {
    const ctx = ambient.context();
    if (!ctx || !this.duckGain) return;
    const g = this.duckGain.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.45, now + 0.4);
    g.setValueAtTime(0.45, now + seconds);
    g.linearRampToValueAtTime(1, now + seconds + 1.5);
  }

  private stopSources() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.stopFns.forEach((f) => f());
    this.stopFns = [];
  }

  stop(fade = 2) {
    const ctx = ambient.context();
    if (!ctx || !this.out) return;
    this.out.gain.cancelScheduledValues(ctx.currentTime);
    this.out.gain.setValueAtTime(this.out.gain.value, ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => {
      this.stopTimer = 0;
      this.stopSources();
      this.current = null;
    }, fade * 1000 + 100);
  }

  isPlaying() {
    return this.current !== null;
  }
}

export const music = new MusicEngine();
