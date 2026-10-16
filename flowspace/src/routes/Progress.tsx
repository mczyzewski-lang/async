import { ChevronLeft, ChevronRight, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { getPose, POSES } from '@/content/poses';
import { GOAL_LABELS } from '@/engine/labels';
import { PageHeader, Section, Stat } from '@/components/ui';
import { useProgress } from '@/store/stores';
import { MONTHS_PL, WEEKDAYS_PL, dayKey, startOfWeek } from '@/lib/time';

const MILESTONES = [
  { id: 'first', label: 'Pierwsza praktyka', test: (n: number) => n >= 1, kind: 'sessions' as const },
  { id: 'five', label: '5 praktyk', test: (n: number) => n >= 5, kind: 'sessions' as const },
  { id: 'twenty', label: '20 praktyk', test: (n: number) => n >= 20, kind: 'sessions' as const },
  { id: 'hour', label: 'Pierwsza godzina na macie', test: (n: number) => n >= 60, kind: 'minutes' as const },
  { id: 'fivehours', label: '5 godzin praktyki', test: (n: number) => n >= 300, kind: 'minutes' as const },
  { id: 'poses10', label: '10 poznanych pozycji', test: (n: number) => n >= 10, kind: 'poses' as const },
  { id: 'poses25', label: '25 poznanych pozycji', test: (n: number) => n >= 25, kind: 'poses' as const },
];

export default function Progress() {
  const { history, learned, favorites, notes, addNote, removeNote } = useProgress();
  const [monthOffset, setMonthOffset] = useState(0);
  const [note, setNote] = useState('');

  const totalSec = history.reduce((s, h) => s + h.seconds, 0);
  const totalMin = Math.round(totalSec / 60);
  const learnedCount = Object.keys(learned).length;
  const days = useMemo(() => new Set(history.map((h) => dayKey(h.date))), [history]);

  const week = useMemo(() => {
    const start = startOfWeek();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = dayKey(d.getTime());
      const min = history.filter((h) => dayKey(h.date) === k).reduce((s, h) => s + h.seconds / 60, 0);
      return { label: WEEKDAYS_PL[i], min, today: k === dayKey(Date.now()) };
    });
  }, [history]);
  const maxWeek = Math.max(20, ...week.map((w) => w.min));

  const month = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const cells: Array<{ day: number; key: string } | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysIn; d++) cells.push({ day: d, key: dayKey(new Date(first.getFullYear(), first.getMonth(), d).getTime()) });
    return { title: `${MONTHS_PL[first.getMonth()]} ${first.getFullYear()}`, cells };
  }, [monthOffset]);

  const goals = useMemo(() => {
    const m = new Map<string, number>();
    history.forEach((h) => h.goal && m.set(h.goal, (m.get(h.goal) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [history]);

  const poseCounts = useMemo(() => {
    const m = new Map<string, number>();
    history.forEach((h) => h.poses.forEach((p) => m.set(p, (m.get(p) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [history]);

  const lastDate = history[0]?.date;
  const daysSince = lastDate ? Math.floor((Date.now() - lastDate) / 86400000) : null;

  return (
    <div>
      <PageHeader title="Postępy" subtitle="Spokojnie, we własnym rytmie" />
      <div className="safe-x">
        {daysSince !== null && daysSince >= 4 && (
          <div className="card mb-4 flex gap-3 bg-sage-soft/70 p-4" data-testid="welcome-back">
            <Sparkles className="shrink-0 text-sage-deep" size={20} />
            <p className="text-sm">Dobrze, że wracasz. Przerwy są częścią praktyki — zacznij od krótkiej, łagodnej sesji.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Praktyki" value={<span data-testid="stat-sessions">{history.length}</span>} />
          <Stat label="Minuty" value={<span data-testid="stat-minutes">{totalMin}</span>} />
          <Stat label="Dni na macie" value={days.size} />
          <Stat label="Poznane pozycje" value={learnedCount} hint={`z ${POSES.length}`} />
        </div>

        <Section title="Ten tydzień">
          <div className="card p-4">
            <div className="flex h-36 items-end gap-2" role="img" aria-label="Minuty praktyki w tym tygodniu">
              {week.map((w) => (
                <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="text-[10px] text-ink-soft tabular-nums">{w.min ? Math.round(w.min) : ''}</div>
                  <div className={`w-full rounded-t-lg ${w.today ? 'bg-sage-deep' : 'bg-sage/70'}`} style={{ height: `${Math.max(w.min ? 6 : 2, (w.min / maxWeek) * 100)}px`, opacity: w.min ? 1 : 0.25 }} />
                  <div className={`text-xs ${w.today ? 'font-bold' : 'text-ink-soft'}`}>{w.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title={month.title}
          action={
            <div className="flex">
              <button className="icon-btn h-9 w-9" aria-label="Poprzedni miesiąc" onClick={() => setMonthOffset((m) => m - 1)}><ChevronLeft size={18} /></button>
              <button className="icon-btn h-9 w-9" aria-label="Następny miesiąc" disabled={monthOffset >= 0} onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}><ChevronRight size={18} /></button>
            </div>
          }
        >
          <div className="card p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-soft">
              {WEEKDAYS_PL.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {month.cells.map((c, i) => (
                <div key={i} className="flex aspect-square items-center justify-center">
                  {c && (
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${days.has(c.key) ? 'bg-sage-deep font-semibold text-paper' : c.key === dayKey(Date.now()) ? 'ring-1 ring-ink/30' : 'text-ink-2'}`}>
                      {c.day}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Kamienie milowe">
          <div className="flex flex-wrap gap-2">
            {MILESTONES.map((m) => {
              const v = m.kind === 'sessions' ? history.length : m.kind === 'minutes' ? totalMin : learnedCount;
              const ok = m.test(v);
              return (
                <span key={m.id} className={`rounded-full px-3 py-2 text-sm ${ok ? 'bg-[#f1e6cc] font-semibold text-[#6d5527]' : 'bg-mist text-ink-soft'}`}>
                  {ok ? '✓ ' : ''}{m.label}
                </span>
              );
            })}
          </div>
        </Section>

        {(goals.length > 0 || poseCounts.length > 0) && (
          <Section title="Twoje preferencje">
            <div className="grid gap-3 sm:grid-cols-2">
              {goals.length > 0 && (
                <div className="card p-4">
                  <div className="eyebrow mb-2">Najczęstsze cele</div>
                  <ul className="space-y-1">{goals.map(([g, n]) => <li key={g} className="flex justify-between"><span>{GOAL_LABELS[g as keyof typeof GOAL_LABELS]}</span><span className="text-ink-soft">{n}×</span></li>)}</ul>
                </div>
              )}
              {poseCounts.length > 0 && (
                <div className="card p-4">
                  <div className="eyebrow mb-2">Najczęściej ćwiczone</div>
                  <ul className="space-y-1">{poseCounts.map(([p, n]) => <li key={p} className="flex justify-between"><Link to={`/pose/${p}`}>{getPose(p)?.namePL}</Link><span className="text-ink-soft">{n}×</span></li>)}</ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {favorites.length > 0 && (
          <Section title="Ulubione pozycje">
            <div className="flex flex-wrap gap-2">
              {favorites.map((id) => <Link key={id} to={`/pose/${id}`} className="chip">{getPose(id)?.namePL}</Link>)}
            </div>
          </Section>
        )}

        <Section title="Notatki o mobilności">
          <div className="card p-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Np. „Dziś łatwiej było mi dosięgnąć klocka w trójkącie”."
              className="h-24 w-full resize-none rounded-2xl border border-ink/10 bg-paper p-3 text-[0.95rem] outline-none focus:border-sage"
              aria-label="Nowa notatka"
            />
            <button className="btn-secondary mt-2 h-11 min-h-0" disabled={!note.trim()} onClick={() => { addNote(note.trim()); setNote(''); }}>Zapisz notatkę</button>
            <ul className="mt-3 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 rounded-2xl bg-paper p-3 text-sm">
                  <div className="flex-1">
                    <div className="text-xs text-ink-soft">{new Date(n.date).toLocaleDateString('pl-PL')}</div>
                    {n.text}
                  </div>
                  <button className="icon-btn h-8 w-8" aria-label="Usuń notatkę" onClick={() => removeNote(n.id)}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Historia">
          {history.length === 0 ? (
            <p className="text-ink-soft">Tu pojawią się Twoje praktyki.</p>
          ) : (
            <ul className="space-y-2" data-testid="history">
              {history.slice(0, 30).map((h) => (
                <li key={h.id} className="card flex items-center justify-between p-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{h.title}</div>
                    <div className="text-ink-soft">{new Date(h.date).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}{h.feeling ? ` · ${h.feeling}` : ''}</div>
                  </div>
                  <div className="shrink-0 pl-3 text-right">
                    <div className="font-display text-lg">{Math.round(h.seconds / 60)} min</div>
                    {!h.completed && <div className="text-[11px] text-ink-soft">przerwana</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
