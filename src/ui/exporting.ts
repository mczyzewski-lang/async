import { computeQuantities } from '../engine/quantities';
import { getAnalysis, getLayout, getRuns } from '../engine/solve';
import { captureRef, useStore } from '../store/useStore';

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

export function buildExport() {
  const { config } = useStore.getState();
  const layout = getLayout(config.room, config.stair);
  const runs = getRuns(layout, config.room, config.railing.outer, config.railing.inner, config.railing.landing, config.railing.openingGuard);
  const analysis = getAnalysis(layout, config);
  return {
    app: 'Stair Studio',
    format: 'stair-studio/config',
    version: config.version,
    exportedAt: new Date().toISOString(),
    units: 'm',
    disclaimer: 'Koncepcja wizualizacyjna — nie zastępuje obliczeń konstruktora ani dokumentacji wykonawczej.',
    config,
    computed: {
      riserCount: analysis.riserCount,
      riserHeight: analysis.riserHeight,
      going: analysis.going,
      treadDepth: analysis.treadDepth,
      blondel: analysis.blondel,
      angleDeg: analysis.angleDeg,
      flights: layout.flights.map((f) => ({ risers: f.risers, treads: f.treads, run: f.run, baseY: f.baseY, topY: f.topY, dir: f.dir })),
      landings: layout.landings.map((l) => ({ rect: l.rect, elevation: l.topY })),
      footprint: analysis.footprint,
      footprintSize: analysis.footprintSize,
      clearances: analysis.clearances,
      headroomMin: analysis.headroomMin,
      opening: layout.opening.rect,
      status: analysis.status,
      issues: analysis.issues,
    },
    quantities: computeQuantities(layout, config, runs),
  };
}

export function exportJSON() {
  const data = buildExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(`stair-studio-${stamp()}.json`, url);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  useStore.getState().notify('Wyeksportowano konfigurację JSON', 'ok');
}

export function exportPNG() {
  const cap = captureRef.current;
  if (!cap) return;
  download(`stair-studio-${stamp()}.png`, cap());
  useStore.getState().notify('Zapisano zrzut wizualizacji PNG', 'ok');
}

export async function importJSON(file: File) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const cfg = data.config ?? data;
    if (!cfg.room || !cfg.stair) throw new Error('bad');
    useStore.getState().setConfig(cfg);
    useStore.getState().notify('Wczytano konfigurację z pliku', 'ok');
  } catch {
    useStore.getState().notify('Nieprawidłowy plik konfiguracji', 'error');
  }
}
