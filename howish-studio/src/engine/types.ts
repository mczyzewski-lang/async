/** Core production data model. Nothing in here is specific to one topic. */

export type BeatId = 'hook' | 'mystery' | 'how' | 'aha' | 'reveal';
export const BEATS: { id: BeatId; label: string }[] = [
  { id: 'hook', label: 'Hook' },
  { id: 'mystery', label: 'The Mystery' },
  { id: 'how', label: 'How It Works' },
  { id: 'aha', label: 'The Aha Moment' },
  { id: 'reveal', label: 'Final Reveal' },
];

export type VariantId = 'A' | 'B' | 'C' | 'D';

export interface ScientificSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  supports: string;
}

export interface Fact {
  id: string;
  statement: string;
  sources: string[];
}

export interface Simplification {
  id: string;
  note: string;
}

/** One spoken sentence (or short group). The atomic unit of synchronisation. */
export interface Cue {
  id: string;
  text: string;
  /** Extra silence after this cue when no audio timing is available (seconds). */
  hold?: number;
}

export interface SceneDef {
  id: string;
  title: string;
  beat: BeatId;
  cues: Cue[];
  /** Storyboard metadata: what is on screen and where it should end up. */
  objects: string[];
  camera: string;
  onScreenText: string[];
  targetState: string;
  simplification?: string;
}

export interface VisualStyle {
  id: VariantId;
  key: 'cinematic' | 'minimal' | 'playful' | 'xray';
  name: string;
  tagline: string;
  narrationTone: string;
  /** Used by the lab UI for tab accents. */
  accent: string;
  /** Subtitle skin class. */
  subtitleClass: string;
}

export interface Episode {
  id: string;
  title: string;
  topic: string;
  language: string;
  hookLine: string;
  facts: Fact[];
  simplifications: Simplification[];
  scientificSources: ScientificSource[];
  variants: Record<VariantId, EpisodeVariant>;
}

export interface EpisodeVariant {
  id: VariantId;
  visualStyle: VisualStyle;
  scenes: SceneDef[];
  /** Optional voice override; otherwise ELEVENLABS_VOICE_ID from the server env. */
  voiceId?: string;
  assets: string[];
}

export interface Span {
  start: number;
  end: number;
}

/** Resolved timing for one variant: estimated from text, or measured from audio. */
export interface Timing {
  source: 'estimate' | 'audio';
  duration: number;
  scenes: Record<string, Span>;
  cues: Record<string, Span>;
  beats: Record<BeatId, Span>;
  sceneOrder: string[];
}

/** Saved next to the generated mp3 (public/audio/<episode>/<variant>.json). */
export interface VoiceoverManifest {
  episodeId: string;
  variantId: VariantId;
  text: string;
  audioPath: string;
  voiceId: string;
  modelId: string;
  speed: number;
  duration: number;
  cues: Record<string, Span>;
  createdAt: string;
}

export interface SubtitleLine extends Span {
  text: string;
}
