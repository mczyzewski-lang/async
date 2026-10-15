import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Download, FileJson, Image as ImageIcon, RotateCcw, Save, Upload } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { autoRiserCount } from '../engine/calc';
import { FINISHES, RAILINGS, STEELS, STRUCTURES, WOODS, railingById, structureById, type SupportCategory } from '../engine/catalog';
import { cm } from '../engine/math';
import { computeQuantities } from '../engine/quantities';
import type { EntryDir, RailingType, SideMode, StairShape, StructureType } from '../engine/types';
import { useAnalysis, useLayout, useRuns } from '../store/derived';
import { useStore } from '../store/useStore';
import { getWoodTextures } from '../three/textures';
import { Card, Label, NumberField, Pill, Segmented, Swatch, Toggle, cx } from './controls';
import { exportJSON, exportPNG, importJSON } from './exporting';
import { RailingThumb, ShapeThumb, StructureThumb } from './thumbs';

const SHAPES: { id: StairShape; name: string; sub: string }[] = [
  { id: 'I', name: 'Proste', sub: 'jeden bieg' },
  { id: 'L', name: 'L — 90°', sub: 'spocznik narożny' },
  { id: 'U', name: 'U — 180°', sub: 'dwa biegi' },
];

// ---------------------------------------------------------------------------
export function ShapeSection() {
  const stair = useStore((s) => s.config.stair);
  const setStair = useStore((s) => s.setStair);
  const analysis = useAnalysis();
  const N = analysis.riserCount;
  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        {SHAPES.map((s) => (
          <Card
            key={s.id}
            selected={stair.shape === s.id}
            onClick={() => setStair({ shape: s.id, landingDepth: Math.max(stair.landingDepth, stair.flightWidth) })}
            className="p-2.5"
          >
            <div className={cx('mx-auto aspect-square w-full', stair.shape === s.id ? 'text-ink' : 'text-muted')}>
              <ShapeThumb shape={s.id} />
            </div>
            <div className="mt-1.5 text-[12.5px] font-medium">{s.name}</div>
            <div className="text-[10.5px] text-faint">{s.sub}</div>
          </Card>
        ))}
      </div>
      {stair.shape !== 'I' && (
        <>
          <div>
            <Label>{stair.shape === 'L' ? 'Kierunek skrętu' : 'Kierunek zawrotu'}</Label>
            <Segmented
              value={stair.turn}
              onChange={(turn) => setStair({ turn })}
              options={[
                { value: 'left', label: 'W lewo' },
                { value: 'right', label: 'W prawo' },
              ]}
            />
          </div>
          <div>
            <Label hint={`${analysis.flightsRisers.join(' + ')} stopni`}>Podział stopni</Label>
            <Segmented
              value={stair.splitMode}
              onChange={(splitMode) => setStair({ splitMode, split: analysis.flightsRisers[0] })}
              options={[
                { value: 'auto', label: 'Automatyczny' },
                { value: 'manual', label: 'Ręczny' },
              ]}
            />
            {stair.splitMode === 'manual' && (
              <div className="mt-3">
                <NumberField
                  label="Stopnie w 1. biegu"
                  unit="st."
                  scale={1}
                  value={analysis.flightsRisers[0]}
                  min={2}
                  max={Math.max(3, N - 2)}
                  onChange={(v) => setStair({ split: Math.round(v) })}
                  hint={`Bieg 2: ${N - analysis.flightsRisers[0]} stopni · spocznik na ${cm(analysis.landingElevations[0] ?? 0)} cm`}
                />
              </div>
            )}
          </div>
          <NumberField
            label="Głębokość spocznika"
            value={stair.landingDepth}
            min={60}
            max={200}
            onChange={(v) => setStair({ landingDepth: v })}
            hint={`Zalecane ≥ szerokość biegu (${cm(stair.flightWidth)} cm)`}
          />
          {stair.shape === 'U' && (
            <NumberField label="Odstęp między biegami" value={stair.gap} min={6} max={80} onChange={(v) => setStair({ gap: v })} />
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
const ENTRY: { id: EntryDir; label: string; icon: typeof ArrowUp }[] = [
  { id: 'back', label: 'Do tyłu', icon: ArrowUp },
  { id: 'front', label: 'Do przodu', icon: ArrowDown },
  { id: 'left', label: 'W lewo', icon: ArrowLeft },
  { id: 'right', label: 'W prawo', icon: ArrowRight },
];

export function DimensionsSection() {
  const room = useStore((s) => s.config.room);
  const stair = useStore((s) => s.config.stair);
  const setRoom = useStore((s) => s.setRoom);
  const setStair = useStore((s) => s.setStair);
  const setPlacement = useStore((s) => s.setPlacement);
  const setOpening = useStore((s) => s.setOpening);
  const analysis = useAnalysis();
  const layout = useLayout();
  const pl = stair.placement;
  const autoN = autoRiserCount(room.height, stair.targetRiser);
  return (
    <>
      <div className="space-y-4">
        <NumberField label="Wysokość kondygnacji" value={room.height} min={250} max={450} onChange={(height) => setRoom({ height })} hint="od posadzki parteru do posadzki piętra" />
        <NumberField label="Szerokość przestrzeni" value={room.width} min={150} max={600} onChange={(width) => setRoom({ width })} />
        <NumberField label="Głębokość przestrzeni" value={room.depth} min={200} max={900} onChange={(depth) => setRoom({ depth })} />
        <NumberField label="Grubość stropu" value={room.slabThickness} min={15} max={45} onChange={(slabThickness) => setRoom({ slabThickness })} />
        <NumberField label="Grubość ścian" value={room.wallThickness} min={10} max={50} onChange={(wallThickness) => setRoom({ wallThickness })} />
      </div>
      <div>
        <Label hint="wyłącz dla przestrzeni otwartej">Ściany konstrukcyjne</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {(['back', 'left', 'right', 'front'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setRoom({ walls: { ...room.walls, [k]: !room.walls[k] } })}
              className={cx(
                'rounded-lg border py-1.5 text-[11.5px] font-medium transition-colors',
                room.walls[k] ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-muted hover:text-ink',
              )}
            >
              {{ back: 'Tył', left: 'Lewa', right: 'Prawa', front: 'Przód' }[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="h-px bg-line" />
      <div className="space-y-4">
        <NumberField label="Szerokość biegu schodów" value={stair.flightWidth} min={80} max={130} onChange={(flightWidth) => setStair({ flightWidth })} />
        <NumberField
          label="Głębokość stopnia (krok)"
          value={stair.going}
          min={22}
          max={34}
          step={0.5}
          decimals={1}
          onChange={(going) => setStair({ going })}
          hint={`Stopnica z nosem: ${cm(stair.going + stair.nosing, 1)} cm · 2h + s = ${cm(analysis.blondel, 1)} cm`}
        />
        <div>
          <Label hint={`${analysis.riserCount} × ${cm(analysis.riserHeight, 1)} cm`}>Liczba stopni</Label>
          <Segmented
            value={stair.riserCountMode}
            onChange={(riserCountMode) => setStair({ riserCountMode, riserCount: analysis.riserCount })}
            options={[
              { value: 'auto', label: 'Automatycznie' },
              { value: 'manual', label: 'Ręcznie' },
            ]}
          />
          <div className="mt-3">
            {stair.riserCountMode === 'manual' ? (
              <NumberField label="Liczba stopni" unit="st." scale={1} value={stair.riserCount} min={10} max={30} onChange={(v) => setStair({ riserCount: Math.round(v) })} hint={`Automatycznie: ${autoN}`} />
            ) : (
              <NumberField label="Preferowana wysokość stopnia" value={stair.targetRiser} min={15} max={19.5} step={0.5} decimals={1} onChange={(targetRiser) => setStair({ targetRiser })} />
            )}
          </div>
        </div>
      </div>
      <div className="h-px bg-line" />
      <div>
        <Label>Kierunek wejścia na schody</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {ENTRY.map((e) => (
            <button
              key={e.id}
              onClick={() => setPlacement({ entry: e.id })}
              className={cx(
                'flex flex-col items-center gap-1 rounded-xl border py-2 text-[10.5px] font-medium transition-colors',
                pl.entry === e.id ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-muted hover:text-ink',
              )}
            >
              <e.icon size={14} strokeWidth={1.8} />
              {e.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label hint={`L ${cm(analysis.clearances.left)} · P ${cm(analysis.clearances.right)} cm`}>Położenie w poziomie</Label>
        <Segmented
          size="sm"
          value={pl.alignX}
          onChange={(alignX) => setPlacement({ alignX, offsetX: analysis.footprint.minX })}
          options={[
            { value: 'start', label: 'Lewa' },
            { value: 'center', label: 'Środek' },
            { value: 'end', label: 'Prawa' },
            { value: 'manual', label: 'Ręcznie' },
          ]}
        />
      </div>
      <div>
        <Label hint={`T ${cm(analysis.clearances.back)} · P ${cm(analysis.clearances.front)} cm`}>Położenie w głąb</Label>
        <Segmented
          size="sm"
          value={pl.alignZ}
          onChange={(alignZ) => setPlacement({ alignZ, offsetZ: layout.footprint.minZ })}
          options={[
            { value: 'start', label: 'Tył' },
            { value: 'center', label: 'Środek' },
            { value: 'end', label: 'Przód' },
            { value: 'manual', label: 'Ręcznie' },
          ]}
        />
      </div>
      {pl.alignX === 'manual' && (
        <NumberField label="Odległość od lewej ściany" value={pl.offsetX} min={-50} max={600} onChange={(offsetX) => setPlacement({ offsetX })} />
      )}
      {pl.alignZ === 'manual' && (
        <NumberField label="Odległość od tylnej ściany" value={pl.offsetZ} min={-50} max={900} onChange={(offsetZ) => setPlacement({ offsetZ })} />
      )}
      {(pl.alignX === 'start' || pl.alignX === 'end' || pl.alignZ === 'start' || pl.alignZ === 'end') && (
        <NumberField label="Odstęp od ścian" value={pl.wallGap} min={0} max={60} onChange={(wallGap) => setPlacement({ wallGap })} />
      )}
      <div className="h-px bg-line" />
      <div>
        <Label hint={`${cm(layout.opening.rect.maxX - layout.opening.rect.minX)} × ${cm(layout.opening.rect.maxZ - layout.opening.rect.minZ)} cm`}>Otwór w stropie</Label>
        <Segmented
          value={stair.opening.mode}
          onChange={(mode) => setOpening({ mode, length: layout.opening.length, width: layout.opening.width })}
          options={[
            { value: 'auto', label: 'Automatyczny' },
            { value: 'manual', label: 'Ręczny' },
          ]}
        />
        {stair.opening.mode === 'manual' && (
          <div className="mt-3 space-y-4">
            <NumberField label="Długość otworu" value={stair.opening.length} min={80} max={900} onChange={(length) => setOpening({ length })} hint={`Minimalna dla prześwitu 200 cm: ${cm(layout.opening.autoLength)} cm`} />
            <NumberField label="Szerokość otworu" value={stair.opening.width} min={60} max={600} onChange={(width) => setOpening({ width })} />
          </div>
        )}
        <div className="mt-2 text-[11px] text-faint">
          Prześwit nad stopniami: {analysis.headroomMin === null ? 'pełny (schody w otworze)' : `${cm(analysis.headroomMin)} cm`}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
const SUPPORT_LABEL: Record<SupportCategory, { text: string; tone: 'ok' | 'warn' | 'accent' }> = {
  freestanding: { text: 'Wolnostojąca', tone: 'ok' },
  posts: { text: 'Wymaga słupów', tone: 'accent' },
  wall: { text: 'Może wymagać ściany', tone: 'warn' },
};

export function StructureSection() {
  const structure = useStore((s) => s.config.structure);
  const shape = useStore((s) => s.config.stair.shape);
  const setStructure = useStore((s) => s.setStructure);
  const sm = structureById(structure.type);
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {STRUCTURES.map((s) => (
          <Card
            key={s.id}
            selected={structure.type === s.id}
            onClick={() => setStructure({ type: s.id as StructureType, risers: s.risers.includes(structure.risers) ? structure.risers : s.risers[0] })}
            className="p-3"
          >
            <div className={cx('h-14', structure.type === s.id ? 'text-ink' : 'text-ink-2')}>
              <StructureThumb type={s.id} />
            </div>
            <div className="mt-2 text-[12.5px] font-medium leading-tight">{s.name}</div>
            <div className="mt-1.5">
              <Pill tone={SUPPORT_LABEL[s.support].tone}>{SUPPORT_LABEL[s.support].text}</Pill>
            </div>
          </Card>
        ))}
      </div>
      <div className="rounded-xl bg-sand px-3.5 py-3">
        <div className="text-[12.5px] text-ink-2">{sm.description}</div>
        <div className="mt-1.5 text-[11.5px] text-muted">{sm.supportNote}</div>
      </div>
      {shape !== 'I' && (
        <div>
          <Label>Podparcie spocznika</Label>
          <Segmented
            size="sm"
            value={structure.landingSupport}
            onChange={(landingSupport) => setStructure({ landingSupport })}
            options={[
              { value: 'cantilever', label: 'Bez słupów' },
              { value: 'posts4', label: '4 słupy' },
              { value: 'posts2', label: 'Rama + 2 słupy' },
              { value: 'wall', label: 'Do ściany' },
            ]}
          />
          <div className="mt-1.5 text-[11px] text-faint">
            {structure.landingSupport === 'cantilever' &&
              'Spocznik samonośny: sztywna rama skrzynkowa przedłuża belki biegów, całość kotwiona tylko w posadzce i stropie. Pod spocznikiem wolna przestrzeń.'}
            {structure.landingSupport === 'posts4' && 'Spocznik na własnej ramie z czterema słupami — konstrukcja wolnostojąca.'}
            {structure.landingSupport === 'posts2' && 'Rama spocznika zespolona z biegami, dwa słupy przy krawędzi zewnętrznej.'}
            {structure.landingSupport === 'wall' && 'Kotwienie do przylegającej ściany nośnej; słupy tylko przy wolnych narożach.'}
          </div>
        </div>
      )}
      <div className="text-[11px] leading-relaxed text-faint">
        Konstrukcja przedstawia koncepcję podparcia — wymiary profili i kotwienie wymagają obliczeń konstruktora.
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
export function TreadsSection() {
  const treads = useStore((s) => s.config.treads);
  const stair = useStore((s) => s.config.stair);
  const structure = useStore((s) => s.config.structure);
  const setTreads = useStore((s) => s.setTreads);
  const setStair = useStore((s) => s.setStair);
  const setStructure = useStore((s) => s.setStructure);
  const urls = useMemo(() => Object.fromEntries(WOODS.map((w) => [w.id, getWoodTextures(w.id).url])), []);
  const sm = structureById(structure.type);
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {WOODS.map((w) => (
          <button key={w.id} onClick={() => setTreads({ wood: w.id })} className="group text-left" title={w.description}>
            <div
              className={cx(
                'aspect-square w-full rounded-xl bg-cover bg-center transition-all',
                treads.wood === w.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-panel' : 'ring-1 ring-black/5 group-hover:ring-black/20',
              )}
              style={{ backgroundImage: `url(${urls[w.id]})` }}
            />
            <div className={cx('mt-1.5 text-[10.5px] leading-tight', treads.wood === w.id ? 'font-medium text-ink' : 'text-muted')}>{w.name}</div>
          </button>
        ))}
      </div>
      <NumberField label="Grubość stopnicy" value={stair.treadThickness} min={3} max={8} step={0.5} decimals={1} onChange={(treadThickness) => setStair({ treadThickness })} />
      <NumberField label="Wysunięcie noska" value={stair.nosing} min={0} max={4} step={0.5} decimals={1} onChange={(nosing) => setStair({ nosing })} />
      <div>
        <Label>Profil krawędzi</Label>
        <Segmented
          value={treads.edge}
          onChange={(edge) => setTreads({ edge })}
          options={[
            { value: 'straight', label: 'Prosta' },
            { value: 'rounded', label: 'Zaokrąglona' },
          ]}
        />
      </div>
      <div>
        <Label hint={sm.risers.length === 1 ? (sm.risers[0] === 'open' ? 'tylko otwarte w tej konstrukcji' : 'stalowe w tej konstrukcji') : undefined}>Podstopnice</Label>
        <Segmented
          value={sm.risers.includes(structure.risers) ? structure.risers : sm.risers[0]}
          onChange={(risers) => setStructure({ risers })}
          options={[
            { value: 'open', label: 'Otwarte', disabled: !sm.risers.includes('open') },
            { value: 'closed', label: 'Zamknięte', disabled: !sm.risers.includes('closed') },
          ]}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
export function RailingSection() {
  const r = useStore((s) => s.config.railing);
  const shape = useStore((s) => s.config.stair.shape);
  const setRailing = useStore((s) => s.setRailing);
  const analysis = useAnalysis();
  const rm = railingById(r.type);
  const sideLabels = shape === 'I' ? { outer: 'Lewa strona', inner: 'Prawa strona' } : { outer: 'Strona zewnętrzna', inner: 'Strona wewnętrzna' };
  const railIssues = analysis.issues.filter((i) => /^(rail|open|wall|landing-open|no-hand)/.test(i.code));
  const sideOpts: { value: SideMode; label: string }[] = [
    { value: 'railing', label: 'Balustrada' },
    { value: 'wall', label: 'Pochwyt ścienny' },
    { value: 'none', label: 'Brak' },
  ];
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {RAILINGS.map((x) => (
          <Card
            key={x.id}
            selected={r.type === x.id}
            onClick={() => setRailing({ type: x.id as RailingType, profile: x.defaultProfile, spacing: x.defaultSpacing, handrailStyle: x.id === 'F' ? 'flat' : r.handrailStyle })}
            className="p-2"
            title={x.description}
          >
            <div className={cx('h-12', r.type === x.id ? 'text-ink' : 'text-ink-2')}>
              <RailingThumb type={x.id} />
            </div>
            <div className="mt-1 text-[11px] font-medium leading-tight">{x.name}</div>
          </Card>
        ))}
      </div>
      <div className="text-[11.5px] text-muted">{rm.description}</div>
      <NumberField label="Wysokość balustrady" value={r.height} min={80} max={120} onChange={(height) => setRailing({ height })} />
      <NumberField
        label={rm.profileLabel}
        value={r.profile}
        scale={1000}
        unit="mm"
        min={rm.profileRange[0] * 1000}
        max={rm.profileRange[1] * 1000}
        onChange={(profile) => setRailing({ profile })}
      />
      {rm.hasSpacing && (
        <NumberField
          label="Rozstaw osiowy"
          value={r.spacing}
          min={rm.spacingRange[0] * 100}
          max={rm.spacingRange[1] * 100}
          step={0.5}
          decimals={1}
          onChange={(spacing) => setRailing({ spacing })}
          hint={`Prześwit: ${cm(r.spacing - r.profile, 1)} cm (zalecane ≤ 12 cm)`}
        />
      )}
      {(['outer', 'inner'] as const).map((side) => (
        <div key={side}>
          <Label>{sideLabels[side]}</Label>
          <Segmented size="sm" value={r[side]} onChange={(v) => setRailing({ [side]: v })} options={sideOpts} />
        </div>
      ))}
      {shape !== 'I' && <Toggle checked={r.landing} onChange={(landing) => setRailing({ landing })} label="Balustrada wokół spocznika" />}
      <Toggle checked={r.openingGuard} onChange={(openingGuard) => setRailing({ openingGuard })} label="Balustrada przy otworze w stropie" hint="na piętrze, poza wyjściem ze schodów" />
      <div>
        <Label>Pochwyt</Label>
        <Segmented
          size="sm"
          value={r.handrailStyle}
          onChange={(handrailStyle) => setRailing({ handrailStyle })}
          options={[
            { value: 'round', label: 'Okrągły' },
            { value: 'rect', label: 'Prostokątny' },
            { value: 'flat', label: 'Płaski' },
          ]}
        />
        <div className="mt-2">
          <Segmented
            size="sm"
            value={r.handrailMaterial}
            onChange={(handrailMaterial) => setRailing({ handrailMaterial })}
            options={[
              { value: 'metal', label: 'Stal' },
              { value: 'wood', label: 'Drewno (jak stopnice)' },
            ]}
          />
        </div>
      </div>
      {railIssues.length > 0 && (
        <div className="space-y-1.5">
          {railIssues.map((i) => (
            <div key={i.code} className="rounded-lg bg-warn-soft px-3 py-2 text-[11.5px] text-warn">
              {i.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function SteelPicker({ color, preset, finish, onPick }: { color: string; preset: string; finish: string; onPick: (p: { color: string; finish?: string; preset: string }) => void }) {
  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        {STEELS.map((s) => (
          <Swatch
            key={s.id}
            color={s.color}
            selected={preset === s.id}
            metallic={s.finish === 'metallic' || s.finish === 'brushed'}
            title={`${s.name}${s.code ? ' — ' + s.code : ''}`}
            onClick={() => onPick({ color: s.color, finish: s.finish, preset: s.id })}
          />
        ))}
        <label
          title="Kolor własny"
          className={cx('relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full', preset === 'custom' && 'ring-2 ring-ink ring-offset-2 ring-offset-panel')}
          style={{ background: 'conic-gradient(from 0deg, #e66, #ec6, #6c6, #6ce, #66e, #e6e, #e66)' }}
        >
          <input type="color" value={color} onChange={(e) => onPick({ color: e.target.value, preset: 'custom' })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
      <div className="mt-2 text-[11.5px] text-muted">
        {STEELS.find((s) => s.id === preset)?.name ?? 'Kolor własny'} {STEELS.find((s) => s.id === preset)?.code ? `· ${STEELS.find((s) => s.id === preset)?.code}` : `· ${color}`}
      </div>
      <div className="mt-3">
        <Segmented size="sm" value={finish} onChange={(f) => onPick({ color, finish: f, preset })} options={FINISHES.map((f) => ({ value: f.id, label: f.name.split(' ')[0] }))} />
      </div>
    </>
  );
}

export function ColorsSection() {
  const structure = useStore((s) => s.config.structure);
  const railing = useStore((s) => s.config.railing);
  const setStructure = useStore((s) => s.setStructure);
  const setRailing = useStore((s) => s.setRailing);
  return (
    <>
      <div>
        <Label>Konstrukcja stalowa</Label>
        <SteelPicker
          color={structure.steelColor}
          preset={structure.steelPreset}
          finish={structure.steelFinish}
          onPick={(p) => setStructure({ steelColor: p.color, steelPreset: p.preset, ...(p.finish ? { steelFinish: p.finish as typeof structure.steelFinish } : {}) })}
        />
      </div>
      <div className="h-px bg-line" />
      <div className="space-y-3">
        <Toggle checked={railing.matchSteel} onChange={(matchSteel) => setRailing({ matchSteel })} label="Balustrada w kolorze konstrukcji" />
        {!railing.matchSteel && (
          <SteelPicker
            color={railing.color}
            preset={railing.colorPreset}
            finish={railing.finish}
            onPick={(p) => setRailing({ color: p.color, colorPreset: p.preset, ...(p.finish ? { finish: p.finish as typeof railing.finish } : {}) })}
          />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
export function LightingSection() {
  const l = useStore((s) => s.config.lighting);
  const setLighting = useStore((s) => s.setLighting);
  return (
    <>
      <div>
        <Label>Pora dnia</Label>
        <Segmented
          value={l.mode}
          onChange={(mode) => setLighting({ mode })}
          options={[
            { value: 'day', label: 'Dzień' },
            { value: 'night', label: 'Wieczór' },
          ]}
        />
      </div>
      <Toggle checked={l.led} onChange={(led) => setLighting({ led })} label="Podświetlenie LED pod stopnicami" hint="ciepła taśma pod noskiem każdego stopnia" />
      {l.led && (
        <>
          <Segmented
            size="sm"
            value={l.ledTemp}
            onChange={(ledTemp) => setLighting({ ledTemp })}
            options={[
              { value: 'warm', label: 'Ciepła 2700 K' },
              { value: 'neutral', label: 'Neutralna 4000 K' },
            ]}
          />
          <NumberField label="Jasność LED" unit="%" scale={100} value={l.ledIntensity} min={20} max={150} step={5} onChange={(ledIntensity) => setLighting({ ledIntensity })} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'err' | 'warn' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-2 py-1.5 text-[12px] last:border-b-0">
      <span className="text-muted">{k}</span>
      <span className={cx('text-right font-medium tabular-nums', tone === 'err' ? 'text-err' : tone === 'warn' ? 'text-warn' : 'text-ink')}>{v}</span>
    </div>
  );
}

export function SummarySection() {
  const config = useStore((s) => s.config);
  const save = useStore((s) => s.save);
  const restore = useStore((s) => s.restore);
  const reset = useStore((s) => s.reset);
  const savedAt = useStore((s) => s.savedAt);
  const analysis = useAnalysis();
  const layout = useLayout();
  const runs = useRuns();
  const q = useMemo(() => computeQuantities(layout, config, runs), [layout, config, runs]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { room, stair, structure, treads, railing } = config;
  const a = analysis;
  return (
    <>
      <div>
        <Label>Przestrzeń</Label>
        <Row k="Wysokość kondygnacji" v={`${cm(room.height)} cm`} />
        <Row k="Przestrzeń (szer. × głęb.)" v={`${cm(room.width)} × ${cm(room.depth)} cm`} />
        <Row k="Grubość stropu" v={`${cm(room.slabThickness)} cm`} />
        <Row k="Otwór w stropie" v={`${cm(layout.opening.rect.maxX - layout.opening.rect.minX)} × ${cm(layout.opening.rect.maxZ - layout.opening.rect.minZ)} cm`} />
      </div>
      <div>
        <Label>Geometria</Label>
        <Row k="Kształt" v={{ I: 'Proste (I)', L: 'L — 90°', U: 'U — 180°' }[stair.shape]} />
        <Row k="Liczba stopni" v={`${a.riserCount} (${a.flightsRisers.join(' + ')})`} />
        <Row k="Wysokość stopnia" v={`${cm(a.riserHeight, 2)} cm`} />
        <Row k="Głębokość stopnia / stopnicy" v={`${cm(a.going, 1)} / ${cm(a.treadDepth, 1)} cm`} />
        <Row k="Wzór Blondela 2h + s" v={`${cm(a.blondel, 1)} cm`} tone={a.blondel < 0.6 || a.blondel > 0.65 ? 'warn' : undefined} />
        <Row k="Kąt nachylenia" v={`${a.angleDeg.toFixed(1).replace('.', ',')}°`} />
        <Row k="Szerokość biegu" v={`${cm(stair.flightWidth)} cm`} />
        {a.flightsRun.map((r, i) => (
          <Row key={i} k={`Długość biegu ${i + 1}`} v={`${a.flightsTreads[i]} × ${cm(a.going, 1)} = ${cm(r)} cm`} />
        ))}
        {a.landingElevations.map((e, i) => (
          <Row key={i} k="Spocznik" v={`${cm(a.landingSizes[i].w)} × ${cm(a.landingSizes[i].d)} cm, na ${cm(e)} cm`} />
        ))}
        <Row
          k="Wyjście na piętro"
          v={(() => {
            const d = layout.flights[layout.flights.length - 1].dir;
            return d.z < -0.5 ? 'w stronę tylnej ściany' : d.z > 0.5 ? 'w stronę przodu' : d.x < -0.5 ? 'w lewo' : 'w prawo';
          })()}
        />
        <Row k="Zajmowana przestrzeń" v={`${cm(a.footprintSize.x)} × ${cm(a.footprintSize.z)} cm`} tone={a.fitsRoom ? undefined : 'err'} />
        <Row k="Odstępy (L / P / T / P)" v={`${cm(a.clearances.left)} / ${cm(a.clearances.right)} / ${cm(a.clearances.back)} / ${cm(a.clearances.front)}`} />
        <Row k="Prześwit nad stopniami" v={a.headroomMin === null ? 'pełny' : `${cm(a.headroomMin)} cm`} tone={a.headroomOk ? undefined : 'err'} />
      </div>
      <div>
        <Label>Wykończenie</Label>
        <Row k="Konstrukcja" v={structureById(structure.type).name} />
        <Row k="Stal" v={`${STEELS.find((s) => s.id === structure.steelPreset)?.name ?? structure.steelColor}`} />
        <Row k="Stopnice" v={`${WOODS.find((w) => w.id === treads.wood)?.name}, ${cm(stair.treadThickness, 1)} cm`} />
        <Row k="Balustrada" v={`${railingById(railing.type).name}, ${cm(railing.height)} cm`} />
      </div>
      <div>
        <Label hint="bez cen">Zestawienie ilościowe</Label>
        {q.map((l, i) => (
          <Row key={i} k={l.item} v={`${String(l.qty).replace('.', ',')} ${l.unit}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ActionButton icon={FileJson} onClick={exportJSON}>
          Eksport JSON
        </ActionButton>
        <ActionButton icon={ImageIcon} onClick={exportPNG}>
          Zrzut PNG
        </ActionButton>
        <ActionButton icon={Save} onClick={save}>
          Zapisz
        </ActionButton>
        <ActionButton icon={Download} onClick={() => restore()}>
          Przywróć zapis
        </ActionButton>
        <ActionButton icon={Upload} onClick={() => fileRef.current?.click()}>
          Wczytaj plik
        </ActionButton>
        <ActionButton icon={RotateCcw} onClick={reset}>
          Domyślne
        </ActionButton>
      </div>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])} />
      {savedAt && <div className="text-[11px] text-faint">Ostatni zapis: {new Date(savedAt).toLocaleString('pl-PL')}</div>}
      <div className="rounded-xl bg-sand px-3.5 py-3 text-[11px] leading-relaxed text-muted">
        Narzędzie koncepcyjne. Obliczenia ergonomiczne (m.in. wzór Blondela) mają charakter orientacyjny i nie stanowią potwierdzenia zgodności z przepisami ani
        obliczeń statycznych — projekt wykonawczy wymaga weryfikacji konstruktora.
      </div>
    </>
  );
}

export function ActionButton({ icon: Icon, children, onClick }: { icon: typeof Save; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-ink hover:text-ink">
      <Icon size={14} strokeWidth={1.7} />
      {children}
    </button>
  );
}
