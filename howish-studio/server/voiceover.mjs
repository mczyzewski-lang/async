// Server-side ElevenLabs client. The API key never leaves this process.
// NOTE: endpoint + field names follow the ElevenLabs "text-to-speech with timestamps" API
// (POST /v1/text-to-speech/{voice_id}/with-timestamps). Re-check against the current docs
// before production use; model id and speed are configurable through .env.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const AUDIO_DIR = path.join(ROOT, 'public', 'audio');

export function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function config() {
  loadEnv();
  const speed = Number(process.env.ELEVENLABS_SPEED || 1);
  return {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '',
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    speed: Number.isFinite(speed) ? Math.min(1.2, Math.max(0.7, speed)) : 1,
  };
}

const safe = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '');

export function manifestPath(episodeId, variantId) {
  return path.join(AUDIO_DIR, safe(episodeId), `${safe(variantId)}.json`);
}

export function readManifest(episodeId, variantId) {
  const p = manifestPath(episodeId, variantId);
  if (!fs.existsSync(p)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    return fs.existsSync(path.join(AUDIO_DIR, safe(episodeId), path.basename(m.audioPath))) ? m : null;
  } catch {
    return null;
  }
}

/** Map cue character ranges onto measured character timestamps. */
export function cuesFromAlignment(text, cues, alignment) {
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const n = starts.length;
  const total = ends[n - 1];
  const exact = n === text.length;
  const idx = (c) => (exact ? c : Math.min(n - 1, Math.round((c / text.length) * n)));
  const out = {};
  for (const c of cues) {
    const a = idx(c.from);
    const b = Math.max(a, idx(c.to - 1));
    out[c.id] = { start: +starts[a].toFixed(3), end: +ends[b].toFixed(3) };
  }
  return { cues: out, duration: +total.toFixed(3) };
}

/**
 * Generate (or reuse) a voiceover. Cached by text + voice + model + speed, so paid
 * synthesis only ever happens on an explicit request with changed inputs.
 */
export async function generateVoiceover({ episodeId, variantId, text, cues, voiceId, speed, force }) {
  const cfg = config();
  if (!cfg.apiKey) throw Object.assign(new Error('ELEVENLABS_API_KEY is not set on the server (.env).'), { status: 400 });
  const voice = voiceId || cfg.voiceId;
  if (!voice) throw Object.assign(new Error('No voice id: set ELEVENLABS_VOICE_ID in .env or pass one.'), { status: 400 });
  const spd = Math.min(1.2, Math.max(0.7, Number(speed) || cfg.speed));
  const existing = readManifest(episodeId, variantId);
  if (!force && existing && existing.text === text && existing.voiceId === voice && existing.modelId === cfg.modelId && existing.speed === spd)
    return { manifest: existing, cached: true };

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': cfg.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: cfg.modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: spd } }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`), { status: 502 });
  }
  const json = await res.json();
  const alignment = json.alignment || json.normalized_alignment;
  if (!json.audio_base64 || !alignment) throw Object.assign(new Error('ElevenLabs response had no audio/alignment.'), { status: 502 });

  const hash = crypto.createHash('sha1').update([text, voice, cfg.modelId, spd].join('|')).digest('hex').slice(0, 10);
  const dir = path.join(AUDIO_DIR, safe(episodeId));
  fs.mkdirSync(dir, { recursive: true });
  const file = `${safe(variantId)}-${hash}.mp3`;
  fs.writeFileSync(path.join(dir, file), Buffer.from(json.audio_base64, 'base64'));
  const timed = cuesFromAlignment(text, cues, alignment);
  const manifest = {
    episodeId, variantId, text,
    audioPath: `/api/audio/${safe(episodeId)}/${file}`,
    voiceId: voice, modelId: cfg.modelId, speed: spd,
    duration: timed.duration, cues: timed.cues,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(manifestPath(episodeId, variantId), JSON.stringify(manifest, null, 2));
  return { manifest, cached: false };
}
