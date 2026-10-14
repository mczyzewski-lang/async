import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { autoFit, autoFitShape, type AutoFitResult } from '../engine/autofit';
import type { StairShape } from '../engine/types';
import { useAnalysis } from '../store/derived';
import { useStore } from '../store/useStore';
import { Section, cx } from './controls';
import { ColorsSection, DimensionsSection, LightingSection, RailingSection, ShapeSection, StructureSection, SummarySection, TreadsSection } from './sections';

const SECTIONS = [
  { id: 'shape', title: 'Typ schodów', C: ShapeSection },
  { id: 'dims', title: 'Wymiary przestrzeni', C: DimensionsSection },
  { id: 'structure', title: 'Konstrukcja stalowa', C: StructureSection },
  { id: 'treads', title: 'Stopnice drewniane', C: TreadsSection },
  { id: 'railing', title: 'Balustrady', C: RailingSection },
  { id: 'colors', title: 'Kolory i materiały', C: ColorsSection },
  { id: 'light', title: 'Oświetlenie', C: LightingSection },
  { id: 'summary', title: 'Podsumowanie', C: SummarySection },
];

export const STATUS_TEXT = { ok: 'Mieści się', warn: 'Wymaga korekty', fail: 'Nie mieści się' } as const;

function FitCard() {
  const analysis = useAnalysis();
  const setConfig = useStore((s) => s.setConfig);
  const notify = useStore((s) => s.notify);
  const [result, setResult] = useState<AutoFitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const st = analysis.status;
  const relevant = analysis.issues.filter((i) => i.level !== 'info');
  const infos = analysis.issues.filter((i) => i.level === 'info');
  const shown = expanded ? relevant : relevant.slice(0, 3);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const cfg = useStore.getState().config;
      const r = autoFit(cfg);
      setResult(r);
      setBusy(false);
      if (r.ok && r.config) {
        setConfig(r.config);
        notify(r.message, 'ok');
      } else notify(r.message, 'error');
    }, 30);
  };

  const switchTo = (shape: StairShape) => {
    const cfg = autoFitShape(useStore.getState().config, shape);
    if (cfg) {
      setConfig(cfg);
      setResult(null);
      notify(`Zmieniono na schody typu ${shape} dopasowane do przestrzeni`, 'ok');
    }
  };

  const tone = st === 'ok' ? 'ok' : st === 'warn' ? 'warn' : 'err';
  return (
    <div className="mx-4 mb-2 mt-1 rounded-2xl border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-full',
              tone === 'ok' ? 'bg-ok-soft text-ok' : tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-err-soft text-err',
            )}
          >
            {tone === 'ok' ? <CheckCircle2 size={17} strokeWidth={1.8} /> : tone === 'warn' ? <AlertTriangle size={16} strokeWidth={1.8} /> : <AlertCircle size={17} strokeWidth={1.8} />}
          </span>
          <div>
            <div className="text-[13.5px] font-semibold tracking-[-0.01em]">{STATUS_TEXT[st]}</div>
            <div className="text-[11px] text-muted">
              {relevant.length ? `${relevant.length} ${relevant.length === 1 ? 'uwaga' : relevant.length < 5 ? 'uwagi' : 'uwag'}` : 'Geometria spójna i ergonomiczna'}
            </div>
          </div>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Wand2 size={13} strokeWidth={1.8} />
          {busy ? 'Liczę…' : 'Dopasuj automatycznie'}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {shown.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 space-y-2">
              {shown.map((i) => (
                <div key={i.code + i.message} className="flex gap-2.5 text-[12px]">
                  <span className={cx('mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full', i.level === 'error' ? 'bg-err' : 'bg-warn')} />
                  <div>
                    <div className="text-ink-2">{i.message}</div>
                    {i.constraint && <div className="text-[11px] text-muted">{i.constraint}</div>}
                    {i.suggestion && <div className="text-[11px] text-accent">→ {i.suggestion}</div>}
                  </div>
                </div>
              ))}
              {relevant.length > 3 && (
                <button onClick={() => setExpanded(!expanded)} className="text-[11px] font-medium text-muted hover:text-ink">
                  {expanded ? 'Pokaż mniej' : `Pokaż wszystkie (${relevant.length})`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {analysis.suggestions.length > 0 && st !== 'ok' && (
        <div className="mt-3 rounded-xl bg-sand px-3 py-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">
            <Sparkles size={11} /> Sugestie
          </div>
          <ul className="space-y-0.5 text-[11.5px] text-ink-2">
            {analysis.suggestions.slice(0, 5).map((s) => (
              <li key={s}>· {s}</li>
            ))}
          </ul>
        </div>
      )}
      {infos.length > 0 && (
        <div className="mt-2.5 space-y-1">
          {infos.map((i) => (
            <div key={i.code} className="flex gap-2 text-[11px] text-muted">
              <Info size={12} className="mt-[1px] shrink-0" />
              {i.message}
            </div>
          ))}
        </div>
      )}
      {result && !result.ok && (
        <div className="mt-3 rounded-xl border border-err/20 bg-err-soft px-3 py-2.5 text-[11.5px] text-err">
          <div className="font-medium">{result.message}</div>
          {result.details.map((d) => (
            <div key={d}>{d}</div>
          ))}
          {result.alternatives.length > 0 && (
            <div className="mt-2 flex gap-1.5">
              {result.alternatives.map((s) => (
                <button key={s} onClick={() => switchTo(s)} className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-ink shadow-sm hover:bg-ink hover:text-white">
                  Zmień na {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {result && result.ok && result.details.length > 0 && (
        <div className="mt-3 rounded-xl bg-ok-soft px-3 py-2 text-[11.5px] text-ok">
          <div className="font-medium">{result.message}</div>
          <div>{result.details.join(' · ')}</div>
        </div>
      )}
    </div>
  );
}

export function Panel() {
  const [open, setOpen] = useState<Record<string, boolean>>({ shape: true });
  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-[22px] border border-line bg-panel shadow-float">
      <div className="scroll-thin flex-1 overflow-y-auto pt-3">
        <FitCard />
        {SECTIONS.map((s, i) => (
          <Section key={s.id} index={i + 1} title={s.title} open={!!open[s.id]} onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
            <s.C />
          </Section>
        ))}
      </div>
    </aside>
  );
}
