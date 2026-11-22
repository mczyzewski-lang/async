import { BEATS, type BeatId, type EpisodeVariant, type Span, type SubtitleLine, type Timing, type VoiceoverManifest } from './types';

const WORDS_PER_SECOND = 2.55;
const CUE_GAP = 0.38;
const LEAD_IN = 0.5;
const TAIL = 2.8;

export function narrationText(variant: EpisodeVariant): string {
  return variant.scenes.flatMap((s) => s.cues.map((c) => c.text)).join(' ');
}

/** Character offsets of each cue inside narrationText(variant). */
export function cueOffsets(variant: EpisodeVariant): { id: string; from: number; to: number }[] {
  const out: { id: string; from: number; to: number }[] = [];
  let pos = 0;
  for (const s of variant.scenes)
    for (const c of s.cues) {
      out.push({ id: c.id, from: pos, to: pos + c.text.length });
      pos += c.text.length + 1;
    }
  return out;
}

function estimateCues(variant: EpisodeVariant): { cues: Record<string, Span>; end: number } {
  const cues: Record<string, Span> = {};
  let t = LEAD_IN;
  for (const s of variant.scenes)
    for (const c of s.cues) {
      const words = c.text.split(/\s+/).length;
      const d = Math.max(0.9, words / WORDS_PER_SECOND);
      cues[c.id] = { start: t, end: t + d };
      t += d + CUE_GAP + (c.hold ?? 0);
    }
  return { cues, end: t };
}

/**
 * Build the timing map every animation reads from. With a voiceover manifest the
 * cue times are the measured ones from the audio alignment; otherwise they are
 * estimated from word counts. Scenes and beats are always derived from cues, so
 * visuals keyed to `timing.cues[...]` stay in sync with whichever source is active.
 */
export function buildTiming(variant: EpisodeVariant, manifest?: VoiceoverManifest | null): Timing {
  let cues: Record<string, Span>;
  let duration: number;
  const usable = manifest && manifest.text === narrationText(variant);
  if (usable) {
    cues = manifest.cues;
    duration = manifest.duration + TAIL;
  } else {
    const est = estimateCues(variant);
    cues = est.cues;
    duration = est.end + TAIL;
  }
  const scenes: Record<string, Span> = {};
  const order = variant.scenes.map((s) => s.id);
  variant.scenes.forEach((s, i) => {
    const first = cues[s.cues[0].id];
    const next = variant.scenes[i + 1];
    const start = i === 0 ? 0 : Math.max(0, first.start - 0.25);
    const end = next ? Math.max(0, cues[next.cues[0].id].start - 0.25) : duration;
    scenes[s.id] = { start, end };
  });
  const beats = {} as Record<BeatId, Span>;
  for (const b of BEATS) {
    const inBeat = variant.scenes.filter((s) => s.beat === b.id);
    if (!inBeat.length) continue;
    beats[b.id] = { start: scenes[inBeat[0].id].start, end: scenes[inBeat[inBeat.length - 1].id].end };
  }
  return { source: usable ? 'audio' : 'estimate', duration, scenes, cues, beats, sceneOrder: order };
}

/** Common normalised axis shared by all variants: each of the five beats gets 1/5. */
export function toCommon(t: number, timing: Timing): number {
  const n = BEATS.length;
  for (let i = 0; i < n; i++) {
    const b = timing.beats[BEATS[i].id];
    if (!b) continue;
    if (t < b.end || i === n - 1) {
      const p = Math.min(1, Math.max(0, (t - b.start) / Math.max(1e-6, b.end - b.start)));
      return (i + p) / n;
    }
  }
  return 1;
}

export function fromCommon(u: number, timing: Timing): number {
  const n = BEATS.length;
  const x = Math.min(0.999999, Math.max(0, u)) * n;
  const i = Math.floor(x);
  const b = timing.beats[BEATS[i].id];
  if (!b) return u * timing.duration;
  return b.start + (x - i) * (b.end - b.start);
}

export function sceneAt(t: number, timing: Timing): string {
  let cur = timing.sceneOrder[0];
  for (const id of timing.sceneOrder) if (t >= timing.scenes[id].start) cur = id;
  return cur;
}

/** Subtitle lines: cues broken into short chunks, time split by character share. */
export function buildSubtitles(variant: EpisodeVariant, timing: Timing, maxChars = 46): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  for (const s of variant.scenes)
    for (const c of s.cues) {
      const span = timing.cues[c.id];
      const words = c.text.split(/\s+/);
      const chunks: string[] = [];
      let cur = '';
      for (const w of words) {
        if (cur && (cur + ' ' + w).length > maxChars) {
          chunks.push(cur);
          cur = w;
        } else cur = cur ? cur + ' ' + w : w;
      }
      if (cur) chunks.push(cur);
      const total = chunks.reduce((a, b) => a + b.length, 0);
      let t = span.start;
      chunks.forEach((text, i) => {
        const d = ((span.end - span.start) * text.length) / total;
        lines.push({ text, start: t, end: i === chunks.length - 1 ? span.end + 0.25 : t + d });
        t += d;
      });
    }
  return lines;
}

export function toSrt(lines: SubtitleLine[]): string {
  const f = (t: number) => {
    const ms = Math.round(t * 1000);
    const p = (n: number, l = 2) => String(n).padStart(l, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  return lines.map((l, i) => `${i + 1}\n${f(l.start)} --> ${f(l.end)}\n${l.text}\n`).join('\n');
}
