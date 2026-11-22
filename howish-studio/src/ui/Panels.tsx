import { useEffect, useState } from 'react';
import { currentEpisode } from '../episodes';
import { VARIANTS, usePlayer } from '../engine/player';
import { BEATS, type VariantId } from '../engine/types';
import { CRITERIA, EXPERT, RECOMMENDATION } from '../episodes/flight/evaluation';

const ep = currentEpisode;

export function ScriptPanel() {
  const master = usePlayer((s) => s.master);
  const sceneId = usePlayer((s) => s.sceneId);
  const timing = usePlayer((s) => s.timings[master]);
  const seek = usePlayer((s) => s.seek);
  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 text-xs text-mute">
        Timing source: <b className="text-white/80">{timing.source === 'audio' ? 'measured from ElevenLabs timestamps' : 'estimated from word count'}</b> · {timing.duration.toFixed(1)} s
      </div>
      {ep.variants[master].scenes.map((s, i) => {
        const on = s.id === sceneId;
        const sp = timing.scenes[s.id];
        return (
          <button key={s.id} onClick={() => seek(sp.start + 0.01)} className={`rounded-xl border p-3 text-left transition ${on ? 'border-white/30 bg-white/[0.07]' : 'border-line hover:bg-white/[0.04]'}`}>
            <div className="mb-1 flex items-center gap-2 text-[0.68rem] uppercase tracking-wider text-mute">
              <span className="font-mono">{String(i + 1).padStart(2, '0')}</span>
              <span>{BEATS.find((b) => b.id === s.beat)!.label}</span>
              <span className="ml-auto font-mono normal-case">
                {sp.start.toFixed(1)}–{sp.end.toFixed(1)}s
              </span>
            </div>
            <div className="text-sm font-semibold text-white">{s.title}</div>
            <p className="mt-1 text-[0.8rem] leading-relaxed text-white/75">“{s.cues.map((c) => c.text).join(' ')}”</p>
            {on && (
              <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-[0.72rem] leading-snug text-mute">
                <dt>Camera</dt>
                <dd className="text-white/70">{s.camera}</dd>
                <dt>Objects</dt>
                <dd className="text-white/70">{s.objects.join(' · ')}</dd>
                <dt>On screen</dt>
                <dd className="text-white/70">{s.onScreenText.join(' · ')}</dd>
                <dt>End state</dt>
                <dd className="text-white/70">{s.targetState}</dd>
                {s.simplification && (
                  <>
                    <dt>Simplified</dt>
                    <dd className="text-amber-200/80">{s.simplification}</dd>
                  </>
                )}
              </dl>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SciencePanel() {
  return (
    <div className="flex flex-col gap-5 text-[0.82rem] leading-relaxed">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">What every version must get right</h3>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-white/85">
          {ep.facts.map((f) => (
            <li key={f.id}>
              {f.statement}{' '}
              <span className="text-mute">
                [
                {f.sources.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    <a className="underline hover:text-white" href={ep.scientificSources.find((s) => s.id === id)!.url} target="_blank" rel="noreferrer">
                      {id}
                    </a>
                  </span>
                ))}
                ]
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">Declared simplifications</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-amber-100/80">
          {ep.simplifications.map((s) => (
            <li key={s.id}>{s.note}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">Sources</h3>
        <ul className="flex flex-col gap-2">
          {ep.scientificSources.map((s) => (
            <li key={s.id} className="rounded-lg border border-line p-2.5">
              <a className="font-semibold text-white underline-offset-2 hover:underline" href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
              <div className="text-xs text-mute">{s.publisher}</div>
              <div className="mt-0.5 text-xs text-white/65">{s.supports}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type Scores = Partial<Record<VariantId, Record<string, number>>>;
const KEY = `howish-eval-${ep.id}`;

export function EvaluationPanel() {
  const [mine, setMine] = useState<Scores>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(mine));
    } catch {
      /* private mode */
    }
  }, [mine]);
  const total = (src: (v: VariantId, c: string) => number | undefined) => (v: VariantId) => {
    const vals = CRITERIA.map((c) => src(v, c.id)).filter((x): x is number => !!x);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  const expertAvg = total((v, c) => EXPERT[v][c]);
  const myAvg = total((v, c) => mine[v]?.[c]);
  const hasMine = VARIANTS.some((v) => myAvg(v) > 0);
  const myBest = hasMine ? [...VARIANTS].sort((a, b) => myAvg(b) - myAvg(a))[0] : null;
  return (
    <div className="flex flex-col gap-4 text-[0.82rem]">
      <p className="rounded-lg border border-amber-200/20 bg-amber-200/[0.06] p-2.5 text-xs leading-relaxed text-amber-100/85">Expert scores are an editorial judgement of this prototype — they are not YouTube retention data. Validate with real A/B tests before committing to a format.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-1 text-center">
          <thead>
            <tr className="text-xs text-mute">
              <th className="text-left font-medium">Criterion (1–5)</th>
              {VARIANTS.map((v) => (
                <th key={v} className="w-14 font-semibold" style={{ color: ep.variants[v].visualStyle.accent }}>
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr key={c.id}>
                <td className="py-1 text-left text-white/85">{c.label}</td>
                {VARIANTS.map((v) => (
                  <td key={v}>
                    <div className="font-mono text-white/90">{EXPERT[v][c.id]}</div>
                    <select aria-label={`Your ${c.label} score for style ${v}`} className="mt-0.5 w-12 rounded-md border border-line bg-white/5 py-0.5 text-center text-xs text-white" value={mine[v]?.[c.id] ?? ''} onChange={(e) => setMine({ ...mine, [v]: { ...mine[v], [c.id]: Number(e.target.value) } })}>
                      <option value="">–</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
            <tr className="text-xs">
              <td className="pt-2 text-left font-semibold text-mute">Expert average</td>
              {VARIANTS.map((v) => (
                <td key={v} className="pt-2 font-mono font-semibold text-white">
                  {expertAvg(v).toFixed(1)}
                </td>
              ))}
            </tr>
            <tr className="text-xs">
              <td className="text-left font-semibold text-mute">Your average</td>
              {VARIANTS.map((v) => (
                <td key={v} className="font-mono font-semibold text-white">
                  {myAvg(v) ? myAvg(v).toFixed(1) : '–'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-mute">Top row of each cell: expert score. Dropdown: your own score (saved in this browser).{myBest && <> Your current favourite: <b className="text-white">{myBest} — {ep.variants[myBest].visualStyle.name}</b>.</>}</p>
      <section className="rounded-xl border border-line p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-mute">Recommendation</h3>
        <div className="mb-1.5 font-brand text-base font-semibold text-white">{RECOMMENDATION.headline}</div>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-white/80">
          {RECOMMENDATION.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-mute">Per-style notes</h3>
        <ul className="flex flex-col gap-1.5 leading-relaxed text-white/75">
          {VARIANTS.map((v) => (
            <li key={v}>
              <b style={{ color: ep.variants[v].visualStyle.accent }}>{v}</b> — {RECOMMENDATION.notes[v]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
