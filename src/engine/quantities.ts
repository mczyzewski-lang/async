/**
 * Quantity take-off (bill-of-materials basis). Deliberately price-free:
 * a cost module can map these line items to prices later.
 */
import { railingById, structureById, woodById } from './catalog';
import type { FullLayout } from './layout';
import { rectD, rectW } from './math';
import type { Config, RailingRun } from './types';

export interface QuantityLine {
  group: 'drewno' | 'stal' | 'balustrada' | 'montaż';
  item: string;
  qty: number;
  unit: 'szt.' | 'm' | 'm²';
  note?: string;
}

const runLength = (r: RailingRun) => {
  let L = 0;
  for (let i = 0; i < r.points.length - 1; i++) {
    const a = r.points[i];
    const b = r.points[i + 1];
    L += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return L;
};

export function computeQuantities(layout: FullLayout, config: Config, runs: RailingRun[]): QuantityLine[] {
  const { stair, structure, treads, railing } = config;
  const out: QuantityLine[] = [];
  const wood = woodById(treads.wood).name;
  const nTreads = layout.flights.reduce((s, f) => s + f.treads, 0);
  const tw = stair.flightWidth;
  const td = stair.going + stair.nosing;
  out.push({ group: 'drewno', item: `Stopnica ${wood} ${Math.round(tw * 100)} × ${Math.round(td * 100)} × ${(stair.treadThickness * 100).toFixed(1)} cm`, qty: nTreads, unit: 'szt.' });
  layout.landings.forEach((l, i) =>
    out.push({ group: 'drewno', item: `Płyta spocznika ${i + 1} — ${wood}`, qty: +(rectW(l.rect) * rectD(l.rect)).toFixed(2), unit: 'm²', note: `${Math.round(rectW(l.rect) * 100)} × ${Math.round(rectD(l.rect) * 100)} cm` }),
  );
  if (structure.risers === 'closed' && structureById(structure.type).risers.includes('closed') && structure.type !== 'D') {
    const nR = layout.flights.reduce((s, f) => s + (f.topOn === 'slab' ? f.treads : f.risers), 0);
    out.push({ group: 'drewno', item: 'Podstopnica drewniana', qty: nR, unit: 'szt.' });
  }
  const slope = (f: (typeof layout.flights)[number]) => Math.hypot(f.run, f.topY - f.baseY);
  const sm = structureById(structure.type);
  const stringerLen = layout.flights.reduce((s, f) => s + slope(f), 0);
  switch (structure.type) {
    case 'A':
      out.push({ group: 'stal', item: 'Belka centralna — profil zamknięty 200×120', qty: +stringerLen.toFixed(2), unit: 'm' });
      out.push({ group: 'stal', item: 'Wspornik stopnicy (żebro + płaskownik)', qty: nTreads, unit: 'szt.' });
      break;
    case 'B':
      out.push({ group: 'stal', item: 'Policzek boczny — blacha 12 mm, h 260', qty: +(stringerLen * 2).toFixed(2), unit: 'm' });
      out.push({ group: 'stal', item: 'Kątownik wsporczy stopnicy', qty: nTreads * 2, unit: 'szt.' });
      break;
    case 'C':
      out.push({ group: 'stal', item: 'Policzek zygzakowy — blacha 18 mm', qty: +(stringerLen * 2).toFixed(2), unit: 'm' });
      break;
    case 'D': {
      const dev = layout.flights.reduce((s, f) => s + f.treads * f.going + f.risers * f.riserHeight, 0);
      out.push({ group: 'stal', item: 'Blacha gięta 10 mm (rozwinięcie)', qty: +(dev * tw).toFixed(2), unit: 'm²' });
      out.push({ group: 'stal', item: 'Żebro usztywniające', qty: +(stringerLen * 2).toFixed(2), unit: 'm' });
      break;
    }
    case 'E':
      out.push({ group: 'stal', item: 'Podłużnica — profil 100×50', qty: +(stringerLen * 2).toFixed(2), unit: 'm' });
      out.push({ group: 'stal', item: 'Rama stopnicy — profil 30×30', qty: +(nTreads * (2 * tw + 2 * td)).toFixed(2), unit: 'm' });
      break;
  }
  if (layout.landings.length) {
    const perim = layout.landings.reduce((s, l) => s + 2 * (rectW(l.rect) + rectD(l.rect)), 0);
    out.push({ group: 'stal', item: 'Rama spocznika', qty: +perim.toFixed(2), unit: 'm' });
    const posts = structure.landingSupport === 'posts2' ? 2 : structure.landingSupport === 'posts4' ? 4 : 0;
    if (posts) out.push({ group: 'stal', item: 'Słup podporowy spocznika', qty: posts * layout.landings.length, unit: 'szt.' });
    else if (structure.landingSupport === 'cantilever')
      out.push({ group: 'stal', item: 'Spocznik samonośny — rama skrzynkowa zespolona z belkami biegów', qty: 1, unit: 'szt.', note: 'bez słupów; wymaga obliczeń statycznych' });
    else out.push({ group: 'montaż', item: 'Kotwienie spocznika do ściany', qty: 1, unit: 'szt.', note: 'wymaga ściany nośnej' });
  }
  if (structure.type === 'E') {
    const extra = layout.flights.filter((f) => f.run > 1.6).length * 2;
    if (extra) out.push({ group: 'stal', item: 'Słup pośredni biegu', qty: extra, unit: 'szt.' });
  }
  out.push({ group: 'montaż', item: 'Kotwienie do posadzki i czoła stropu', qty: layout.flights.length + 1, unit: 'szt.', note: sm.supportNote });

  const rm = railingById(railing.type);
  const rail = runs.filter((r) => r.kind === 'railing' && r.side !== 'guard').reduce((s, r) => s + runLength(r), 0);
  const guard = runs.filter((r) => r.side === 'guard').reduce((s, r) => s + runLength(r), 0);
  const wall = runs.filter((r) => r.kind === 'wall').reduce((s, r) => s + runLength(r), 0);
  if (rail > 0) out.push({ group: 'balustrada', item: `Balustrada schodowa — ${rm.name}`, qty: +rail.toFixed(2), unit: 'm' });
  if (guard > 0) out.push({ group: 'balustrada', item: `Balustrada przy otworze — ${rm.name}`, qty: +guard.toFixed(2), unit: 'm' });
  if (rail + guard > 0)
    out.push({ group: 'balustrada', item: `Pochwyt ${railing.handrailMaterial === 'wood' ? 'drewniany' : 'stalowy'}`, qty: +(rail + guard).toFixed(2), unit: 'm' });
  if (wall > 0) out.push({ group: 'balustrada', item: 'Pochwyt przyścienny Ø42 z uchwytami', qty: +wall.toFixed(2), unit: 'm' });
  return out;
}
