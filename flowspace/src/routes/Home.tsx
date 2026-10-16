import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Play, Settings as SettingsIcon, Wind, Heart } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { GoalId, Intensity, SessionRequest } from '@/content/types';
import { POSES_3D } from '@/content/poses';
import { STANDARD_CAMERAS } from '@/content/poses/define';
import * as S from '@/content/poses/states';
import { generateSession } from '@/engine/session';
import { GOAL_LABELS, formatMinutes, pluralPL } from '@/engine/labels';
import { Stage } from '@/three/Stage';
import type { CameraRequest } from '@/three/CameraRig';
import type { InstructorRig } from '@/three/rig/InstructorRig';
import { PoseCard } from '@/components/PoseCard';
import { Chip, Section } from '@/components/ui';
import { requestFromProfile, useProgress, useRoutines, useSettings, usePractice } from '@/store/stores';
import { greeting, startOfWeek } from '@/lib/time';

const MOODS: Array<{ id: string; label: string; goals: GoalId[]; intensity: Intensity }> = [
  { id: 'tense', label: 'Spięty', goals: ['neckShoulders', 'afterWork', 'relax'], intensity: 'gentle' },
  { id: 'tired', label: 'Zmęczony', goals: ['recovery', 'beforeSleep', 'relax'], intensity: 'gentle' },
  { id: 'energy', label: 'Pełen energii', goals: ['strength', 'balance', 'morning'], intensity: 'dynamic' },
  { id: 'calm', label: 'Potrzebuję spokoju', goals: ['relax', 'beforeSleep', 'neckShoulders'], intensity: 'gentle' },
  { id: 'move', label: 'Chcę się poruszać', goals: ['fullStretch', 'spineMobility', 'hipMobility'], intensity: 'moderate' },
];

const IDLE_CYCLE = [S.S_mountain, S.S_armsUp, S.S_mountain, S.S_prayer, S.S_mountain, S.S_standingSideBend, S.S_armsUp];

export default function Home() {
  const nav = useNavigate();
  const env = useSettings((s) => s.environment);
  const quality = useSettings((s) => s.quality);
  const profile = useSettings((s) => s.profile);
  const seenIntro = useSettings((s) => s.seenIntro);
  const setSettings = useSettings((s) => s.set);
  const active = useRoutines((s) => s.active);
  const routines = useRoutines((s) => s.routines);
  const history = useProgress((s) => s.history);
  const setSession = usePractice((s) => s.setSession);
  const setRequest = usePractice((s) => s.setRequest);
  const [mood, setMood] = useState<string | null>(null);
  const [introPhase, setIntroPhase] = useState<'loading' | 'reveal' | 'done'>(seenIntro ? 'done' : 'loading');
  const [cam, setCam] = useState<CameraRequest | null>(null);
  const rigRef = useRef<InstructorRig | null>(null);

  // Intro: wide establishing shot, then a slow dolly toward the mat.
  useEffect(() => {
    const wide = { ...STANDARD_CAMERAS[0], id: 'intro-wide', distance: 9, elevation: 16, azimuth: -18 };
    const close = { ...STANDARD_CAMERAS[0], id: 'hero', distance: 4.2, elevation: 9, azimuth: 24 };
    if (introPhase === 'loading') {
      setCam({ preset: wide, facing: 0, nonce: 1, duration: 0 });
      const t = setTimeout(() => {
        setIntroPhase('reveal');
        setCam({ preset: close, facing: 0, nonce: 2, duration: 4.5 });
      }, 900);
      return () => clearTimeout(t);
    }
    if (introPhase === 'done') setCam((c) => c ?? { preset: close, facing: 0, nonce: 3, duration: 0 });
  }, [introPhase]);

  // The instructor slowly prepares for practice (gentle idle cycle, no React re-renders).
  const onRig = useCallback((rig: InstructorRig) => {
    rigRef.current = rig;
    rig.setPose(S.S_mountain, 0);
    let i = 0;
    const loop = () => {
      if (rigRef.current !== rig) return;
      i = (i + 1) % IDLE_CYCLE.length;
      rig.playSequence([{ state: IDLE_CYCLE[i], duration: 3.2, hold: 4.5 }], loop);
    };
    rig.playSequence([{ state: S.S_mountain, duration: 0.1, hold: 3 }], loop);
  }, []);
  useEffect(() => () => {
    rigRef.current = null;
  }, []);

  const start = (over: Partial<SessionRequest>) => {
    const req = requestFromProfile(over);
    setRequest(req);
    setSession(generateSession(req));
    nav('/practice/preview');
  };

  const moodDef = MOODS.find((m) => m.id === mood);
  const suggestions = useMemo(() => {
    const goals = moodDef ? moodDef.goals : [profile.goal, 'spineMobility' as GoalId, 'relax' as GoalId].filter((g, i, a) => a.indexOf(g) === i);
    return goals.slice(0, 3).map((g, i) => ({ goal: g, minutes: [profile.durationMin, 10, 30][i] ?? 20, intensity: moodDef?.intensity }));
  }, [moodDef, profile]);

  const week = useMemo(() => {
    const from = startOfWeek().getTime();
    const items = history.filter((h) => h.date >= from);
    return { count: items.length, seconds: items.reduce((s, h) => s + h.seconds, 0) };
  }, [history]);
  const favorites = routines.filter((r) => r.favorite).slice(0, 4);
  const firstRun = !seenIntro && history.length === 0;
  const featured = useMemo(() => {
    const ids = ['downward-dog', 'warrior-2', 'child', 'tree', 'cobra', 'triangle', 'cat', 'bridge'];
    return ids.map((id) => POSES_3D.find((p) => p.id === id)!).filter(Boolean);
  }, []);

  return (
    <div>
      {/* ------------------------------------------------ hero */}
      <div className="relative h-[68dvh] min-h-[440px] w-full overflow-hidden bg-sand-soft md:h-[72dvh]">
        <Stage className="absolute inset-0" env={env} quality={quality} onRig={onRig} camera={cam} interactive={introPhase === 'done'} testId="home-stage" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-paper/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-paper via-paper/70 to-transparent" />
        <div className="safe-top safe-x absolute inset-x-0 top-0 flex items-center justify-between">
          <div className="font-display text-lg tracking-[0.32em] text-ink">FLOWSPACE</div>
          <Link to="/settings" aria-label="Ustawienia" className="icon-btn bg-mist/70 backdrop-blur">
            <SettingsIcon size={20} strokeWidth={1.6} />
          </Link>
        </div>

        <AnimatePresence>
          {introPhase === 'loading' && (
            <motion.div className="absolute inset-0 flex items-center justify-center bg-paper" exit={{ opacity: 0 }} transition={{ duration: 1.4 }}>
              <div className="h-12 w-12 animate-ping rounded-full bg-sage/40" style={{ animationDuration: '2s' }} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="safe-x absolute inset-x-0 bottom-4">
          {firstRun ? (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2, duration: 1.2 }}>
              <h1 className="font-display text-[2.1rem] leading-[1.1] font-light text-ink md:text-5xl">Twoja przestrzeń na chwilę spokoju.</h1>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="btn-primary"
                  data-testid="cta-first-10"
                  onClick={() => {
                    setSettings({ seenIntro: true });
                    start({ durationMin: 10, goal: profile.goal, level: profile.onboarded ? profile.level : 'beginner' });
                  }}
                >
                  <Play size={18} /> Zacznij 10-minutową praktykę
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSettings({ seenIntro: true });
                    nav('/explore');
                  }}
                >
                  Poznaj pozycje
                </button>
              </div>
              <button className="mt-3 text-sm text-ink-soft underline-offset-4 hover:underline" onClick={() => nav('/onboarding')}>
                Dopasuj praktykę do siebie (1 minuta)
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: introPhase === 'done' ? 0.1 : 2, duration: 1 }}>
              <p className="text-sm font-semibold tracking-wide text-ink-soft">{greeting()}</p>
              <h1 className="font-display text-[2rem] leading-[1.1] font-light md:text-5xl">Znajdź chwilę dla siebie.</h1>
              <button className="btn-primary mt-4 w-full sm:w-auto" data-testid="cta-today" onClick={() => start({ goal: moodDef?.goals[0] ?? profile.goal, intensity: moodDef?.intensity })}>
                <Play size={18} /> Zacznij dzisiejszą praktykę
              </button>
              <div className="mt-3 flex gap-2">
                {[10, 20, 30].map((m) => (
                  <Chip key={m} onClick={() => start({ durationMin: m, goal: moodDef?.goals[0] ?? profile.goal, intensity: moodDef?.intensity })} testId={`quick-${m}`}>
                    {m} min
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="safe-x">
        {/* ------------------------------------------------ continue */}
        {active && (
          <Section title="Kontynuuj praktykę">
            <Link to="/practice/play?resume=1" className="card flex items-center gap-4 p-4" data-testid="continue-session">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-sage-deep">
                <Play size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{active.session.titlePL}</div>
                <div className="text-sm text-ink-soft">
                  Krok {active.stepIndex + 1} z {active.session.steps.length}
                </div>
              </div>
              <ArrowRight size={18} className="text-ink-soft" />
            </Link>
          </Section>
        )}

        {/* ------------------------------------------------ mood */}
        <Section title="Jak się dziś czujesz?">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Samopoczucie">
            {MOODS.map((m) => (
              <Chip key={m.id} active={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)} testId={`mood-${m.id}`}>
                {m.label}
              </Chip>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {suggestions.map((s, i) => (
              <button
                key={`${s.goal}${i}`}
                className="card flex items-center gap-3 p-4 text-left transition-transform active:scale-[0.99]"
                onClick={() => start({ goal: s.goal, durationMin: s.minutes, intensity: s.intensity })}
                data-testid={`suggestion-${i}`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sand-soft font-display text-lg">{s.minutes}</div>
                <div className="min-w-0 flex-1">
                  <div className="eyebrow">{i === 0 ? 'Polecana' : 'Propozycja'}</div>
                  <div className="font-semibold leading-snug">{GOAL_LABELS[s.goal]}</div>
                </div>
                <ArrowRight size={18} className="text-ink-soft" />
              </button>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------ breathing */}
        <Section>
          <Link to="/breathe" className="card flex items-center gap-4 bg-gradient-to-br from-sage-soft to-mist p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-sage-deep">
              <Wind size={22} strokeWidth={1.6} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Dwie minuty oddechu</div>
              <div className="text-sm text-ink-soft">Gdy nie ma czasu na matę.</div>
            </div>
            <ArrowRight size={18} className="text-ink-soft" />
          </Link>
        </Section>

        {/* ------------------------------------------------ favorites */}
        {favorites.length > 0 && (
          <Section title="Twoje ulubione praktyki" action={<Link to="/routines" className="text-sm font-semibold text-sage-deep">Wszystkie</Link>}>
            <div className="grid gap-3 sm:grid-cols-2">
              {favorites.map((r) => (
                <button
                  key={r.id}
                  className="card flex items-center gap-3 p-4 text-left"
                  onClick={() => {
                    setSession(r.session, r.id);
                    nav('/practice/preview');
                  }}
                  data-testid="favorite-routine"
                >
                  <Heart size={18} className="shrink-0 fill-coral text-coral" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.name}</div>
                    <div className="text-sm text-ink-soft">{formatMinutes(r.session.totalSeconds)}</div>
                  </div>
                  <ArrowRight size={18} className="text-ink-soft" />
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* ------------------------------------------------ explore */}
        <Section title="Poznaj pozycje" action={<Link to="/explore" className="text-sm font-semibold text-sage-deep">Biblioteka</Link>}>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {featured.map((p) => (
              <div key={p.id} className="w-36 shrink-0 snap-start">
                <PoseCard pose={p} compact />
              </div>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------ progress */}
        <Section title="Ten tydzień" action={<Link to="/progress" className="text-sm font-semibold text-sage-deep">Postępy</Link>}>
          <div className="card p-5">
            {week.count === 0 ? (
              <p className="text-ink-soft">
                {history.length ? 'Każdy dzień jest dobry, by wrócić na matę. Bez presji — zacznij od kilku minut.' : 'Twoja pierwsza praktyka pojawi się tutaj.'}
              </p>
            ) : (
              <p>
                <span className="font-display text-3xl">{Math.round(week.seconds / 60)}</span> <span className="text-ink-soft">min praktyki ·</span>{' '}
                <span className="font-display text-3xl">{week.count}</span> <span className="text-ink-soft">{pluralPL(week.count, 'praktyka', 'praktyki', 'praktyk')}</span>
              </p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
