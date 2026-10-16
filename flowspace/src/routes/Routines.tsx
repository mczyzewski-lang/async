import { Heart, Play, Trash2, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { formatMinutes } from '@/engine/labels';
import { PageHeader } from '@/components/ui';
import { usePractice, useRoutines } from '@/store/stores';

export default function Routines() {
  const nav = useNavigate();
  const { routines, remove, toggleFavorite, rename, active } = useRoutines();
  const setSession = usePractice((s) => s.setSession);
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = [...routines].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.savedAt - a.savedAt);

  return (
    <div>
      <PageHeader title="Zapisane praktyki" back="/practice" />
      <div className="safe-x space-y-3">
        {active && (
          <Link to="/practice/play?resume=1" className="card flex items-center gap-3 border border-sage/40 p-4">
            <Play size={18} className="text-sage-deep" />
            <div className="flex-1">
              <div className="eyebrow">Niedokończona</div>
              <div className="font-semibold">{active.session.titlePL}</div>
            </div>
          </Link>
        )}
        {sorted.length === 0 && (
          <div className="card p-6 text-center text-ink-soft">
            Nie masz jeszcze zapisanych praktyk. Ułóż praktykę i zapisz ją sercem.
            <Link to="/practice" className="btn-primary mt-4">Ułóż praktykę</Link>
          </div>
        )}
        {sorted.map((r) => (
          <div key={r.id} className="card p-4" data-testid="routine">
            <div className="flex items-start gap-3">
              <button aria-label={r.favorite ? 'Usuń z ulubionych' : 'Ulubiona'} onClick={() => toggleFavorite(r.id)} className="icon-btn -ml-2 h-10 w-10">
                <Heart size={18} className={r.favorite ? 'fill-coral text-coral' : 'text-ink-soft'} />
              </button>
              <div className="min-w-0 flex-1">
                {editing === r.id ? (
                  <input
                    autoFocus
                    defaultValue={r.name}
                    aria-label="Nazwa praktyki"
                    className="w-full rounded-xl border border-ink/10 bg-paper px-3 py-2"
                    onBlur={(e) => { rename(r.id, e.target.value || r.name); setEditing(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <div className="font-semibold leading-snug">{r.name}</div>
                )}
                <div className="text-sm text-ink-soft">
                  {formatMinutes(r.session.totalSeconds)} · {new Set(r.session.steps.map((s) => s.poseId)).size} pozycji
                  {r.lastPlayed ? ` · ostatnio ${new Date(r.lastPlayed).toLocaleDateString('pl-PL')}` : ''}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary h-11 min-h-0 flex-1 text-sm" onClick={() => { setSession(r.session, r.id); nav('/practice/preview'); }}>
                <Play size={16} /> Otwórz
              </button>
              <button className="btn-secondary h-11 min-h-0 px-4" aria-label="Zmień nazwę" onClick={() => setEditing(r.id)}><Pencil size={16} /></button>
              <button className="btn-secondary h-11 min-h-0 px-4" aria-label="Usuń" onClick={() => remove(r.id)}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
