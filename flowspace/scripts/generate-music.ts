/**
 * Generates calm, nature-inspired background loops with the ElevenLabs Music API and registers
 * them in public/audio/music/manifest.json (the app loops them seamlessly with a crossfade).
 *
 *   ELEVENLABS_API_KEY=... npm run music:generate              # all presets
 *   ELEVENLABS_API_KEY=... npm run music:generate -- forest    # one preset
 *   ELEVENLABS_API_KEY=... npm run music:generate -- custom "your prompt" [seconds]
 *
 * Generated audio is subject to your ElevenLabs plan's terms — check them before publishing.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface Preset {
  id: string;
  title: string;
  seconds: number;
  prompt: string;
}

const COMMON =
  'Instrumental only, no vocals, no drums, no percussion hits, no sudden changes. Very slow tempo around 60 BPM, ' +
  'steady low dynamics, suitable as quiet background for yoga and guided breathing. Seamless loop: the ending ' +
  'should flow naturally back into the beginning, no fade-out, no final cadence.';

const PRESETS: Preset[] = [
  {
    id: 'forest',
    title: 'Las o świcie',
    seconds: 150,
    prompt: `Soothing ambient music with a soft felt piano and warm string pads, gentle forest atmosphere with distant birdsong and light rustling leaves. ${COMMON}`,
  },
  {
    id: 'ocean',
    title: 'Ocean',
    seconds: 150,
    prompt: `Calm ambient pads and slow handpan notes over soft ocean waves breaking on a sandy shore, warm and spacious. ${COMMON}`,
  },
  {
    id: 'mountain',
    title: 'Górski strumień',
    seconds: 150,
    prompt: `Meditative ambient with a gentle bamboo flute, airy synth pad and a quiet mountain stream with soft wind, peaceful and open. ${COMMON}`,
  },
  {
    id: 'rain',
    title: 'Deszcz w ogrodzie',
    seconds: 150,
    prompt: `Tranquil ambient with soft kalimba and warm pads, light rain falling on leaves in a zen garden, distant low singing bowl. ${COMMON}`,
  },
];

const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('Missing ELEVENLABS_API_KEY environment variable.');
  process.exit(1);
}

const dir = resolve(import.meta.dirname, '../public/audio/music');
const manifestPath = resolve(dir, 'manifest.json');
mkdirSync(dir, { recursive: true });

const [arg, customPrompt, customSeconds] = process.argv.slice(2);
const presets: Preset[] =
  arg === 'custom'
    ? [{ id: `custom-${Date.now().toString(36)}`, title: 'Własny utwór', seconds: Number(customSeconds ?? 120), prompt: `${customPrompt} ${COMMON}` }]
    : PRESETS.filter((p) => !arg || p.id === arg);
if (!presets.length) {
  console.error(`Unknown preset "${arg}". Available: ${PRESETS.map((p) => p.id).join(', ')}, custom`);
  process.exit(1);
}

async function compose(p: Preset): Promise<Buffer> {
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: p.prompt, music_length_ms: Math.round(p.seconds * 1000), force_instrumental: true, model_id: 'music_v1' }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const manifest: { tracks: Array<{ id: string; title: string; file: string; crossfade: number; prompt: string }> } = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { tracks: [] };

for (const p of presets) {
  process.stdout.write(`Generating "${p.title}" (${p.seconds}s)… `);
  try {
    const audio = await compose(p);
    const file = `${p.id}.mp3`;
    writeFileSync(resolve(dir, file), audio);
    manifest.tracks = manifest.tracks.filter((t) => t.id !== p.id);
    manifest.tracks.push({ id: p.id, title: p.title, file, crossfade: 6, prompt: p.prompt });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`ok (${(audio.length / 1024 / 1024).toFixed(1)} MB)`);
  } catch (e) {
    console.log('failed');
    console.error(e instanceof Error ? e.message : e);
  }
}
