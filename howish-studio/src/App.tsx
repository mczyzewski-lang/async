import { useEffect, useState } from 'react';
import { Columns2, LayoutGrid, Volume2, VolumeX } from 'lucide-react';
import { currentEpisode } from './episodes';
import { VARIANTS, tick, usePlayer } from './engine/player';
import type { VariantId } from './engine/types';
import { Stage } from './ui/Stage';
import { Transport } from './ui/Transport';
import { EvaluationPanel, SciencePanel, ScriptPanel } from './ui/Panels';

const ep = currentEpisode;

function Header() {
  const status = usePlayer((s) => s.status);
  const checked = usePlayer((s) => s.checked);
  const timings = usePlayer((s) => s.timings);
  const synced = VARIANTS.filter((v) => timings[v].source === 'audio');
  let color = '#8b90a0';
  let label: string;
  if (!checked) label = 'Checking narration…';
  else if (!status.online) label = 'Static preview — no local server, silent with subtitles';
  else if (synced.length) {
    color = '#4ade80';
    label = `ElevenLabs narration synced: ${synced.join(', ')}`;
  } else if (status.hasKey && status.hasVoice) {
    color = '#f4b860';
    label = 'ElevenLabs ready — no voiceover generated yet';
  } else if (status.hasKey) {
    color = '#f4b860';
    label = 'API key found — set ELEVENLABS_VOICE_ID';
  } else label = 'No ElevenLabs key — silent preview with subtitles';
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
      <div className="flex items-baseline gap-2.5">
        <span className="font-brand text-[1.15rem] font-bold tracking-[0.3em] text-white">HOWISH</span>
        <span className="hidden text-[0.7rem] uppercase tracking-[0.18em] text-mute sm:inline">Creative Lab</span>
      </div>
      <div className="hidden h-5 w-px bg-line md:block" />
      <h1 className="min-w-0 flex-1 truncate font-brand text-[0.95rem] font-medium text-white/90">{ep.title}</h1>
      <span className="chip" title={status.online ? `model ${status.modelId} · speed ${status.speed}` : undefined}>
        <span className="dot" style={{ background: color }} />
        {label}
      </span>
    </header>
  );
}

function Tabs() {
  const master = usePlayer((s) => s.master);
  const compare = usePlayer((s) => s.compare);
  const setMaster = usePlayer((s) => s.setMaster);
  const setCompare = usePlayer((s) => s.setCompare);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="tablist" aria-label="Visual style" className="flex min-w-0 basis-full gap-1 rounded-xl border border-line bg-panel p-1 sm:flex-1 sm:basis-0">
        {VARIANTS.map((v) => {
          const st = ep.variants[v].visualStyle;
          const on = master === v;
          return (
            <button key={v} role="tab" aria-selected={on} onClick={() => setMaster(v)} className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-[0.82rem] font-semibold transition ${on ? 'bg-white/10 text-white' : 'text-mute hover:text-white'}`}>
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[0.68rem] font-bold text-black" style={{ background: st.accent, opacity: on ? 1 : 0.55 }}>
                {v}
              </span>
              <span className="truncate">{st.name}</span>
            </button>
          );
        })}
      </div>
      <button className={`btn ${compare ? 'btn-primary' : ''}`} aria-pressed={compare} onClick={() => setCompare(!compare)}>
        {compare ? <Columns2 size={15} /> : <LayoutGrid size={15} />}
        Compare Mode
      </button>
    </div>
  );
}

function CompareGrid() {
  const master = usePlayer((s) => s.master);
  const setMaster = usePlayer((s) => s.setMaster);
  const timings = usePlayer((s) => s.timings);
  const sync = usePlayer((s) => s.syncCompare);
  const set = usePlayer((s) => s.set);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {VARIANTS.map((v) => {
          const st = ep.variants[v].visualStyle;
          const on = master === v;
          return (
            <div key={v} className="relative overflow-hidden rounded-xl border" style={{ borderColor: on ? st.accent : 'rgba(255,255,255,.08)' }}>
              <Stage variantId={v} dpr={1} />
              <button onClick={() => setMaster(v)} title={on ? 'This variant drives time and narration' : 'Use this variant\'s narration'} className="absolute left-2 top-2 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-[0.7rem] font-semibold text-white backdrop-blur">
                <span className="grid h-4 w-4 place-items-center rounded text-[0.6rem] font-bold text-black" style={{ background: st.accent }}>
                  {v}
                </span>
                <span className="hidden sm:inline">{st.name}</span>
                {on ? <Volume2 size={13} /> : <VolumeX size={13} className="opacity-60" />}
                {on && timings[v].source !== 'audio' && <span className="hidden opacity-70 md:inline">(no audio yet)</span>}
              </button>
            </div>
          );
        })}
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-mute">
        <input type="checkbox" checked={sync} onChange={(e) => set({ syncCompare: e.target.checked })} />
        Sync by story beat (hook → mystery → how → aha → reveal). Off = same clock time in every variant.
      </label>
    </div>
  );
}

type PanelId = 'script' | 'science' | 'eval';

export default function App() {
  const master = usePlayer((s) => s.master);
  const compare = usePlayer((s) => s.compare);
  const [panel, setPanel] = useState<PanelId>('script');
  useEffect(() => {
    void usePlayer.getState().refresh();
    let id = 0;
    const loop = (now: number) => {
      tick(now);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea,button')) return;
      const p = usePlayer.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        p.toggle();
      }
      if (e.code === 'ArrowRight') p.seek(clockTime() + 2);
      if (e.code === 'ArrowLeft') p.seek(clockTime() - 2);
    };
    window.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', key);
    };
  }, []);
  const style = ep.variants[master].visualStyle;
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto grid w-full max-w-[1500px] flex-1 gap-4 p-3 sm:p-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex min-w-0 flex-col gap-3">
          <Tabs />
          {compare ? (
            <CompareGrid />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/50">
              <Stage variantId={master as VariantId} />
            </div>
          )}
          <Transport />
          {!compare && (
            <p className="px-1 text-xs text-mute">
              <b className="text-white/80">
                Style {master} — {style.name}.
              </b>{' '}
              {style.tagline}. Narration: {style.narrationTone.toLowerCase()}.
            </p>
          )}
        </section>
        <aside className="panel flex min-h-[420px] min-w-0 flex-col overflow-hidden xl:max-h-[calc(100vh-110px)]">
          <div role="tablist" className="flex border-b border-line text-[0.8rem] font-semibold">
            {([['script', 'Storyboard'], ['science', 'Science'], ['eval', 'Creative Evaluation']] as [PanelId, string][]).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={panel === id} onClick={() => setPanel(id)} className={`flex-1 px-2 py-3 transition ${panel === id ? 'border-b-2 border-white text-white' : 'border-b-2 border-transparent text-mute hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === 'script' && <ScriptPanel />}
            {panel === 'science' && <SciencePanel />}
            {panel === 'eval' && <EvaluationPanel />}
          </div>
        </aside>
      </main>
    </div>
  );
}

import { clock } from './engine/player';
const clockTime = () => clock.time;
