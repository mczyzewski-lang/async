import { useEffect, useRef, useState } from 'react';
import { Captions, CaptionsOff, Download, Film, Loader2, Mic, Pause, Play, RotateCcw } from 'lucide-react';
import { currentEpisode } from '../episodes';
import { clock, usePlayer } from '../engine/player';
import { useTick } from '../engine/timeline';
import { buildSubtitles, toSrt } from '../engine/timing';
import { BEATS } from '../engine/types';

const ep = currentEpisode;
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const BEAT_COLORS: Record<string, string> = { hook: '#f4b860', mystery: '#c084fc', how: '#60a5fa', aha: '#4ade80', reveal: '#f87171' };

function Scrubber() {
  const master = usePlayer((s) => s.master);
  const timing = usePlayer((s) => s.timings[master]);
  const seek = usePlayer((s) => s.seek);
  const bar = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useTick(() => {
    const p = Math.min(1, clock.time / timing.duration);
    if (fill.current) fill.current.style.width = `${p * 100}%`;
    if (knob.current) knob.current.style.left = `${p * 100}%`;
    if (label.current) label.current.textContent = `${fmt(clock.time)} / ${fmt(timing.duration)}`;
    bar.current?.setAttribute('aria-valuenow', clock.time.toFixed(1));
  });
  const at = (e: React.PointerEvent) => {
    const r = bar.current!.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * timing.duration);
  };
  const scenes = ep.variants[master].scenes;
  return (
    <div className="flex items-center gap-3">
      <div
        ref={bar}
        className="scrub relative h-7 flex-1 cursor-pointer touch-none select-none"
        role="slider"
        tabIndex={0}
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={timing.duration}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          at(e);
        }}
        onPointerMove={(e) => e.buttons && at(e)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') seek(clock.time + 1);
          if (e.key === 'ArrowLeft') seek(clock.time - 1);
        }}
      >
        <div className="absolute inset-x-0 top-1/2 flex h-2 -translate-y-1/2 gap-[2px] overflow-hidden rounded-full">
          {scenes.map((s) => {
            const sp = timing.scenes[s.id];
            return <div key={s.id} title={`${s.title} (${BEATS.find((b) => b.id === s.beat)!.label})`} style={{ width: `${((sp.end - sp.start) / timing.duration) * 100}%`, background: BEAT_COLORS[s.beat], opacity: 0.28 }} />;
          })}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full">
          <div ref={fill} className="h-full bg-white/85" style={{ width: 0 }} />
        </div>
        <div ref={knob} className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg" />
      </div>
      <span ref={label} className="w-[5.6rem] shrink-0 text-right font-mono text-xs tabular-nums text-mute" data-testid="time" />
    </div>
  );
}

interface Job {
  id: string;
  state: 'running' | 'done' | 'error';
  progress: number;
  file: string;
  error: string | null;
}

function ExportButton() {
  const master = usePlayer((s) => s.master);
  const status = usePlayer((s) => s.status);
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(1080);
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const can = status.online && status.ffmpeg;
  useEffect(() => {
    if (job?.state !== 'running') return;
    const id = setInterval(async () => {
      const j = await (await fetch(`/api/export?id=${job.id}`)).json();
      if (j.job) setJob(j.job);
    }, 1000);
    return () => clearInterval(id);
  }, [job?.id, job?.state]);
  const start = async () => {
    setErr(null);
    usePlayer.getState().pause();
    const r = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ episodeId: ep.id, variantId: master, aspect: '16:9', height }) });
    const j = await r.json();
    if (!r.ok) setErr(j.error);
    if (j.job) setJob(j.job);
  };
  const srt = () => {
    const s = usePlayer.getState();
    const blob = new Blob([toSrt(buildSubtitles(ep.variants[master], s.timings[master]))], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `howish-${ep.id}-${master}.srt`;
    a.click();
  };
  return (
    <div className="relative">
      <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Film size={15} /> Export Video
      </button>
      {open && (
        <div className="panel absolute bottom-11 right-0 z-30 w-[19rem] p-4 text-sm shadow-2xl">
          <div className="mb-2 font-semibold text-white">Export style {master} · MP4 H.264 · 30 fps</div>
          {can ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <select className="sel flex-1" value={height} onChange={(e) => setHeight(Number(e.target.value))} aria-label="Resolution">
                  <option value={1080}>1920 × 1080</option>
                  <option value={720}>1280 × 720 (faster)</option>
                  <option value={540}>960 × 540 (draft)</option>
                </select>
                <button className="btn btn-primary" disabled={job?.state === 'running'} onClick={start}>
                  {job?.state === 'running' ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />} Render
                </button>
              </div>
              {job && (
                <div className="mb-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-white transition-all" style={{ width: `${job.progress * 100}%` }} />
                  </div>
                  <div className="mt-1.5 text-xs text-mute">
                    {job.state === 'running' && `Rendering frame by frame… ${Math.round(job.progress * 100)}%`}
                    {job.state === 'error' && <span className="text-red-300">Failed: {job.error}</span>}
                    {job.state === 'done' && (
                      <a className="inline-flex items-center gap-1 font-semibold text-emerald-300 underline" href={`/api/export/file?name=${encodeURIComponent(job.file)}`}>
                        <Download size={13} /> Download {job.file}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {err && <div className="mb-2 text-xs text-red-300">{err}</div>}
              <p className="text-xs leading-relaxed text-mute">Frames are rendered deterministically from the timeline (not screen-recorded), with narration muxed in when it exists. Software rendering takes a few minutes. Vertical 9:16 is available from the CLI: <code className="text-white/80">npm run export -- --variant {master} --aspect 9:16</code></p>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-mute">Export needs the local HOWISH server with FFmpeg and Playwright (<code className="text-white/80">npm run dev</code>). {status.online && !status.ffmpeg ? 'FFmpeg was not found on this machine.' : 'This page is running without the local server.'}</p>
          )}
          <button className="btn mt-3 w-full justify-center" onClick={srt}>
            <Download size={14} /> Subtitles (.srt)
          </button>
        </div>
      )}
    </div>
  );
}

function VoiceButton() {
  const master = usePlayer((s) => s.master);
  const status = usePlayer((s) => s.status);
  const generating = usePlayer((s) => s.generating);
  const error = usePlayer((s) => s.voiceError);
  const timing = usePlayer((s) => s.timings[master]);
  const manifest = usePlayer((s) => s.manifests[master]);
  const generate = usePlayer((s) => s.generate);
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState('');
  const [speed, setSpeed] = useState(0);
  const ready = status.online && status.hasKey;
  const has = timing.source === 'audio';
  return (
    <div className="relative">
      <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        {generating ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />} Generate Voiceover
      </button>
      {open && (
        <div className="panel absolute bottom-11 right-0 z-30 w-[19rem] p-4 text-sm shadow-2xl">
          <div className="mb-2 font-semibold text-white">ElevenLabs narration · style {master}</div>
          {ready ? (
            <>
              <label className="mb-2 block text-xs text-mute">
                Voice ID
                <input className="sel mt-1 w-full" placeholder={status.voiceId || 'set ELEVENLABS_VOICE_ID'} value={voice} onChange={(e) => setVoice(e.target.value.trim())} />
              </label>
              <label className="mb-3 block text-xs text-mute">
                Narration speed: {(speed || status.speed).toFixed(2)}×
                <input type="range" min={0.7} max={1.2} step={0.05} value={speed || status.speed} onChange={(e) => setSpeed(Number(e.target.value))} className="mt-1 w-full" />
              </label>
              <button className="btn btn-primary w-full justify-center" disabled={!!generating || (!voice && !status.hasVoice)} onClick={() => generate(master, { voiceId: voice || undefined, speed: speed || undefined, force: has && !voice && !speed })}>
                {generating ? 'Generating…' : has ? 'Regenerate (uses credits)' : 'Generate (uses credits)'}
              </button>
              <p className="mt-2 text-xs leading-relaxed text-mute">{has ? `Synced to cached audio (${manifest?.modelId}, voice ${manifest?.voiceId.slice(0, 8)}…). Unchanged requests are served from cache.` : 'One request per variant. The audio and its timestamps are saved to public/audio and reused — nothing is generated on page load.'}</p>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-mute">{status.online ? 'Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to .env (see .env.example) and restart the dev server.' : 'Voiceover generation needs the local HOWISH server (npm run dev).'} Until then the film plays silently with subtitles on estimated timing.</p>
          )}
          {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
        </div>
      )}
    </div>
  );
}

export function Transport() {
  const playing = usePlayer((s) => s.playing);
  const rate = usePlayer((s) => s.rate);
  const subs = usePlayer((s) => s.subs);
  const master = usePlayer((s) => s.master);
  const sceneId = usePlayer((s) => s.sceneId);
  const timing = usePlayer((s) => s.timings[master]);
  const p = usePlayer.getState();
  return (
    <div className="panel flex flex-col gap-3 p-3 sm:p-4">
      <Scrubber />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary btn-icon" onClick={p.toggle} aria-label={playing ? 'Pause' : 'Play'} data-testid="play">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="btn btn-icon" onClick={p.restart} aria-label="Restart" data-testid="restart">
          <RotateCcw size={15} />
        </button>
        <select className="sel min-w-0 flex-1 sm:flex-none sm:w-56" aria-label="Scene" value={sceneId} onChange={(e) => p.seek(timing.scenes[e.target.value].start + 0.01)} data-testid="scene">
          {ep.variants[master].scenes.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.title}
            </option>
          ))}
        </select>
        <select className="sel" aria-label="Playback speed" value={rate} onChange={(e) => p.setRate(Number(e.target.value))}>
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
        <button className="btn btn-icon" aria-pressed={subs} aria-label="Subtitles" title="Subtitles" onClick={() => p.set({ subs: !subs })}>
          {subs ? <Captions size={16} /> : <CaptionsOff size={16} />}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <VoiceButton />
          <ExportButton />
        </div>
      </div>
    </div>
  );
}
