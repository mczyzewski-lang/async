import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { BodyArea, Difficulty, Equipment, GoalId, PoseCategory, YogaPose } from '@/content/types';
import { POSES, getPose } from '@/content/poses';
import { AREA_LABELS, CATEGORY_LABELS, DIFFICULTY_LABELS, EQUIPMENT_LABELS, GOAL_LABELS } from '@/engine/labels';
import { PoseCard } from '@/components/PoseCard';
import { Chip, PageHeader, Section, Sheet } from '@/components/ui';
import { useProgress } from '@/store/stores';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

const POSITION_GROUPS: Array<{ id: string; label: string; cats: PoseCategory[] }> = [
  { id: 'standing', label: 'Stojące', cats: ['standing', 'balance'] },
  { id: 'seated', label: 'Siedzące', cats: ['seated', 'kneeling'] },
  { id: 'floor', label: 'Na podłodze', cats: ['supine', 'prone', 'allfours'] },
  { id: 'restorative', label: 'Regenerujące', cats: ['restorative', 'breathing'] },
];

const DURATIONS: Array<{ id: string; label: string; test: (p: YogaPose) => boolean }> = [
  { id: 'short', label: 'Do 30 s', test: (p) => p.duration.typical <= 30 },
  { id: 'mid', label: '30–60 s', test: (p) => p.duration.typical > 30 && p.duration.typical <= 60 },
  { id: 'long', label: 'Ponad minutę', test: (p) => p.duration.typical > 60 },
];

interface Filters {
  difficulty: Difficulty[];
  areas: BodyArea[];
  categories: PoseCategory[];
  goals: GoalId[];
  group: string | null;
  duration: string | null;
  equipment: Equipment[];
  only3D: boolean;
  favorites: boolean;
  recent: boolean;
}

const EMPTY: Filters = { difficulty: [], areas: [], categories: [], goals: [], group: null, duration: null, equipment: [], only3D: false, favorites: false, recent: false };

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [f, setF] = useState<Filters>(() => ({ ...EMPTY, only3D: params.get('3d') === '1' }));
  const [open, setOpen] = useState(false);
  const favorites = useProgress((s) => s.favorites);
  const recent = useProgress((s) => s.recent);
  const learned = useProgress((s) => s.learned);

  const results = useMemo(() => {
    const nq = norm(q.trim());
    return POSES.filter((p) => {
      if (nq && ![p.namePL, p.nameEN, p.nameSanskrit ?? '', p.id].some((n) => norm(n).includes(nq))) return false;
      if (f.difficulty.length && !f.difficulty.includes(p.difficulty)) return false;
      if (f.areas.length && !f.areas.some((a) => p.targetAreas.includes(a))) return false;
      const cats = [p.category, ...(p.secondaryCategories ?? [])];
      if (f.categories.length && !f.categories.some((c) => cats.includes(c))) return false;
      if (f.goals.length && !f.goals.some((g) => p.goals.includes(g) || (p.session?.goals[g] ?? 0) >= 2)) return false;
      if (f.group && !POSITION_GROUPS.find((g) => g.id === f.group)!.cats.some((c) => cats.includes(c))) return false;
      if (f.duration && !DURATIONS.find((d) => d.id === f.duration)!.test(p)) return false;
      if (f.equipment.length && !f.equipment.some((e) => p.equipment.includes(e))) return false;
      if (f.only3D && !p.animation) return false;
      if (f.favorites && !favorites.includes(p.id)) return false;
      if (f.recent && !recent.includes(p.id) && !learned[p.id]) return false;
      return true;
    }).sort((a, b) => Number(!!b.animation) - Number(!!a.animation));
  }, [q, f, favorites, recent, learned]);

  const activeCount =
    f.difficulty.length + f.areas.length + f.categories.length + f.goals.length + f.equipment.length + (f.group ? 1 : 0) + (f.duration ? 1 : 0);
  const recentPoses = recent.map((id) => getPose(id)).filter(Boolean) as YogaPose[];

  return (
    <div>
      <PageHeader title="Pozycje" subtitle={`${POSES.length} pozycji · ${POSES.filter((p) => p.animation).length} z demonstracją 3D`} />
      <div className="safe-x">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft" size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setParams(e.target.value ? { q: e.target.value } : {}, { replace: true });
            }}
            placeholder="Szukaj po polsku, angielsku lub w sanskrycie"
            aria-label="Szukaj pozycji"
            className="h-12 w-full rounded-full border border-ink/10 bg-mist pr-4 pl-11 text-[0.95rem] outline-none focus:border-sage"
            data-testid="search"
          />
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={open || activeCount > 0} onClick={() => setOpen(true)} testId="open-filters">
            <SlidersHorizontal size={16} /> Filtry{activeCount ? ` (${activeCount})` : ''}
          </Chip>
          <Chip active={f.only3D} onClick={() => setF({ ...f, only3D: !f.only3D })} testId="filter-3d">Z demonstracją 3D</Chip>
          {POSITION_GROUPS.map((g) => (
            <Chip key={g.id} active={f.group === g.id} onClick={() => setF({ ...f, group: f.group === g.id ? null : g.id })}>
              {g.label}
            </Chip>
          ))}
          <Chip active={f.favorites} onClick={() => setF({ ...f, favorites: !f.favorites })}>Ulubione</Chip>
          <Chip active={f.recent} onClick={() => setF({ ...f, recent: !f.recent })}>Ostatnio poznane</Chip>
        </div>

        {!q && activeCount === 0 && !f.favorites && !f.recent && recentPoses.length > 0 && (
          <Section title="Ostatnio oglądane">
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
              {recentPoses.slice(0, 8).map((p) => (
                <div key={p.id} className="w-32 shrink-0">
                  <PoseCard pose={p} compact />
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title={q || activeCount ? `Wyniki (${results.length})` : 'Wszystkie pozycje'}>
          {results.length === 0 ? (
            <div className="card p-6 text-center text-ink-soft">
              Brak pozycji dla tych kryteriów.
              <button className="mt-3 block w-full font-semibold text-sage-deep" onClick={() => { setF(EMPTY); setQ(''); }}>Wyczyść filtry</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="pose-grid">
              {results.map((p) => (
                <PoseCard key={p.id} pose={p} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Filtry" testId="filters-sheet">
        <FilterGroup title="Poziom">
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
            <Chip key={d} active={f.difficulty.includes(d)} onClick={() => setF({ ...f, difficulty: toggle(f.difficulty, d) })}>{DIFFICULTY_LABELS[d]}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Cel">
          {(Object.keys(GOAL_LABELS) as GoalId[]).map((g) => (
            <Chip key={g} active={f.goals.includes(g)} onClick={() => setF({ ...f, goals: toggle(f.goals, g) })}>{GOAL_LABELS[g]}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Obszar ciała">
          {(Object.keys(AREA_LABELS) as BodyArea[]).map((a) => (
            <Chip key={a} active={f.areas.includes(a)} onClick={() => setF({ ...f, areas: toggle(f.areas, a) })}>{AREA_LABELS[a]}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Rodzaj ruchu">
          {(Object.keys(CATEGORY_LABELS) as PoseCategory[]).map((c) => (
            <Chip key={c} active={f.categories.includes(c)} onClick={() => setF({ ...f, categories: toggle(f.categories, c) })}>{CATEGORY_LABELS[c]}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Czas trwania">
          {DURATIONS.map((d) => (
            <Chip key={d.id} active={f.duration === d.id} onClick={() => setF({ ...f, duration: f.duration === d.id ? null : d.id })}>{d.label}</Chip>
          ))}
        </FilterGroup>
        <FilterGroup title="Akcesoria">
          {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).filter((e) => e !== 'mat').map((e) => (
            <Chip key={e} active={f.equipment.includes(e)} onClick={() => setF({ ...f, equipment: toggle(f.equipment, e) })}>{EQUIPMENT_LABELS[e]}</Chip>
          ))}
        </FilterGroup>
        <div className="sticky bottom-0 flex gap-2 bg-mist py-4">
          <button className="btn-secondary flex-1" onClick={() => setF(EMPTY)}><X size={16} /> Wyczyść</button>
          <button className="btn-primary flex-1" onClick={() => setOpen(false)}>Pokaż {results.length}</button>
        </div>
      </Sheet>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h4 className="eyebrow mb-2">{title}</h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
