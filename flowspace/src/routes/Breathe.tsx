import { ChevronLeft, Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { BreathingCircle } from '@/components/BreathingCircle';
import { Chip } from '@/components/ui';
import { formatDuration } from '@/engine/labels';
import { getVoiceProvider, VoiceQueue } from '@/audio/voice';
import { ambient } from '@/audio/ambient';
import { useProgress, useSettings } from '@/store/stores';

const RHYTHMS = [
  { id: 'calm', label: 'Spokojny 4–6', inhale: 4, exhale: 6 },
  { id: 'deep', label: 'Wyciszający 4–7', inhale: 4, exhale: 7 },
  { id: 'even', label: 'Równy 5–5', inhale: 5, exhale: 5 },
];

export default function Breathe() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [minutes, setMinutes] = useState(Number(params.get('min')) === 5 ? 5 : 2);
  const [rhythm, setRhythm] = useState(RHYTHMS[minutes === 5 ? 1 : 0]);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(minutes * 60);
  const [done, setDone] = useState(false);
  const addRecord = useProgress((s) => s.addRecord);
  const voiceOn = useSettings((s) => s.voice.enabled);
  const voice = useMemo(() => new VoiceQueue(getVoiceProvider(), () => useSettings.getState().voice), []);
  const cycles = useRef(0);

  useEffect(() => setLeft(minutes * 60), [minutes]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(t);
          setRunning(false);
          setDone(true);
          voice.say('Wróć do naturalnego oddechu. Dziękuję.');
          addRecord({ id: `b${Date.now().toString(36)}`, date: Date.now(), seconds: minutes * 60, plannedSeconds: minutes * 60, title: `Oddech · ${minutes} min`, goal: 'relax', poses: [], completed: true });
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, minutes, addRecord, voice]);
  useEffect(() => () => voice.clear(), [voice]);

  const start = () => {
    getVoiceProvider().unlock();
    ambient.unlock();
    cycles.current = 0;
    setDone(false);
    if (left === 0) setLeft(minutes * 60);
    setRunning(true);
    voice.say('Usiądź lub połóż się wygodnie. Oddychaj przez nos, bez wysiłku.');
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-sage-soft via-paper to-sand-soft">
      <div className="safe-top safe-x flex items-center gap-2">
        <button className="icon-btn hover:bg-ink/5" aria-label="Wróć" onClick={() => nav(-1)}><ChevronLeft size={24} /></button>
        <h1 className="font-display text-2xl">Oddech</h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {running ? (
          <BreathingCircle
            inhale={rhythm.inhale}
            exhale={rhythm.exhale}
            size={Math.min(260, window.innerWidth * 0.62)}
            onPhase={(p) => {
              // Spoken cues only for the first few cycles; then silence.
              cycles.current++;
              if (voiceOn && cycles.current <= 6) voice.say(p === 'in' ? 'Wdech' : 'Wydech');
            }}
          />
        ) : (
          <div className="flex h-[220px] w-[220px] items-center justify-center rounded-full bg-sage-soft/70 text-center font-display text-xl">
            {done ? 'Dobrze, że byłeś(-aś) tu chwilę.' : 'Gotowy(-a)?'}
          </div>
        )}
        <div className="font-display text-4xl tabular-nums" data-testid="breath-timer">{formatDuration(left)}</div>
        {!running && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              {[2, 5, 10].map((m) => <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {RHYTHMS.map((r) => <Chip key={r.id} active={rhythm.id === r.id} onClick={() => setRhythm(r)}>{r.label}</Chip>)}
            </div>
          </div>
        )}
        <button className="btn-primary w-48" onClick={() => (running ? setRunning(false) : start())} data-testid="breath-toggle">
          {running ? <><Pause size={18} /> Pauza</> : <><Play size={18} /> {done ? 'Jeszcze raz' : 'Zacznij'}</>}
        </button>
        <p className="max-w-sm text-center text-sm text-ink-soft">
          Wybierz rytm, który jest wygodny. Nie wstrzymuj oddechu. Jeśli poczujesz zawroty głowy, wróć do naturalnego oddychania.
        </p>
      </div>
    </div>
  );
}
