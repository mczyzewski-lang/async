import { ArrowRight, BookmarkCheck, ChevronDown, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Equipment, ExperienceLevel, GoalId, GuidanceLevel, Intensity, MovementTag } from '@/content/types';
import { EQUIPMENT_LABELS, GOAL_LABELS, GOAL_ORDER, INTENSITY_LABELS, LEVEL_LABELS, MOVEMENT_LABELS } from '@/engine/labels';
import { generateSession, newSeed } from '@/engine/session';
import { Chip, PageHeader, Section } from '@/components/ui';
import { usePractice, useProgress, useSettings } from '@/store/stores';

const QUICK = [10, 20, 30, 40, 50];

export default function PracticeConfig() {
  const nav = useNavigate();
  const profile = useSettings((s) => s.profile);
  const guidanceDefault = useSettings((s) => s.guidance);
  const intensityDefault = useSettings((s) => s.intensity);
  const learned = useProgress((s) => s.learned);
  const { request, setRequest, setSession } = usePractice();
  const [showPrefs, setShowPrefs] = useState(false);
  const [custom, setCustom] = useState(!QUICK.includes(request.durationMin));

  // Start from the profile the first time.
  useEffect(() => {
    if (request.seed === 1) {
      setRequest({
        durationMin: profile.durationMin,
        goal: profile.goal,
        level: profile.level,
        equipment: profile.equipment,
        exclude: profile.exclude,
        guidance: guidanceDefault,
        intensity: intensityDefault,
        seed: newSeed(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = () => {
    const req = { ...request, seed: newSeed(), knownPoses: Object.keys(learned) };
    setRequest(req);
    setSession(generateSession(req));
    nav('/practice/preview');
  };

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div>
      <PageHeader title="Praktyka" right={<Link to="/routines" className="icon-btn hover:bg-ink/5" aria-label="Zapisane praktyki"><BookmarkCheck size={22} strokeWidth={1.6} /></Link>} />
      <div className="safe-x">
        <p className="font-display text-[1.7rem] leading-tight font-light">Dobrze Cię widzieć. Jak chcesz dziś zadbać o ciało?</p>

        <Section title={<span><span className="mr-2 text-ink-soft">1</span>Czas</span>}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Długość praktyki">
            {QUICK.map((m) => (
              <Chip key={m} active={!custom && request.durationMin === m} onClick={() => { setCustom(false); setRequest({ durationMin: m }); }} testId={`dur-${m}`}>
                {m} min
              </Chip>
            ))}
            <Chip active={custom} onClick={() => setCustom(true)}>Własny</Chip>
          </div>
          {custom && (
            <div className="card mt-3 p-4">
              <label className="flex items-center justify-between text-sm font-semibold">
                Długość <span className="font-display text-2xl">{request.durationMin} min</span>
              </label>
              <input type="range" min={5} max={75} step={5} value={request.durationMin} onChange={(e) => setRequest({ durationMin: Number(e.target.value) })} className="mt-2 w-full" aria-label="Własna długość w minutach" />
            </div>
          )}
        </Section>

        <Section title={<span><span className="mr-2 text-ink-soft">2</span>Cel</span>}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GOAL_ORDER.map((g: GoalId) => (
              <button
                key={g}
                className={`flex min-h-12 items-center rounded-2xl border px-4 py-3 text-left font-medium transition-colors ${request.goal === g ? 'border-ink bg-ink text-paper' : 'border-ink/8 bg-mist'}`}
                onClick={() => setRequest({ goal: g })}
                aria-pressed={request.goal === g}
                data-testid={`goal-${g}`}
              >
                {GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </Section>

        <Section title={<span><span className="mr-2 text-ink-soft">3</span>Doświadczenie</span>}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LEVEL_LABELS) as ExperienceLevel[]).map((l) => (
              <Chip key={l} active={request.level === l} onClick={() => setRequest({ level: l })} testId={`level-${l}`}>{LEVEL_LABELS[l]}</Chip>
            ))}
          </div>
        </Section>

        <Section>
          <button className="flex w-full items-center justify-between py-2 text-left" onClick={() => setShowPrefs((v) => !v)} aria-expanded={showPrefs} data-testid="toggle-prefs">
            <span className="font-display text-[1.35rem]"><span className="mr-2 text-ink-soft">4</span>Preferencje <span className="text-sm text-ink-soft">(opcjonalnie)</span></span>
            <ChevronDown className={`transition-transform ${showPrefs ? 'rotate-180' : ''}`} />
          </button>
          {showPrefs && (
            <div className="card mt-2 space-y-5 p-4">
              <Pref title="Intensywność">
                {(Object.keys(INTENSITY_LABELS) as Intensity[]).map((i) => (
                  <Chip key={i} active={request.intensity === i} onClick={() => setRequest({ intensity: i })}>{INTENSITY_LABELS[i]}</Chip>
                ))}
              </Pref>
              <Pref title="Unikaj ruchów">
                {(Object.keys(MOVEMENT_LABELS) as MovementTag[]).map((m) => (
                  <Chip key={m} active={request.exclude.includes(m)} onClick={() => setRequest({ exclude: toggle(request.exclude, m) })} testId={`exclude-${m}`}>{MOVEMENT_LABELS[m]}</Chip>
                ))}
              </Pref>
              <Pref title="Dostępne akcesoria">
                {(['mat', 'block', 'strap', 'chair', 'blanket', 'bolster'] as Equipment[]).map((e) => (
                  <Chip key={e} active={request.equipment.includes(e)} onClick={() => setRequest({ equipment: e === 'mat' ? request.equipment : toggle(request.equipment, e) })}>{EQUIPMENT_LABELS[e]}</Chip>
                ))}
              </Pref>
              <Pref title="Prowadzenie głosem">
                {([['minimal', 'Minimum instrukcji'], ['standard', 'Standardowo'], ['detailed', 'Prowadź mnie dokładnie']] as Array<[GuidanceLevel, string]>).map(([g, l]) => (
                  <Chip key={g} active={request.guidance === g} onClick={() => setRequest({ guidance: g })}>{l}</Chip>
                ))}
              </Pref>
              <Pref title="Pozycje">
                {([['familiar', 'Raczej znane'], ['balanced', 'Mieszanka'], ['new', 'Coś nowego']] as const).map(([n, l]) => (
                  <Chip key={n} active={request.novelty === n} onClick={() => setRequest({ novelty: n })}>{l}</Chip>
                ))}
              </Pref>
            </div>
          )}
        </Section>

        <div className="sticky bottom-24 z-10 mt-8">
          <button className="btn-primary w-full shadow-[var(--shadow-float)]" onClick={generate} data-testid="generate">
            Ułóż praktykę · {request.durationMin} min <ArrowRight size={18} />
          </button>
        </div>

        <Section title="Oddech">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { m: 2, t: 'Dwie minuty oddechu', d: 'Krótki reset w ciągu dnia.' },
              { m: 5, t: 'Pięć minut wyciszenia', d: 'Spokojny rytm z dłuższym wydechem.' },
            ].map((b) => (
              <Link key={b.m} to={`/breathe?min=${b.m}`} className="card flex items-center gap-3 p-4">
                <Wind className="text-sage-deep" size={22} strokeWidth={1.6} />
                <div className="flex-1">
                  <div className="font-semibold">{b.t}</div>
                  <div className="text-sm text-ink-soft">{b.d}</div>
                </div>
                <ArrowRight size={18} className="text-ink-soft" />
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Pref({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="eyebrow mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
