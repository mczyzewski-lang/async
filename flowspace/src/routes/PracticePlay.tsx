import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Info, Pause, Play, X, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { SessionStep, YogaPose, YogaSession } from '@/content/types';
import { getPose } from '@/content/poses';
import { STANDARD_CAMERAS } from '@/content/poses/define';
import { SessionPlayer, type PlayerSnapshot } from '@/engine/player';
import { PHASE_LABELS, formatDuration, minutesPL } from '@/engine/labels';
import { stepSeconds } from '@/engine/session';
import { Stage } from '@/three/Stage';
import type { CameraRequest } from '@/three/CameraRig';
import { PoseDirector } from '@/three/director';
import type { InstructorRig } from '@/three/rig/InstructorRig';
import { ENVIRONMENTS } from '@/three/world/environments';
import { getVoiceProvider, VoiceQueue } from '@/audio/voice';
import { ambient } from '@/audio/ambient';
import { BreathingCircle } from '@/components/BreathingCircle';
import { PoseThumb } from '@/components/PoseCard';
import { Chip, Sheet } from '@/components/ui';
import { usePractice, useProgress, useRoutines, useSettings } from '@/store/stores';
import { PoseInfo } from './PoseLearn';
import { usePortrait } from '@/lib/useViewport';

const FEELINGS = ['Spokojniej', 'Lżej', 'Więcej energii', 'Bez zmian', 'Zmęczenie', 'Coś bolało'];

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not allowed (battery saver etc.) */
      }
    };
    acquire();
    const onVis = () => document.visibilityState === 'visible' && !cancelled && acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => undefined);
    };
  }, [active]);
}

export default function PracticePlay() {
  const [params] = useSearchParams();
  const draft = usePractice((s) => s.session);
  const draftRoutine = usePractice((s) => s.routineId);
  const active = useRoutines((s) => s.active);
  // Captured once: the active-session store keeps changing while playing.
  const [init] = useState(() => {
    const resume = params.get('resume') === '1' && active;
    return {
      session: (resume ? active.session : draft) as YogaSession | null,
      start: resume ? { stepIndex: active.stepIndex, stepElapsed: active.stepElapsed } : undefined,
      routineId: resume ? active.routineId : draftRoutine,
    };
  });
  const { session } = init;
  if (!session || !session.steps.length) {
    return (
      <div className="safe-top safe-x py-20 text-center">
        <p className="font-display text-2xl">Brak ułożonej praktyki.</p>
        <Link to="/practice" className="btn-primary mt-6">Ułóż praktykę</Link>
      </div>
    );
  }
  return (
    <PlayInner session={session} start={init.start} routineId={init.routineId} timeScale={Number(params.get('ts') ?? 1) || 1} />
  );
}

function PlayInner({ session, start, routineId, timeScale }: { session: YogaSession; start?: { stepIndex: number; stepElapsed: number }; routineId?: string; timeScale: number }) {
  const nav = useNavigate();
  const settings = useSettings();
  const env = ENVIRONMENTS[settings.environment];
  const addRecord = useProgress((s) => s.addRecord);
  const setFeeling = useProgress((s) => s.setFeeling);
  const setActive = useRoutines((s) => s.setActive);
  const saveRoutine = useRoutines((s) => s.save);
  const markPlayed = useRoutines((s) => s.markPlayed);

  const [player] = useState(() => new SessionPlayer(session, start));
  const voice = useMemo(() => new VoiceQueue(getVoiceProvider(), () => useSettings.getState().voice), []);
  const director = useRef<PoseDirector | null>(null);
  const [snap, setSnap] = useState<PlayerSnapshot>(() => player.snapshot());
  const [caption, setCaption] = useState('');
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [infoPose, setInfoPose] = useState<YogaPose | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [feeling, setFeelingLocal] = useState<string | null>(null);
  const [savedRoutine, setSavedRoutine] = useState(!!routineId);
  const [muted, setMuted] = useState(!settings.voice.enabled);
  const nonce = useRef(100);
  const portrait = usePortrait();
  const startedAt = useRef(Date.now());

  const pose = getPose(snap.stepIndex < session.steps.length ? session.steps[snap.stepIndex].poseId : session.steps[0].poseId)!;
  const step: SessionStep = session.steps[snap.stepIndex];
  const nextStep = session.steps[snap.stepIndex + 1];
  const nextPose = nextStep ? getPose(nextStep.poseId) : null;

  const frameCamera = useCallback((p: YogaPose, duration = 1.6) => {
    const anim = p.animation;
    if (!anim) return;
    const hold = anim.keyframes.find((k) => k.id === anim.hold)!;
    const id = hold.base === 'standing' ? 'threeQuarter' : hold.base === 'seated' || hold.base === 'kneeling' ? 'threeQuarter' : 'side';
    nonce.current++;
    setCamera({ preset: STANDARD_CAMERAS.find((c) => c.id === id)!, facing: anim.facing, nonce: nonce.current, duration });
  }, []);

  // ------------------------------------------------ player ↔ rig / voice / audio
  useEffect(() => {
    const off = player.on((e) => {
      const d = director.current;
      if (e.type === 'step') {
        const p = getPose(e.step.poseId)!;
        voice.clear();
        if (d && p.animation) {
          d.rig.paused = false;
          // Fit the animated entry into the scheduled entry time.
          d.rig.speed = 1;
          const natural = d.playEntry(p, e.step.side, { speed: 1 });
          d.rig.speed = Math.min(1.8, Math.max(0.55, natural / Math.max(2, e.step.entryDuration - 0.5))) * timeScale;
          if (player.status === 'paused') d.rig.paused = true;
        }
        frameCamera(p, e.index === 0 && e.reason === 'start' ? 2.4 : 1.8);
        if (e.index > 0 && useSettings.getState().chimes && e.reason === 'auto') ambient.chime(0.6);
      }
      if (e.type === 'phase' && d) {
        if (e.phase === 'hold') d.rig.speed = timeScale;
        if (e.phase === 'exit') {
          const st = session.steps[e.index];
          const nx = session.steps[e.index + 1];
          // Only play an exit when the next step is a different pose family.
          if (nx && !(nx.poseId === st.poseId)) {
            d.rig.speed = timeScale;
            d.playExit(getPose(st.poseId)!, st.side);
          }
        }
      }
      if (e.type === 'cue') {
        setCaption(e.text);
        if (!muted) voice.say(e.text);
      }
      if (e.type === 'status') {
        if (d) d.rig.paused = e.status === 'paused';
        if (e.status === 'paused') voice.clear();
      }
      if (e.type === 'complete') {
        voice.clear();
        voice.say(`Koniec praktyki. ${Math.round(session.totalSeconds / 60)} minut dla siebie.`);
        if (useSettings.getState().chimes) ambient.chime(1);
        ambient.stop();
      }
      setSnap(player.snapshot());
    });
    return () => {
      off();
    };
  }, [player, voice, frameCamera, session, muted, timeScale]);

  // ------------------------------------------------ clock: one rAF loop, UI refreshed at ~4 Hz
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let uiAcc = 0;
    let saveAcc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000) * timeScale;
      last = now;
      player.tick(dt);
      uiAcc += dt;
      saveAcc += dt;
      if (uiAcc > 0.25 / timeScale) {
        uiAcc = 0;
        setSnap(player.snapshot());
      }
      if (saveAcc > 2 && (player.status === 'playing' || player.status === 'transitioning' || player.status === 'paused')) {
        saveAcc = 0;
        setActive({ session, ...player.resumePoint(), updatedAt: Date.now(), routineId });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [player, timeScale, session, routineId, setActive]);

  // Pause automatically when the app goes to the background (timers stay consistent).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') player.pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [player]);

  useEffect(
    () => () => {
      voice.clear();
      ambient.stop();
    },
    [voice],
  );

  // Record progress on completion.
  useEffect(() => {
    if (snap.status !== 'completed' || recordId) return;
    const id = `p${Date.now().toString(36)}`;
    addRecord({
      id,
      date: Date.now(),
      seconds: Math.round(player.total),
      plannedSeconds: session.totalSeconds,
      title: session.titlePL,
      goal: session.request.goal,
      poses: [...new Set(session.steps.map((s) => s.poseId))],
      completed: true,
    });
    if (routineId) markPlayed(routineId);
    setActive(null);
    setRecordId(id);
  }, [snap.status, recordId, addRecord, player, session, setActive, routineId, markPlayed]);

  useWakeLock(settings.keepAwake && snap.status !== 'completed' && snap.status !== 'idle');

  const onRig = useCallback(
    (rig: InstructorRig) => {
      const d = new PoseDirector(rig);
      director.current = d;
      const first = getPose(session.steps[start?.stepIndex ?? 0].poseId)!;
      const anim = first.animation;
      if (anim) {
        const kf = anim.keyframes[0];
        d.base = kf.base;
        rig.setPose(kf.state, 0);
      }
      frameCamera(first, 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const begin = () => {
    getVoiceProvider().unlock();
    ambient.unlock().then(() => settings.ambientOn && ambient.start(env.ambience, settings.ambientVolume));
    if (start) {
      player.startFromResume();
      player.resume();
    } else player.start();
    setSnap(player.snapshot());
  };

  const exitSession = (save: boolean) => {
    voice.clear();
    ambient.stop();
    const elapsed = player.elapsed;
    if (save && elapsed > 60) {
      addRecord({
        id: `p${Date.now().toString(36)}`,
        date: Date.now(),
        seconds: Math.round(elapsed),
        plannedSeconds: session.totalSeconds,
        title: session.titlePL,
        goal: session.request.goal,
        poses: [...new Set(session.steps.slice(0, player.stepIndex + 1).map((s) => s.poseId))],
        completed: false,
      });
      setActive(null);
    } else if (!save) {
      setActive({ session, ...player.resumePoint(), updatedAt: Date.now(), routineId });
    }
    nav('/');
  };

  const stepLeft = step ? stepSeconds(step) - snap.stepElapsed : 0;
  const holdLeft = step ? Math.max(0, step.entryDuration + step.holdDuration - snap.stepElapsed) : 0;
  const progress = snap.total ? snap.elapsed / snap.total : 0;
  const showBreath =
    settings.breathingGuide && step && (step.phase === 'arrival' || step.phase === 'relax') && snap.phase === 'hold' && snap.status === 'playing';
  const minutes = Math.round(session.totalSeconds / 60);

  return (
    <div className="fixed inset-0 overflow-hidden bg-sand-soft" data-testid="practice-play" data-status={snap.status} data-step={snap.stepIndex} data-phase={snap.phase}>
      <Stage className="absolute inset-0" env={settings.environment} quality={settings.quality} onRig={onRig} camera={camera} testId="play-stage" viewShift={portrait ? 0.17 : 0} viewShiftX={!portrait && snap.status !== 'idle' && snap.status !== 'completed' ? 0.2 : 0} />

      {/* ------------------------------------------------ top */}
      <div className="safe-top safe-x pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-paper/80 to-transparent pb-8">
        <div className="pointer-events-auto flex items-center gap-2">
          <button className="icon-btn glass" aria-label="Zakończ" onClick={() => { player.pause(); setExitOpen(true); }} data-testid="btn-exit">
            <X size={20} />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Postęp praktyki">
            <div className="h-full rounded-full bg-sage-deep transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="w-14 text-right text-sm font-semibold tabular-nums" data-testid="time-left">{formatDuration(snap.total - snap.elapsed)}</span>
          <button className="icon-btn glass" aria-label={muted ? 'Włącz głos' : 'Wycisz głos'} onClick={() => { setMuted((m) => !m); voice.clear(); }}>
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        </div>
        {step && snap.status !== 'idle' && snap.status !== 'completed' && (
          <div className="mt-2 text-xs font-semibold tracking-wider text-ink-soft uppercase">{PHASE_LABELS[step.phase]}</div>
        )}
      </div>

      {showBreath && (
        <div className="pointer-events-none absolute top-20 right-4 landscape:top-16">
          <BreathingCircle size={portrait ? 104 : 96} />
        </div>
      )}

      {/* ------------------------------------------------ start overlay */}
      <AnimatePresence>
        {snap.status === 'idle' && (
          <motion.div className="absolute inset-0 flex items-end bg-gradient-to-t from-paper via-paper/60 to-transparent" exit={{ opacity: 0 }}>
            <div className="safe-x safe-bottom mx-auto w-full max-w-xl pb-6">
              <p className="eyebrow">{start ? 'Wznawiasz praktykę' : 'Gotowa przestrzeń'}</p>
              <h1 className="font-display text-3xl leading-tight">{session.titlePL}</h1>
              <p className="mt-2 text-ink-soft">Połóż telefon 1–2 m od maty, tak by widzieć instruktora. Głos poprowadzi Cię przez całą praktykę.</p>
              <button className="btn-primary mt-5 w-full" onClick={begin} data-testid="begin">
                <Play size={18} /> {start ? 'Wznów' : 'Zaczynamy'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {snap.status === 'preparing' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-mist/80 px-6 py-3 font-display text-xl backdrop-blur">Przygotuj matę…</div>
        </div>
      )}

      {/* ------------------------------------------------ bottom panel */}
      {snap.status !== 'idle' && snap.status !== 'completed' && step && (
        <div className="safe-bottom absolute inset-x-0 bottom-0 px-3 landscape:right-auto landscape:left-0 landscape:w-[380px] landscape:max-lg:bottom-0">
          <div className="mx-auto max-w-xl rounded-[1.75rem] bg-mist/92 p-4 shadow-[var(--shadow-float)] backdrop-blur-md">
            <div className="flex items-start gap-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => { player.pause(); setInfoPose(pose); }} aria-label={`Szczegóły: ${pose.namePL}`} data-testid="current-pose">
                <div className="eyebrow">
                  {snap.stepIndex + 1}/{session.steps.length} · {step.side === 'L' ? 'lewa strona' : step.side === 'R' ? 'prawa strona' : snap.phase === 'hold' ? 'utrzymaj' : 'wejście'}
                </div>
                <div className="truncate font-display text-[1.9rem] leading-tight" data-testid="pose-name">{pose.namePL}</div>
              </button>
              <div className="text-right">
                <div className="font-display text-[2.2rem] leading-none tabular-nums" data-testid="step-timer">
                  {formatDuration(snap.phase === 'hold' || snap.phase === 'entry' ? holdLeft : stepLeft)}
                </div>
                <div className="text-[11px] text-ink-soft">{snap.phase === 'entry' ? 'wejście' : snap.phase === 'hold' ? 'w pozycji' : 'przejście'}</div>
              </div>
            </div>
            {caption && <p className="mt-2 line-clamp-2 text-[1.05rem] leading-snug text-ink-2" aria-live="polite">{caption}</p>}
            <div className="mt-3 flex items-center justify-between">
              <button className="icon-btn h-12 w-12 hover:bg-ink/5" aria-label="Poprzednia pozycja" onClick={() => player.previous()} data-testid="btn-prev">
                <ChevronLeft size={26} />
              </button>
              <button
                className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-paper shadow-lg active:scale-95"
                aria-label={snap.status === 'paused' ? 'Wznów' : 'Pauza'}
                onClick={() => { player.toggle(); setSnap(player.snapshot()); }}
                data-testid="btn-pause"
              >
                {snap.status === 'paused' ? <Play size={28} className="ml-1" /> : <Pause size={28} />}
              </button>
              <button className="icon-btn h-12 w-12 hover:bg-ink/5" aria-label="Następna pozycja" onClick={() => player.next()} data-testid="btn-next">
                <ChevronRight size={26} />
              </button>
            </div>
            {nextPose && (
              <div className="mt-2 flex items-center gap-2 border-t border-ink/6 pt-2 text-sm text-ink-soft">
                <PoseThumb pose={nextPose} className="h-9 w-9 rounded-xl" />
                <span>Następnie: <span className="font-semibold text-ink">{nextPose.namePL}</span>{nextStep?.side === 'R' && nextStep.poseId === step.poseId ? ' (druga strona)' : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {snap.status === 'paused' && (
        <div className="pointer-events-none absolute inset-x-0 top-[30%] text-center">
          <span className="rounded-full bg-ink/70 px-4 py-2 text-sm font-semibold text-paper">Pauza</span>
        </div>
      )}

      {/* ------------------------------------------------ completion */}
      <AnimatePresence>
        {snap.status === 'completed' && (
          <motion.div className="absolute inset-0 overflow-y-auto bg-paper/85 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="completion">
            <div className="safe-x safe-top mx-auto max-w-xl pt-16 pb-16">
              <p className="eyebrow">Praktyka zakończona</p>
              <h1 className="font-display text-[2.6rem] leading-tight font-light">
                {minutes} {minutesPL(minutes)} dla siebie.
              </h1>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="card p-4">
                  <div className="eyebrow">Czas</div>
                  <div className="font-display text-3xl">{formatDuration(player.total)}</div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">Pozycje</div>
                  <div className="font-display text-3xl">{new Set(session.steps.map((s) => s.poseId)).size}</div>
                </div>
              </div>
              <div className="mt-6">
                <h2 className="font-display text-xl">Jak czujesz się po praktyce?</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FEELINGS.map((f) => (
                    <Chip key={f} active={feeling === f} onClick={() => { setFeelingLocal(f); if (recordId) setFeeling(recordId, f); }} testId={`feeling-${f}`}>
                      {f}
                    </Chip>
                  ))}
                </div>
                {feeling === 'Coś bolało' && (
                  <p className="mt-3 rounded-2xl bg-coral-soft p-3 text-sm text-[#7d3726]">
                    Dziękujemy za szczerość. Następnym razem wybierz łagodniejsze warianty albo wyklucz trudne ruchy w preferencjach. Jeśli ból się utrzymuje, skonsultuj się ze specjalistą.
                  </p>
                )}
              </div>
              <div className="mt-6">
                <h2 className="eyebrow mb-2">Ćwiczone pozycje</h2>
                <ul className="flex flex-wrap gap-2">
                  {[...new Set(session.steps.map((s) => s.poseId))].map((id) => (
                    <li key={id} className="rounded-full bg-mist px-3 py-1.5 text-sm">{getPose(id)?.namePL}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 flex flex-col gap-2">
                {!savedRoutine && (
                  <button className="btn-secondary" onClick={() => { saveRoutine(session); setSavedRoutine(true); }} data-testid="save-after">
                    Zapisz tę praktykę
                  </button>
                )}
                {savedRoutine && <p className="text-center text-sm text-sage-deep">Praktyka zapisana — znajdziesz ją na ekranie głównym.</p>}
                <button className="btn-primary" onClick={() => nav('/')} data-testid="done">Wróć do domu</button>
              </div>
              <p className="mt-6 text-center text-xs text-ink-soft">Rozpoczęto {new Date(startedAt.current).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={exitOpen} onClose={() => { setExitOpen(false); player.resume(); }} title="Zakończyć praktykę?" testId="exit-sheet">
        <div className="flex flex-col gap-2 pb-6">
          <button className="btn-primary" onClick={() => { setExitOpen(false); player.resume(); }}>Kontynuuj praktykę</button>
          <button className="btn-secondary" onClick={() => exitSession(false)} data-testid="exit-later">Wróć później (zapisz miejsce)</button>
          <button className="btn-secondary" onClick={() => exitSession(true)} data-testid="exit-finish">Zakończ teraz</button>
        </div>
      </Sheet>

      <Sheet open={!!infoPose} onClose={() => setInfoPose(null)} title={infoPose?.namePL} testId="pose-info-sheet">
        {infoPose && (
          <>
            <Link to={`/pose/${infoPose.slug}`} className="btn-secondary mb-4 w-full" onClick={() => setActive({ session, ...player.resumePoint(), updatedAt: Date.now(), routineId })}>
              <Info size={16} /> Otwórz w trybie nauki
            </Link>
            <PoseInfo pose={infoPose} />
          </>
        )}
      </Sheet>
    </div>
  );
}
