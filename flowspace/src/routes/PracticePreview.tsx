import { ArrowDown, ArrowUp, Heart, Play, RefreshCw, Repeat2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SessionPhase, SessionStep } from '@/content/types';
import { getPose } from '@/content/poses';
import { DIFFICULTY_LABELS, EQUIPMENT_LABELS, PHASE_LABELS, formatDuration, minutesPL } from '@/engine/labels';
import { alternativesFor, generateSession, moveStep, newSeed, removeStep, replaceStep, setDuration, stepSeconds } from '@/engine/session';
import { PoseThumb } from '@/components/PoseCard';
import { Badge, Chip, Disclaimer, PageHeader, Section, Sheet } from '@/components/ui';
import { usePractice, useRoutines } from '@/store/stores';

interface Block {
  steps: SessionStep[];
  phase: SessionPhase;
}

export default function PracticePreview() {
  const nav = useNavigate();
  const { session, setSession, routineId } = usePractice();
  const save = useRoutines((s) => s.save);
  const routines = useRoutines((s) => s.routines);
  const setActive = useRoutines((s) => s.setActive);
  const [replacing, setReplacing] = useState<SessionStep | null>(null);
  const [savedId, setSavedId] = useState<string | null>(routineId ?? null);

  const blocks = useMemo(() => {
    const out: Block[] = [];
    for (const st of session?.steps ?? []) {
      const last = out[out.length - 1];
      if (last && st.side === 'R' && last.steps[0].side === 'L' && last.steps[0].poseId === st.poseId) last.steps.push(st);
      else out.push({ steps: [st], phase: st.phase });
    }
    return out;
  }, [session]);

  if (!session) {
    return (
      <div>
        <PageHeader title="Twoja praktyka" back="/practice" />
        <div className="safe-x card mx-4 p-6 text-center">
          <p className="text-ink-soft">Nie masz jeszcze ułożonej praktyki.</p>
          <Link to="/practice" className="btn-primary mt-4">Ułóż praktykę</Link>
        </div>
      </div>
    );
  }

  const supervised = session.steps.some((s) => getPose(s.poseId)?.requiresSupervision);
  const uniquePoses = new Set(session.steps.map((s) => s.poseId)).size;
  const isSaved = !!savedId && routines.some((r) => r.id === savedId);

  const start = () => {
    setActive(null);
    nav('/practice/play');
  };

  return (
    <div>
      <PageHeader title="Twoja praktyka" subtitle={session.titlePL} back="/practice" />
      <div className="safe-x">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-sand-soft to-mist p-5">
            <div className="eyebrow">Całkowity czas</div>
            <div className="flex items-end gap-2">
              <span className="font-display text-5xl leading-none" data-testid="total-duration">{Math.round(session.totalSeconds / 60)}</span>
              <span className="pb-1 text-ink-soft">{minutesPL(Math.round(session.totalSeconds / 60))} · {formatDuration(session.totalSeconds)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="sage">{DIFFICULTY_LABELS[session.difficulty]}</Badge>
              <Badge>{uniquePoses} pozycji</Badge>
              {session.equipment.map((e) => <Badge key={e}>{EQUIPMENT_LABELS[e]}</Badge>)}
            </div>
          </div>
          <div className="flex gap-2 p-3">
            <button className="btn-primary flex-1" onClick={start} data-testid="start-session"><Play size={18} /> Rozpocznij</button>
            <button
              className="btn-secondary"
              aria-label={isSaved ? 'Zapisano' : 'Zapisz jako ulubioną'}
              onClick={() => { if (!isSaved) setSavedId(save(session)); }}
              data-testid="save-routine"
            >
              <Heart size={18} className={isSaved ? 'fill-coral text-coral' : ''} /> {isSaved ? 'Zapisano' : 'Zapisz'}
            </button>
          </div>
        </div>

        {supervised && (
          <div className="mt-4 rounded-2xl bg-coral-soft p-4 text-sm text-[#7d3726]">
            Ta praktyka zawiera wymagające pozycje. Wykonuj je tylko, jeśli znasz je z zajęć z nauczycielem, i pomiń je w razie wątpliwości.
          </div>
        )}

        <Section title="Zmień długość">
          <div className="flex flex-wrap gap-2">
            {[10, 20, 30, 40, 50].map((m) => (
              <Chip key={m} active={session.request.durationMin === m} onClick={() => { setSession(setDuration(session, m)); setSavedId(null); }} testId={`len-${m}`}>
                {m} min
              </Chip>
            ))}
            <Chip onClick={() => { setSession(generateSession({ ...session.request, seed: newSeed() })); setSavedId(null); }}>
              <RefreshCw size={15} /> Inny układ
            </Chip>
          </div>
        </Section>

        <div className="mt-6 space-y-6" data-testid="session-steps">
          {(['arrival', 'warmup', 'main', 'cooldown', 'relax'] as SessionPhase[]).map((phase) => {
            const list = blocks.filter((b) => b.phase === phase);
            if (!list.length) return null;
            const secs = list.reduce((s, b) => s + b.steps.reduce((x, st) => x + stepSeconds(st), 0), 0);
            return (
              <div key={phase}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="font-display text-lg">{PHASE_LABELS[phase]}</h3>
                  <span className="text-sm text-ink-soft">{formatDuration(secs)}</span>
                </div>
                <ul className="space-y-2">
                  {list.map((b) => {
                    const pose = getPose(b.steps[0].poseId)!;
                    const secsB = b.steps.reduce((x, st) => x + stepSeconds(st), 0);
                    return (
                      <li key={b.steps[0].id} className="card flex items-center gap-3 p-2 pr-1" data-testid="session-step">
                        <Link to={`/pose/${pose.slug}`} className="shrink-0">
                          <PoseThumb pose={pose} className="h-16 w-16 rounded-2xl" />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{pose.namePL}</div>
                          <div className="text-xs text-ink-soft">
                            {b.steps.length === 2 ? `obie strony · ${b.steps[0].holdDuration} s na stronę` : `${b.steps[0].holdDuration} s`} · ok. {formatDuration(secsB)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <IconAction label="W górę" onClick={() => setSession(moveStep(session, b.steps[0].id, -1))}><ArrowUp size={16} /></IconAction>
                          <IconAction label="W dół" onClick={() => setSession(moveStep(session, b.steps[0].id, 1))}><ArrowDown size={16} /></IconAction>
                          <IconAction label="Zamień pozycję" onClick={() => setReplacing(b.steps[0])} testId="replace-step"><Repeat2 size={16} /></IconAction>
                          {phase !== 'relax' && <IconAction label="Usuń" onClick={() => setSession(removeStep(session, b.steps[0].id))} testId="remove-step"><Trash2 size={16} /></IconAction>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <Disclaimer />
        </div>
      </div>

      <Sheet open={!!replacing} onClose={() => setReplacing(null)} title="Zamień na…" testId="replace-sheet">
        {replacing && (
          <ul className="grid grid-cols-2 gap-2 pb-6">
            {alternativesFor(replacing, session).map((p) => (
              <li key={p.id}>
                <button
                  className="card w-full overflow-hidden text-left"
                  onClick={() => {
                    setSession(replaceStep(session, replacing.id, p));
                    setReplacing(null);
                    setSavedId(null);
                  }}
                  data-testid={`alt-${p.id}`}
                >
                  <PoseThumb pose={p} className="aspect-square" />
                  <div className="p-2 text-sm font-semibold">{p.namePL}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

function IconAction({ children, label, onClick, testId }: { children: React.ReactNode; label: string; onClick: () => void; testId?: string }) {
  return (
    <button className="icon-btn h-10 w-10 text-ink-soft hover:bg-ink/5 hover:text-ink" aria-label={label} title={label} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  );
}
