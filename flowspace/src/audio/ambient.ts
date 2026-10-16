import type { EnvironmentDef } from '@/three/world/environments';

/**
 * Procedural ambience generated with WebAudio (no audio files, no licensing concerns):
 * filtered noise for wind / waves, sparse synthesized bird calls, and a soft singing-bowl
 * chime for transitions. Audio starts only after a user gesture (mobile autoplay rules).
 */
class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private timers: number[] = [];
  private kind: EnvironmentDef['ambience'] | null = null;
  private stopTimer = 0;

  private ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Call from a user gesture. */
  async unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  }

  private noiseBuffer(ctx: AudioContext, seconds = 4) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < d.length; i++) {
      // pinkish noise
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    }
    return buf;
  }

  private stopNodes() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    for (const n of this.nodes) {
      try {
        (n as AudioScheduledSourceNode).stop?.();
      } catch {
        /* already stopped */
      }
      n.disconnect();
    }
    this.nodes = [];
  }

  start(kind: EnvironmentDef['ambience'], volume: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = 0;
    }
    if (this.kind === kind && this.nodes.length) {
      this.setVolume(volume);
      return;
    }
    this.stopNodes();
    this.kind = kind;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'ocean' ? 520 : kind === 'mountain' ? 900 : 650;
    filter.Q.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.value = kind === 'ocean' ? 0.55 : 0.32;
    // slow swell (waves / gusts)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = kind === 'ocean' ? 0.085 : 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = kind === 'ocean' ? 0.35 : 0.14;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    lfo.start();
    this.nodes.push(src, filter, gain, lfo, lfoGain);
    if (kind !== 'ocean') this.scheduleBirds();
    this.setVolume(volume);
  }

  private scheduleBirds() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const chirp = () => {
      if (!this.ctx || !this.master) return;
      const t0 = ctx.currentTime + 0.05;
      const notes = 2 + Math.floor(Math.random() * 4);
      const base = 2200 + Math.random() * 1600;
      for (let i = 0; i < notes; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        const st = t0 + i * (0.09 + Math.random() * 0.05);
        o.frequency.setValueAtTime(base * (1 + Math.random() * 0.15), st);
        o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), st + 0.07);
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.025, st + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1);
        const pan = ctx.createStereoPanner?.();
        if (pan) {
          pan.pan.value = Math.random() * 1.6 - 0.8;
          o.connect(g).connect(pan).connect(this.master);
        } else o.connect(g).connect(this.master);
        o.start(st);
        o.stop(st + 0.12);
      }
      this.timers.push(window.setTimeout(chirp, 4000 + Math.random() * 9000));
    };
    this.timers.push(window.setTimeout(chirp, 2500));
  }

  setVolume(v: number) {
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(v * 0.6, this.ctx.currentTime + 1.5);
  }

  /** Gentle singing-bowl style chime for transitions (no aggressive beeps). */
  chime(strength = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + 0.02;
    const f = 432 * 0.5;
    [1, 2.71, 5.1].forEach((mult, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime((0.06 / (i + 1)) * strength, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.5 - i);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 5);
    });
  }

  stop() {
    if (!this.ctx || !this.master) return;
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
    this.stopTimer = window.setTimeout(() => {
      this.stopTimer = 0;
      this.stopNodes();
      this.kind = null;
    }, 900);
  }
}

export const ambient = new AmbientEngine();
