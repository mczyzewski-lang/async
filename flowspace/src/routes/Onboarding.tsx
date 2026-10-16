import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Equipment, ExperienceLevel, GoalId, MovementTag } from '@/content/types';
import { EQUIPMENT_LABELS, GOAL_LABELS, GOAL_ORDER, LEVEL_LABELS, MOVEMENT_LABELS } from '@/engine/labels';
import { Chip, Disclaimer } from '@/components/ui';
import { useSettings } from '@/store/stores';

const STEPS = ['level', 'goal', 'duration', 'equipment', 'avoid', 'safety'] as const;

export default function Onboarding() {
  const nav = useNavigate();
  const { profile, setProfile, set } = useSettings();
  const [i, setI] = useState(0);
  const [p, setP] = useState(profile);
  const step = STEPS[i];
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const finish = () => {
    setProfile({ ...p, onboarded: true });
    set({ disclaimerAccepted: true, seenIntro: true });
    nav('/');
  };
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : finish());

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-sand-soft to-paper">
      <div className="safe-top safe-x flex items-center gap-3">
        <button className="icon-btn hover:bg-ink/5" aria-label="Wstecz" onClick={() => (i ? setI(i - 1) : nav(-1))}><ChevronLeft size={24} /></button>
        <div className="flex flex-1 gap-1">
          {STEPS.map((s, k) => <div key={s} className={`h-1 flex-1 rounded-full ${k <= i ? 'bg-ink' : 'bg-ink/10'}`} />)}
        </div>
        <button className="text-sm font-semibold text-ink-soft" onClick={finish} data-testid="skip-onboarding">Pomiń</button>
      </div>
      <div className="safe-x mx-auto flex w-full max-w-xl flex-1 flex-col pt-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35 }} className="flex-1">
            {step === 'level' && (
              <Q title="Jakie masz doświadczenie z jogą?">
                {(Object.keys(LEVEL_LABELS) as ExperienceLevel[]).map((l) => <Big key={l} active={p.level === l} onClick={() => setP({ ...p, level: l })}>{LEVEL_LABELS[l]}</Big>)}
              </Q>
            )}
            {step === 'goal' && (
              <Q title="Co jest dla Ciebie najważniejsze?">
                {GOAL_ORDER.map((g: GoalId) => <Big key={g} active={p.goal === g} onClick={() => setP({ ...p, goal: g })}>{GOAL_LABELS[g]}</Big>)}
              </Q>
            )}
            {step === 'duration' && (
              <Q title="Ile czasu zwykle masz?">
                <div className="flex flex-wrap gap-2">
                  {[10, 20, 30, 40, 50].map((m) => <Chip key={m} active={p.durationMin === m} onClick={() => setP({ ...p, durationMin: m })}>{m} min</Chip>)}
                </div>
              </Q>
            )}
            {step === 'equipment' && (
              <Q title="Co masz pod ręką?" hint="Akcesoria są opcjonalne — pomagają dopasować warianty.">
                <div className="flex flex-wrap gap-2">
                  {(['mat', 'block', 'strap', 'chair', 'blanket', 'bolster'] as Equipment[]).map((e) => (
                    <Chip key={e} active={p.equipment.includes(e)} onClick={() => setP({ ...p, equipment: e === 'mat' ? p.equipment : toggle(p.equipment, e) })}>{EQUIPMENT_LABELS[e]}</Chip>
                  ))}
                </div>
              </Q>
            )}
            {step === 'avoid' && (
              <Q title="Czego wolisz unikać?" hint="Te ruchy nie pojawią się w ułożonych praktykach.">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(MOVEMENT_LABELS) as MovementTag[]).map((m) => (
                    <Chip key={m} active={p.exclude.includes(m)} onClick={() => setP({ ...p, exclude: toggle(p.exclude, m) })}>{MOVEMENT_LABELS[m]}</Chip>
                  ))}
                </div>
                <label className="mt-5 block">
                  <span className="text-sm font-semibold">Ograniczenia lub uwagi (opcjonalnie)</span>
                  <textarea
                    value={p.limitations}
                    onChange={(e) => setP({ ...p, limitations: e.target.value })}
                    placeholder="Np. wrażliwe kolano"
                    className="mt-1 h-20 w-full rounded-2xl border border-ink/10 bg-mist p-3"
                  />
                  <span className="text-xs text-ink-soft">Notatka zostaje na urządzeniu. Aplikacja nie diagnozuje i nie ocenia stanu zdrowia — w razie wątpliwości porozmawiaj z lekarzem lub fizjoterapeutą.</span>
                </label>
              </Q>
            )}
            {step === 'safety' && (
              <Q title="Zanim zaczniesz">
                <ul className="space-y-3 text-[0.98rem] leading-relaxed">
                  <li>• Ćwicz w swoim zakresie ruchu. Lekkie rozciąganie jest w porządku, ból — nie.</li>
                  <li>• Każdą pozycję możesz uprościć: klocek, koc, krzesło lub ugięte kolana.</li>
                  <li>• W ciąży, po urazie lub przy chorobach przewlekłych skonsultuj praktykę ze specjalistą.</li>
                </ul>
                <div className="mt-5"><Disclaimer /></div>
              </Q>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="safe-bottom sticky bottom-0 py-4">
          <button className="btn-primary w-full" onClick={next} data-testid="onboarding-next">{i === STEPS.length - 1 ? 'Rozumiem, zaczynajmy' : 'Dalej'}</button>
        </div>
      </div>
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[2rem] leading-tight font-light">{title}</h1>
      {hint && <p className="mt-2 text-ink-soft">{hint}</p>}
      <div className="mt-6 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Big({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`min-h-13 rounded-2xl border px-4 py-3 text-left text-[1.02rem] font-medium transition-colors ${active ? 'border-ink bg-ink text-paper' : 'border-ink/8 bg-mist'}`} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}
