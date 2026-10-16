import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns2, Heart, Info, Pause, Play, RotateCcw, RotateCw, Ruler, SkipForward, Turtle, Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { CameraPreset, CommonMistake, JointId, YogaPose } from '@/content/types';
import { POSES, POSES_3D, getPose } from '@/content/poses';
import { mirrorPose } from '@/content/poseState';
import { AREA_LABELS, DIFFICULTY_LABELS, EQUIPMENT_LABELS, CATEGORY_LABELS } from '@/engine/labels';
import { Stage } from '@/three/Stage';
import type { CameraRequest } from '@/three/CameraRig';
import { PoseDirector, keyframeState, type Side } from '@/three/director';
import type { InstructorRig } from '@/three/rig/InstructorRig';
import { Badge, Disclaimer, Sheet } from '@/components/ui';
import { useProgress, useSettings } from '@/store/stores';
import { getVoiceProvider, VoiceQueue } from '@/audio/voice';
import * as S from '@/content/poses/states';
import { usePortrait } from '@/lib/useViewport';

const SPEEDS = [1, 0.5, 0.25];
const VIEW_IDS = ['front', 'threeQuarter', 'side', 'back', 'otherSide', 'high'];

function reviewLabel(s: string) {
  return s === 'expert-reviewed' ? 'Zweryfikowane przez eksperta' : s === 'internal-review' ? 'Treść do weryfikacji eksperckiej' : 'Wersja robocza';
}

export default function PoseLearn() {
  const { slug = '' } = useParams();
  const pose = getPose(slug);
  if (!pose) {
    return (
      <div className="safe-x safe-top py-20 text-center">
        <p className="font-display text-2xl">Nie znaleziono pozycji.</p>
        <Link to="/explore" className="btn-secondary mt-6">Wróć do biblioteki</Link>
      </div>
    );
  }
  return <PoseLearnInner key={pose.id} pose={pose} />;
}

function PoseLearnInner({ pose }: { pose: YogaPose }) {
  const nav = useNavigate();
  const env = useSettings((s) => s.environment);
  const quality = useSettings((s) => s.quality);
  const fav = useProgress((s) => s.favorites.includes(pose.id));
  const toggleFav = useProgress((s) => s.toggleFavorite);
  const touchRecent = useProgress((s) => s.touchRecent);
  const markLearned = useProgress((s) => s.markLearned);

  const anim = pose.animation;
  const steps = pose.instructions;
  const portrait = usePortrait();
  const [side, setSide] = useState<Side>(pose.sided ? 'L' : 'none');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tech, setTech] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'views' | 'mistakes' | 'info'>('none');
  const [mistake, setMistake] = useState<CommonMistake | null>(null);
  const [mistakeView, setMistakeView] = useState<'incorrect' | 'correct'>('incorrect');
  const [compare, setCompare] = useState(false);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const [caption, setCaption] = useState('');
  const director = useRef<PoseDirector | null>(null);
  const rigB = useRef<InstructorRig | null>(null);
  const timer = useRef<number>(0);
  const nonce = useRef(10);
  const voice = useMemo(() => new VoiceQueue(getVoiceProvider(), () => useSettings.getState().voice), []);
  const speed = SPEEDS[speedIdx];
  const facing = anim?.facing ?? 0;
  const presets = pose.cameraPresets;

  useEffect(() => {
    touchRecent(pose.id);
    return () => {
      clearTimeout(timer.current);
      voice.clear();
    };
  }, [pose.id, touchRecent, voice]);

  const view = useCallback(
    (id: string, duration = 1.4) => {
      const p = presets.find((c) => c.id === id) ?? presets[1];
      nonce.current++;
      setCamera({ preset: p, facing, nonce: nonce.current, duration });
    },
    [presets, facing],
  );

  const highlight = (joints: JointId[]) => {
    const fix = (j: JointId): JointId => (side === 'R' ? ((j.endsWith('L') ? `${j.slice(0, -1)}R` : j.endsWith('R') ? `${j.slice(0, -1)}L` : j) as JointId) : j);
    director.current?.rig.setHighlights(joints.map(fix));
  };

  // ------------------------------------------------ step playback
  const showStep = useCallback(
    (i: number, opts: { speak?: boolean; camera?: boolean } = {}) => {
      const st = steps[i];
      if (!st) return;
      setStepIndex(i);
      setMistake(null);
      setCompare(false);
      const d = director.current;
      if (d && anim && st.animationSegment) {
        d.rig.speed = speed;
        d.goToKeyframe(pose, st.animationSegment, side, { speed: 1 });
        highlight(st.highlightedJoints);
      }
      if (opts.camera !== false && anim) view(st.cameraPreset);
      if (opts.speak) {
        voice.clear();
        voice.say(st.narrationPL);
      }
      setCaption(st.descriptionPL);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, anim, pose, side, speed, view, voice],
  );

  // Auto-advance while playing.
  useEffect(() => {
    clearTimeout(timer.current);
    if (!playing) return;
    const st = steps[stepIndex];
    const kfDur = anim?.keyframes.find((k) => k.id === st?.animationSegment)?.duration ?? 1.5;
    const dwell = (kfDur + Math.max(3.5, st?.duration ?? 5)) / speed;
    timer.current = window.setTimeout(() => {
      if (stepIndex < steps.length - 1) showStep(stepIndex + 1, { speak: true });
      else {
        setPlaying(false);
        markLearned(pose.id);
      }
    }, dwell * 1000);
    return () => clearTimeout(timer.current);
  }, [playing, stepIndex, speed, steps, anim, showStep, markLearned, pose.id]);

  const onRig = useCallback(
    (rig: InstructorRig) => {
      const d = new PoseDirector(rig);
      director.current = d;
      if (anim) {
        d.snapTo(pose, anim.entry[0], side);
        view(steps[0]?.cameraPreset ?? 'threeQuarter', 0);
        setCaption(steps[0]?.descriptionPL ?? '');
        highlightRef.current(steps[0]?.highlightedJoints ?? []);
      } else {
        rig.setPose(S.S_mountain, 0);
        nonce.current++;
        setCamera({ preset: presets.find((c) => c.id === 'threeQuarter')!, facing: 0, nonce: nonce.current, duration: 0 });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pose.id],
  );
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;

  const play = () => {
    getVoiceProvider().unlock();
    if (playing) {
      setPlaying(false);
      voice.clear();
      if (director.current) director.current.rig.paused = true;
      return;
    }
    if (director.current) director.current.rig.paused = false;
    setPlaying(true);
    const from = stepIndex >= steps.length - 1 ? 0 : stepIndex;
    showStep(from, { speak: true });
  };

  const replay = () => {
    getVoiceProvider().unlock();
    if (director.current && anim) {
      director.current.rig.paused = false;
      director.current.snapTo(pose, anim.entry[0], side);
    }
    setPlaying(true);
    showStep(0, { speak: true });
  };

  const changeSide = (s: Side) => {
    setSide(s);
    if (director.current && anim) {
      const st = steps[stepIndex];
      const st0 = keyframeState(pose, st?.animationSegment || anim.hold, s);
      if (st0) director.current.rig.setPose(st0, 1.4, `kf:${pose.id}:${st?.animationSegment}`);
    }
  };

  // ------------------------------------------------ mistakes
  const showMistake = (m: CommonMistake, viewMode: 'incorrect' | 'correct' = 'incorrect') => {
    setPlaying(false);
    voice.clear();
    clearTimeout(timer.current);
    const d = director.current;
    setMistake(m);
    setMistakeView(viewMode);
    setSheet('none');
    if (!d) return;
    d.rig.paused = false;
    const fix = (j: JointId): JointId => (side === 'R' ? ((j.endsWith('L') ? `${j.slice(0, -1)}R` : j.endsWith('R') ? `${j.slice(0, -1)}L` : j) as JointId) : j);
    if (viewMode === 'incorrect' && m.incorrectPoseState) {
      // Ensure we are in the pose family first, then deviate into the mistake.
      const st = side === 'R' && anim?.mirrorForRight ? mirrorPose(m.incorrectPoseState) : m.incorrectPoseState;
      d.rig.setPose(st, 1.8, `mistake:${m.id}`);
      d.rig.setHighlights(m.highlightedJoints.map(fix), 'error');
      setCaption(m.explanationPL);
      voice.clear();
      voice.say(`${m.titlePL}. ${m.explanationPL}`);
    } else {
      d.goToKeyframe(pose, m.correctedPoseState || anim?.hold || '', side);
      d.rig.setHighlights(m.highlightedJoints.map(fix), viewMode === 'correct' ? 'focus' : 'error');
      setCaption(viewMode === 'correct' ? m.correctionPL : m.explanationPL);
      voice.clear();
      voice.say(viewMode === 'correct' ? m.correctionPL : `${m.titlePL}. ${m.explanationPL}`);
    }
    view(m.cameraPreset);
    if (compare) syncCompare(m);
  };

  const syncCompare = (m: CommonMistake) => {
    const a = director.current?.rig;
    const b = rigB.current;
    if (!a || !b || !m.incorrectPoseState) return;
    const inc = side === 'R' && anim?.mirrorForRight ? mirrorPose(m.incorrectPoseState) : m.incorrectPoseState;
    a.setPose(inc, 1.2, `mistake:${m.id}`);
    const ok = keyframeState(pose, m.correctedPoseState, side);
    if (ok) b.setPose(ok, 1.2, `kf:${pose.id}:${m.correctedPoseState}`);
    b.breathingStyle = a.breathingStyle;
  };

  const onCompareRig = useCallback((rig: InstructorRig) => {
    rigB.current = rig;
    rig.setPose(director.current?.rig.target ?? S.S_mountain, 0);
  }, []);

  useEffect(() => {
    if (compare && mistake) {
      syncCompare(mistake);
      view('threeQuarter');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare]);

  const exitMistake = () => {
    setMistake(null);
    setCompare(false);
    showStep(stepIndex, { camera: true });
  };

  // ------------------------------------------------ test hook: exposes the rig state to e2e tests
  const stateRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t = setInterval(() => {
      const r = director.current?.rig;
      if (r && stateRef.current) {
        stateRef.current.dataset.tag = r.currentTag;
        stateRef.current.dataset.status = r.status;
        stateRef.current.dataset.hl = r.highlightTone;
      }
    }, 150);
    return () => clearInterval(t);
  }, []);

  const nextPose = useMemo(() => {
    const list = anim ? POSES_3D : POSES;
    const i = list.findIndex((p) => p.id === pose.id);
    const t = pose.transitionsTo.map((id) => getPose(id)).find((p) => p?.animation);
    return t ?? list[(i + 1) % list.length];
  }, [pose, anim]);

  const step = steps[stepIndex];

  return (
    <div className="fixed inset-0 overflow-hidden bg-sand-soft" data-testid="pose-learn">
      <Stage
        className="absolute inset-0"
        env={env}
        quality={quality}
        onRig={onRig}
        compare={compare}
        onCompareRig={onCompareRig}
        camera={camera}
        techMode={tech}
        guides={pose.technicalGuides}
        autoRotate={autoRotate}
        onInteract={() => setAutoRotate(false)}
        testId="pose-stage"
        viewShift={portrait ? (panelOpen || mistake ? 0.19 : 0.1) : 0}
        viewShiftX={portrait ? 0 : 0.2}
      />
      <span ref={stateRef} data-testid="rig-state" className="hidden" />

      {/* ------------------------------------------------ top bar */}
      <div className="safe-top safe-x pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-paper/85 via-paper/40 to-transparent pb-10">
        <div className="pointer-events-auto flex items-start gap-2">
          <button className="icon-btn glass shrink-0" aria-label="Wróć" onClick={() => (history.length > 1 ? nav(-1) : nav('/explore'))}>
            <ChevronLeft size={22} strokeWidth={1.7} />
          </button>
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="font-display text-[1.6rem] leading-tight" data-testid="pose-title">{pose.namePL}</h1>
            <p className="truncate text-sm text-ink-soft italic">{[pose.nameSanskrit, pose.nameEN].filter(Boolean).join(' · ')}</p>
          </div>
          <button className="icon-btn glass shrink-0" aria-label={fav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'} onClick={() => toggleFav(pose.id)}>
            <Heart size={20} className={fav ? 'fill-coral text-coral' : ''} strokeWidth={1.7} />
          </button>
          <button className="icon-btn glass shrink-0" aria-label="Opis i bezpieczeństwo" onClick={() => setSheet('info')} data-testid="open-info">
            <Info size={20} strokeWidth={1.7} />
          </button>
        </div>
        {pose.sided && anim && (
          <div className="pointer-events-auto mt-2 inline-flex rounded-full bg-mist/80 p-1 backdrop-blur" role="radiogroup" aria-label="Strona">
            {(['L', 'R'] as const).map((s) => (
              <button key={s} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${side === s ? 'bg-ink text-paper' : 'text-ink-soft'}`} onClick={() => changeSide(s)} aria-pressed={side === s}>
                {s === 'L' ? 'Lewa strona' : 'Prawa strona'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------ right tool column */}
      {anim && (
        <div className="safe-x absolute top-1/2 right-0 flex -translate-y-1/2 flex-col gap-2">
          <ToolButton label="Widok kamery" onClick={() => setSheet('views')} testId="btn-views"><Video size={19} /></ToolButton>
          <ToolButton label="Obracaj kamerę" active={autoRotate} onClick={() => setAutoRotate((v) => !v)} testId="btn-rotate"><RotateCw size={19} /></ToolButton>
          <ToolButton label="Tryb techniczny" active={tech} onClick={() => setTech((v) => !v)} testId="btn-tech"><Ruler size={19} /></ToolButton>
          {mistake?.incorrectPoseState && (
            <ToolButton label="Porównaj obok siebie" active={compare} onClick={() => setCompare((v) => !v)} testId="btn-compare"><Columns2 size={19} /></ToolButton>
          )}
        </div>
      )}

      {compare && (
        <div className="pointer-events-none absolute inset-x-0 top-28 flex">
          <div className="flex-1 text-center"><span className="rounded-full bg-coral px-3 py-1 text-xs font-bold tracking-widest text-white">BŁĄD</span></div>
          <div className="flex-1 text-center"><span className="rounded-full bg-sage-deep px-3 py-1 text-xs font-bold tracking-widest text-white">POPRAWNIE</span></div>
        </div>
      )}

      {!anim && (
        <div className="absolute inset-x-6 top-[38%] mx-auto max-w-sm rounded-3xl bg-mist/85 p-5 text-center backdrop-blur" data-testid="no-3d">
          <p className="font-display text-lg">Demonstracja 3D w przygotowaniu</p>
          <p className="mt-1 text-sm text-ink-soft">Ta pozycja nie ma jeszcze zweryfikowanej animacji. Poniżej znajdziesz pełny opis krok po kroku.</p>
        </div>
      )}

      {/* ------------------------------------------------ bottom panel */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 px-3 landscape:right-auto landscape:w-[min(420px,48vw)]">
        <motion.div layout className="mx-auto max-w-xl rounded-[1.75rem] bg-mist/92 shadow-[var(--shadow-float)] backdrop-blur-md">
          {mistake ? (
            <div className="p-4" data-testid="mistake-panel">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${mistakeView === 'incorrect' ? 'bg-coral-soft text-coral' : 'bg-sage-soft text-sage-deep'}`}>
                  <AlertTriangle size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="eyebrow">{mistakeView === 'incorrect' ? 'Częsty błąd' : 'Korekta'}</div>
                  <div className="font-semibold leading-snug">{mistake.titlePL}</div>
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-2" data-testid="mistake-text">{mistakeView === 'incorrect' ? mistake.explanationPL : mistake.correctionPL}</p>
                  {!mistake.incorrectPoseState && <p className="mt-1 text-xs text-ink-soft">Ten błąd opisujemy słownie — nie demonstrujemy go, aby nie utrwalać niekorzystnego wzorca.</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mistakeView === 'incorrect' ? (
                  <button className="btn-primary flex-1" onClick={() => showMistake(mistake, 'correct')} data-testid="show-correct">Pokaż poprawnie</button>
                ) : (
                  mistake.incorrectPoseState && <button className="btn-secondary flex-1" onClick={() => showMistake(mistake, 'incorrect')} data-testid="show-incorrect">Pokaż błąd</button>
                )}
                <button className="btn-secondary" onClick={() => setSheet('mistakes')}>Inne błędy</button>
                <button className="btn-secondary" onClick={exitMistake} data-testid="exit-mistakes">Wróć do nauki</button>
              </div>
            </div>
          ) : (
            <div className="p-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1.5" role="tablist" aria-label="Etapy">
                  {steps.map((s, i) => (
                    <button
                      key={s.id}
                      role="tab"
                      aria-selected={i === stepIndex}
                      aria-label={`Etap ${i + 1}`}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${i < stepIndex ? 'bg-sage' : i === stepIndex ? 'bg-ink' : 'bg-ink/12'}`}
                      onClick={() => showStep(i, { speak: playing })}
                    />
                  ))}
                </div>
                <button className="icon-btn -mr-2 h-9 w-9" aria-label={panelOpen ? 'Zwiń instrukcję' : 'Rozwiń instrukcję'} onClick={() => setPanelOpen((v) => !v)}>
                  {panelOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>
              </div>
              <AnimatePresence initial={false}>
                {panelOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="eyebrow">Etap {stepIndex + 1}/{steps.length}</span>
                      {anim && step?.animationSegment && <span className="text-xs text-ink-soft">{anim.keyframes.find((k) => k.id === step.animationSegment)?.labelPL}</span>}
                    </div>
                    <p className="mt-1 text-[1.05rem] leading-relaxed" data-testid="step-text">{mistake ? caption : step?.descriptionPL}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {anim && (
                <div className="mt-3 flex items-center justify-between gap-1">
                  <CtrlButton label="Od początku" onClick={replay} testId="btn-replay"><RotateCcw size={19} /></CtrlButton>
                  <CtrlButton label={`Tempo ${speed}×`} onClick={() => { const n = (speedIdx + 1) % SPEEDS.length; setSpeedIdx(n); if (director.current) director.current.rig.speed = SPEEDS[n]; }} testId="btn-slower">
                    <span className="flex items-center gap-1 text-xs font-bold"><Turtle size={17} />{speed}×</span>
                  </CtrlButton>
                  <button className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper shadow-lg active:scale-95" aria-label={playing ? 'Pauza' : 'Odtwórz'} onClick={play} data-testid="btn-play">
                    {playing ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
                  </button>
                  <CtrlButton label="Następny etap" onClick={() => showStep(Math.min(steps.length - 1, stepIndex + 1), { speak: playing })} testId="btn-next-step"><ChevronRight size={22} /></CtrlButton>
                  <CtrlButton label="Następna pozycja" onClick={() => nav(`/pose/${nextPose.slug}`, { replace: true })} testId="btn-next-pose"><SkipForward size={19} /></CtrlButton>
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {pose.commonMistakes.length > 0 && (
                  <button className="btn-secondary h-11 min-h-0 flex-1 text-sm" onClick={() => setSheet('mistakes')} data-testid="btn-mistakes">
                    <AlertTriangle size={16} className="text-coral" /> Zobacz najczęstsze błędy
                  </button>
                )}
                {!anim && (
                  <button className="btn-secondary h-11 min-h-0 flex-1 text-sm" onClick={() => nav(`/pose/${nextPose.slug}`, { replace: true })}>
                    Następna pozycja <SkipForward size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ------------------------------------------------ sheets */}
      <Sheet open={sheet === 'views'} onClose={() => setSheet('none')} title="Widok kamery" testId="sheet-views">
        <div className="grid grid-cols-3 gap-2 pb-4">
          {VIEW_IDS.map((id) => {
            const p = presets.find((c) => c.id === id) as CameraPreset;
            return (
              <button key={id} className="chip justify-center" onClick={() => { view(id); setSheet('none'); }} data-testid={`view-${id}`}>
                {p.labelPL}
              </button>
            );
          })}
          <button className="chip col-span-3 justify-center" onClick={() => { view(steps[stepIndex]?.cameraPreset ?? 'threeQuarter'); setSheet('none'); }}>
            Resetuj kamerę
          </button>
        </div>
        <p className="pb-6 text-sm text-ink-soft">Przeciągnij palcem, aby obracać widok o 360°. Zsuń lub rozsuń dwa palce, aby przybliżyć.</p>
      </Sheet>

      <Sheet open={sheet === 'mistakes'} onClose={() => setSheet('none')} title="Najczęstsze błędy" testId="sheet-mistakes">
        <ul className="space-y-2 pb-6">
          {pose.commonMistakes.map((m) => (
            <li key={m.id}>
              <button className="card flex w-full items-start gap-3 p-4 text-left" onClick={() => showMistake(m)} data-testid={`mistake-${m.id}`}>
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-coral" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.titlePL}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{m.explanationPL}</span>
                  {!m.incorrectPoseState && <span className="mt-1 block text-xs text-ink-soft">Opis słowny</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={sheet === 'info'} onClose={() => setSheet('none')} title={pose.namePL} testId="sheet-info">
        <PoseInfo pose={pose} />
      </Sheet>

      {/* live caption for accessibility */}
      <div className="sr-only" aria-live="polite">{caption}</div>
    </div>
  );
}

function ToolButton({ children, label, onClick, active, testId }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean; testId?: string }) {
  return (
    <button
      className={`icon-btn h-11 w-11 shadow-[var(--shadow-soft)] ${active ? 'bg-ink text-paper' : 'glass text-ink'}`}
      aria-label={label}
      title={label}
      aria-pressed={!!active}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function CtrlButton({ children, label, onClick, testId }: { children: React.ReactNode; label: string; onClick: () => void; testId?: string }) {
  return (
    <button className="icon-btn h-12 w-12 text-ink hover:bg-ink/5" aria-label={label} title={label} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  );
}

export function PoseInfo({ pose }: { pose: YogaPose }) {
  return (
    <div className="space-y-5 pb-8 text-[0.95rem] leading-relaxed">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="sage">{DIFFICULTY_LABELS[pose.difficulty]}</Badge>
        <Badge>{CATEGORY_LABELS[pose.category]}</Badge>
        <Badge>{pose.duration.typical} s typowo</Badge>
        {pose.animation ? <Badge tone="gold">Demonstracja 3D</Badge> : <Badge>Bez demonstracji 3D</Badge>}
        {pose.requiresSupervision && <Badge tone="coral">Zalecany nadzór nauczyciela</Badge>}
      </div>
      <p>{pose.summaryPL}</p>
      <InfoList title="Czego możesz się spodziewać" items={pose.benefits} />
      <InfoList title="Na co uważać" items={pose.cautions} tone="coral" />
      {pose.contraindications.length > 0 && <InfoList title="Kiedy zrezygnować" items={pose.contraindications} tone="coral" />}
      <div>
        <h4 className="eyebrow mb-2">Łatwiejsze warianty</h4>
        <ul className="space-y-2">
          {pose.modifications.map((m) => (
            <li key={m.id} className="rounded-2xl bg-paper p-3">
              <div className="font-semibold">{m.titlePL}</div>
              {m.descriptionPL && <div className="text-sm text-ink-soft">{m.descriptionPL}</div>}
            </li>
          ))}
        </ul>
      </div>
      {!pose.animation && (
        <div>
          <h4 className="eyebrow mb-2">Instrukcja krok po kroku</h4>
          <ol className="list-decimal space-y-1 pl-5">
            {pose.instructions.map((s) => <li key={s.id}>{s.descriptionPL}</li>)}
          </ol>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <h4 className="eyebrow mb-1">Obszary ciała</h4>
          <p>{pose.targetAreas.map((a) => AREA_LABELS[a]).join(', ')}</p>
        </div>
        <div>
          <h4 className="eyebrow mb-1">Przydatne akcesoria</h4>
          <p>{pose.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}</p>
        </div>
        <div>
          <h4 className="eyebrow mb-1">Czas nauki</h4>
          <p>ok. {pose.learningMinutes} min praktyki</p>
        </div>
        <div>
          <h4 className="eyebrow mb-1">Czas trwania</h4>
          <p>{pose.duration.min}–{pose.duration.max} s</p>
        </div>
      </div>
      <div className="rounded-2xl bg-paper p-3 text-xs text-ink-soft">
        <div>Treść: {reviewLabel(pose.contentReviewStatus)}.</div>
        <div>Animacja: {pose.animationReviewStatus === 'none' ? 'brak' : reviewLabel(pose.animationReviewStatus)} — przedstawia wiarygodny układ ciała, nie wzorzec biomechaniczny.</div>
      </div>
      <Disclaimer compact />
    </div>
  );
}

function InfoList({ title, items, tone }: { title: string; items: string[]; tone?: 'coral' }) {
  return (
    <div>
      <h4 className={`eyebrow mb-2 ${tone === 'coral' ? 'text-[#9b4430]' : ''}`}>{title}</h4>
      <ul className="space-y-1.5">
        {items.map((b) => (
          <li key={b} className="flex gap-2">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'coral' ? 'bg-coral' : 'bg-sage'}`} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
