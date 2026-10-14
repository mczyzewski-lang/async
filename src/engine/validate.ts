/**
 * Fit validation, ergonomic checks and suggestions.
 * Results are ergonomic/geometric guidance only — not a structural or legal certification.
 */
import { analyticSize, blondel, pitchDeg } from './calc';
import { LIMITS, railingById, structureById } from './catalog';
import type { FullLayout } from './layout';
import { cm, emptyRect, expandRect, rectD, rectFromPoints, rectW, unionRect } from './math';
import { computeHeadroom, exitClearance } from './opening';
import { sideInfo } from './railingLayout';
import type { Analysis, Config, Issue, RailingRun } from './types';

const fmt = (m: number) => `${cm(m)} cm`;

export function computeAnalysis(layout: FullLayout, config: Config, runs: RailingRun[]): Analysis {
  const { room, stair, railing, structure } = config;
  const issues: Issue[] = [];
  const suggestions = new Set<string>();
  const h = layout.riserHeight;
  const g = layout.going;
  const N = layout.riserCount;
  const bl = blondel(h, g);
  const ang = pitchDeg(h, g);

  // ---------- footprint incl. railings ----------
  let fp = layout.footprint;
  const railPts = runs.filter((r) => r.side !== 'guard').flatMap((r) => r.points.map((p) => ({ x: p.x, z: p.z })));
  if (railPts.length) fp = unionRect(fp, expandRect(rectFromPoints(railPts), 0.015));
  if (!isFinite(fp.minX)) fp = emptyRect();
  const clear = {
    left: fp.minX,
    right: room.width - fp.maxX,
    back: fp.minZ,
    front: room.depth - fp.maxZ,
  };
  const tol = 0.002;
  const overflow = {
    left: Math.max(0, -clear.left),
    right: Math.max(0, -clear.right),
    back: Math.max(0, -clear.back),
    front: Math.max(0, -clear.front),
  };
  const overX = overflow.left + overflow.right;
  const overZ = overflow.back + overflow.front;
  const fpX = rectW(fp);
  const fpZ = rectD(fp);
  const fitsRoom = overX <= tol && overZ <= tol;

  if (!fitsRoom) {
    const parts: string[] = [];
    if (overZ > tol) parts.push(`głębokość o ${fmt(overZ)}`);
    if (overX > tol) parts.push(`szerokość o ${fmt(overX)}`);
    const sizeIssue = fpZ > room.depth + tol || fpX > room.width + tol;
    issues.push({
      level: 'error',
      code: 'fit',
      message: 'Schody nie mieszczą się w dostępnej przestrzeni.',
      constraint: sizeIssue ? `Przekroczona ${parts.join(' i ')}` : 'Położenie schodów wychodzi poza ściany',
      suggestion: sizeIssue ? undefined : 'Wyśrodkuj schody lub zmień wyrównanie do ścian.',
    });
    if (fpZ > room.depth + tol) suggestions.add(`Zwiększ głębokość przestrzeni do min. ${fmt(fpZ + 0.02)}.`);
    if (fpX > room.width + tol) suggestions.add(`Zwiększ szerokość przestrzeni do min. ${fmt(fpX + 0.02)}.`);
    // tread going reduction along the overflowing axis
    const alongZ = Math.abs(layout.fwd.z) > 0.5; // first flight along world z
    const s0 = analyticSize(stair.shape, layout.split, g, stair.flightWidth, stair.landingDepth, stair.gap, stair.nosing);
    const s1 = analyticSize(stair.shape, layout.split, g - 0.01, stair.flightWidth, stair.landingDepth, stair.gap, stair.nosing);
    const tryAxis = (over: number, axis: 'u' | 'v') => {
      const rate = (s0[axis] - s1[axis]) / 0.01;
      if (rate <= 0 || over <= 0) return;
      const gNeed = g - over / rate;
      if (gNeed >= LIMITS.goingComfortMin) suggestions.add(`Zmniejsz głębokość stopnicy do ${fmt(Math.floor(gNeed * 200) / 200)} (w granicach komfortu).`);
    };
    if (overZ > tol && fpZ > room.depth) tryAxis(fpZ - room.depth, alongZ ? 'v' : 'u');
    if (overX > tol && fpX > room.width) tryAxis(fpX - room.width, alongZ ? 'u' : 'v');
    if (stair.shape === 'I') suggestions.add('Zmień kształt schodów z I na L lub U — krótszy rzut.');
    if (stair.shape === 'L') suggestions.add('Rozważ schody U (dwa równoległe biegi) lub zmianę kierunku wejścia.');
    if (stair.shape !== 'I' && stair.landingDepth > stair.flightWidth + 0.02)
      suggestions.add(`Skróć spocznik do szerokości biegu (${fmt(stair.flightWidth)}).`);
    if (stair.shape === 'L') suggestions.add('Zmień podział stopni między biegami.');
    suggestions.add('Zmień kierunek wejścia na schody (obrót o 90°).');
  }

  // ---------- riser height ----------
  if (h > LIMITS.riserMax + 1e-6) {
    issues.push({ level: 'error', code: 'riser-high', message: 'Zbyt strome schody — zwiększ liczbę stopni lub głębokość przestrzeni.', constraint: `Wysokość stopnia ${fmt(h)} > ${fmt(LIMITS.riserMax)}` });
    suggestions.add(`Zalecana zmiana liczby stopni: ${Math.ceil(room.height / 0.18)} stopni (≈ ${cm(room.height / Math.ceil(room.height / 0.18), 1)} cm).`);
  } else if (h > LIMITS.riserComfortMax + 1e-6) {
    issues.push({ level: 'warning', code: 'riser-comfort', message: 'Wysokie stopnie — mniejszy komfort użytkowania.', constraint: `Wysokość stopnia ${cm(h, 1)} cm (komfort ≤ 19 cm)` });
    suggestions.add('Zalecana zmiana liczby stopni (zwiększ o 1).');
  } else if (h < LIMITS.riserMin - 1e-6) {
    issues.push({ level: 'warning', code: 'riser-low', message: 'Bardzo niskie stopnie — rozważ mniejszą liczbę stopni.', constraint: `Wysokość stopnia ${cm(h, 1)} cm (< 15 cm)` });
  }

  // ---------- going ----------
  if (g < LIMITS.goingMin - 1e-6) {
    issues.push({ level: 'error', code: 'going-min', message: 'Zbyt płytkie stopnice.', constraint: `Głębokość stopnia ${fmt(g)} < ${fmt(LIMITS.goingMin)}` });
  } else if (g < LIMITS.goingComfortMin - 1e-6) {
    issues.push({ level: 'warning', code: 'going-comfort', message: 'Płytkie stopnice — rozważ zwiększenie głębokości stopnia.', constraint: `Głębokość stopnia ${cm(g, 1)} cm (komfort ≥ 25 cm)` });
  } else if (g > LIMITS.goingMax + 1e-6) {
    issues.push({ level: 'warning', code: 'going-max', message: 'Bardzo głębokie stopnice — nienaturalny krok.', constraint: `Głębokość stopnia ${cm(g, 1)} cm` });
  }

  // ---------- Blondel ----------
  const ideal = 0.63 - 2 * h;
  if (bl < LIMITS.blondelHardMin || bl > LIMITS.blondelHardMax) {
    issues.push({ level: 'error', code: 'blondel', message: 'Niewygodne proporcje stopnia (wzór Blondela).', constraint: `2h + s = ${cm(bl, 1)} cm (zalecane 60–65 cm)`, suggestion: `Ustaw głębokość stopnia ≈ ${fmt(ideal)}.` });
    suggestions.add(`Ustaw głębokość stopnia ≈ ${fmt(ideal)} (wzór Blondela).`);
  } else if (bl < LIMITS.blondelMin - 1e-6 || bl > LIMITS.blondelMax + 1e-6) {
    issues.push({ level: 'warning', code: 'blondel', message: 'Proporcje stopnia poza zakresem komfortu.', constraint: `2h + s = ${cm(bl, 1)} cm (zalecane 60–65 cm)`, suggestion: `Głębokość stopnia ≈ ${fmt(ideal)}.` });
  }
  if (ang > 45) {
    issues.push({ level: 'error', code: 'angle', message: 'Zbyt strome schody — zwiększ głębokość przestrzeni.', constraint: `Kąt nachylenia ${ang.toFixed(1)}°` });
  } else if (ang > 41) {
    issues.push({ level: 'warning', code: 'angle', message: 'Strome schody — zwiększ głębokość przestrzeni lub stopnia.', constraint: `Kąt nachylenia ${ang.toFixed(1)}° (komfort ≤ 41°)` });
  }

  // ---------- flights ----------
  layout.flights.forEach((f, i) => {
    if (f.risers > LIMITS.maxRisersPerFlight) {
      issues.push({ level: 'warning', code: 'flight-long', message: 'Zalecana zmiana liczby stopni w biegu.', constraint: `Bieg ${i + 1}: ${f.risers} stopni (zalecane ≤ ${LIMITS.maxRisersPerFlight})`, suggestion: 'Zastosuj spocznik — schody L lub U.' });
      if (stair.shape === 'I') suggestions.add('Długi pojedynczy bieg — rozważ schody L lub U ze spocznikiem.');
    }
    if (f.risers < LIMITS.minRisersPerFlight) {
      issues.push({ level: 'warning', code: 'flight-short', message: 'Bardzo krótki bieg — rozważ inny podział stopni.', constraint: `Bieg ${i + 1}: ${f.risers} stopnie` });
    }
  });
  if (stair.shape !== 'I' && stair.landingDepth < stair.flightWidth - 0.005) {
    issues.push({ level: 'warning', code: 'landing', message: 'Spocznik krótszy niż szerokość biegu.', constraint: `Spocznik ${fmt(stair.landingDepth)} < bieg ${fmt(stair.flightWidth)}`, suggestion: `Zwiększ głębokość spocznika do ${fmt(stair.flightWidth)}.` });
    suggestions.add(`Zwiększ głębokość spocznika do ${fmt(stair.flightWidth)}.`);
  }

  // ---------- headroom / opening ----------
  const hr = computeHeadroom(layout, layout.opening, room);
  const headroomOk = hr.violations.length === 0;
  if (!headroomOk) {
    issues.push({ level: 'error', code: 'headroom', message: 'Niewystarczająca wysokość przejścia.', constraint: `Prześwit ${fmt(hr.min ?? 0)} < ${fmt(LIMITS.headroom)}`, suggestion: 'Zwiększ długość otworu w stropie.' });
    if (stair.opening.mode === 'manual') suggestions.add(`Zwiększ długość otworu w stropie do ${fmt(layout.opening.autoLength)} (lub tryb automatyczny).`);
    else suggestions.add('Zwiększ głębokość przestrzeni, aby otwór w stropie objął strefę przejścia.');
  }
  if (stair.opening.mode === 'manual' && layout.opening.width < layout.opening.autoWidth - 0.02) {
    issues.push({ level: 'warning', code: 'opening-width', message: 'Otwór w stropie węższy niż schody.', constraint: `Szerokość otworu ${fmt(layout.opening.width)} < ${fmt(layout.opening.autoWidth)}` });
  }
  if (room.slabThickness >= room.height - 2.0) {
    issues.push({ level: 'error', code: 'slab', message: 'Strop zbyt gruby względem wysokości kondygnacji.' });
  }
  const exitC = exitClearance(layout, room);
  if (exitC < 0.3) {
    issues.push({ level: 'info', code: 'exit', message: 'Wyjście ze schodów blisko ściany parteru — sprawdź wolną przestrzeń na piętrze.', constraint: `Odległość ${fmt(Math.max(0, exitC))}` });
  }

  // ---------- railings / handrails ----------
  const rm = railingById(railing.type);
  const sides = sideInfo(layout, room, railing);
  const sideLabel = (s: 'outer' | 'inner') =>
    stair.shape === 'I' ? (s === 'outer' ? 'lewa strona' : 'prawa strona') : s === 'outer' ? 'strona zewnętrzna' : 'strona wewnętrzna';
  let anyHand = false;
  for (const si of sides) {
    if (si.mode !== 'none') anyHand = true;
    const openFlights = si.flights.filter((f) => !f.adjacent);
    if (si.mode === 'none' && openFlights.length) {
      // inner side of U with a narrow gap has no meaningful fall height
      const narrowGap = stair.shape === 'U' && si.side === 'inner' && stair.gap <= LIMITS.railingMaxGap;
      if (!narrowGap)
        issues.push({ level: 'warning', code: `open-${si.side}`, message: `Otwarta krawędź bez balustrady (${sideLabel(si.side)}).`, constraint: 'Strona biegu nie przylega do ściany', suggestion: 'Dodaj balustradę po tej stronie.' });
    }
    if (si.mode === 'wall') {
      const missing = si.flights.filter((f) => !f.present || f.distance > 0.3);
      if (missing.length)
        issues.push({ level: 'warning', code: `wall-${si.side}`, message: `Pochwyt przyścienny wymaga ściany (${sideLabel(si.side)}).`, constraint: 'Brak ściany w pobliżu biegu', suggestion: 'Wybierz balustradę lub przesuń schody do ściany.' });
      const openLand = si.landingSegments.filter((l) => !l.adjacent && l.length > 0.15);
      if (openLand.length)
        issues.push({ level: 'warning', code: `wall-landing-${si.side}`, message: 'Otwarte krawędzie spocznika bez balustrady.', suggestion: 'Wybierz balustradę dla tej strony.' });
    }
    if (si.mode === 'railing' && !railing.landing) {
      const openLand = si.landingSegments.filter((l) => !l.adjacent && l.length > 0.15);
      if (openLand.length)
        issues.push({ level: 'warning', code: `landing-open-${si.side}`, message: 'Otwarte krawędzie spocznika bez balustrady.', suggestion: 'Włącz balustradę na spoczniku.' });
    }
  }
  if (!anyHand) issues.push({ level: 'warning', code: 'no-handrail', message: 'Brak pochwytu i balustrady po obu stronach.', suggestion: 'Dodaj co najmniej jeden pochwyt.' });
  const hasRailing = sides.some((s) => s.mode === 'railing');
  if (hasRailing) {
    if (railing.height < LIMITS.railingMinHeight - 1e-6)
      issues.push({ level: 'warning', code: 'rail-height', message: 'Balustrada niższa niż 90 cm.', constraint: `Wysokość ${fmt(railing.height)}` });
    if (rm.hasSpacing) {
      const clearGap = railing.spacing - railing.profile;
      if (clearGap > LIMITS.railingMaxGap + 1e-6)
        issues.push({ level: 'warning', code: 'rail-gap', message: 'Prześwit między elementami balustrady przekracza 12 cm.', constraint: `Prześwit ${cm(clearGap, 1)} cm`, suggestion: 'Zmniejsz rozstaw elementów.' });
    }
    if (railing.type === 'C')
      issues.push({ level: 'warning', code: 'rail-climb', message: 'Poziome pręty ułatwiają wspinanie się — niezalecane, gdy w domu są dzieci.' });
  }

  // ---------- structure ----------
  const sm = structureById(structure.type);
  if (structure.type === 'D') {
    const anyWall = sides.some((s) => s.flights.some((f) => f.adjacent));
    issues.push({
      level: 'info',
      code: 'struct-D',
      message: anyWall ? 'Gięta blacha: zalecane kotwienie do przylegającej ściany.' : 'Gięta blacha bez ściany: koncepcja z ukrytymi żebrami usztywniającymi — wymaga weryfikacji konstruktora.',
    });
  }
  if (structure.type === 'E') issues.push({ level: 'info', code: 'struct-E', message: 'Rama spawana: dodatkowe słupy podporowe pod dłuższymi biegami.' });
  if (structure.risers === 'closed' && !sm.risers.includes('closed'))
    issues.push({ level: 'info', code: 'risers', message: `${sm.name}: dostępne tylko otwarte podstopnice.` });
  if (layout.landings.length && structure.landingSupport === 'wall') {
    const lw = landingWallEdges(layout, config);
    if (lw === 0)
      issues.push({ level: 'warning', code: 'landing-wall', message: 'Spocznik nie przylega do ściany — zastosowano słupy podporowe.', suggestion: 'Wybierz podparcie na słupach lub przesuń schody do ściany.' });
  }

  // ---------- status ----------
  const hasError = issues.some((i) => i.level === 'error');
  const hasWarn = issues.some((i) => i.level === 'warning');
  const status: Analysis['status'] = !fitsRoom ? 'fail' : hasError || hasWarn ? 'warn' : 'ok';
  if (status !== 'ok') suggestions.add('Użyj „Dopasuj automatycznie”, aby znaleźć najlepszą geometrię.');

  return {
    riserCount: N,
    riserHeight: h,
    going: g,
    treadDepth: g + stair.nosing,
    blondel: bl,
    angleDeg: ang,
    flightsTreads: layout.flights.map((f) => f.treads),
    flightsRisers: layout.flights.map((f) => f.risers),
    flightsRun: layout.flights.map((f) => f.run),
    landingElevations: layout.landings.map((l) => l.topY),
    landingSizes: layout.landings.map((l) => ({ w: rectW(l.rect), d: rectD(l.rect) })),
    footprint: fp,
    footprintSize: { x: fpX, z: fpZ },
    clearances: clear,
    headroomMin: hr.min,
    headroomOk,
    fitsRoom,
    overflow,
    status,
    issues: issues.sort((a, b) => rank(a.level) - rank(b.level)),
    suggestions: [...suggestions],
    exitClear: exitC,
  };
}

const rank = (l: Issue['level']) => (l === 'error' ? 0 : l === 'warning' ? 1 : 2);

/** Count landing edges adjacent to an existing wall (for wall-anchored landings). */
export function landingWallEdges(layout: FullLayout, config: Config): number {
  const { room } = config;
  let n = 0;
  for (const l of layout.landings) {
    const r = l.rect;
    if (room.walls.left && r.minX <= 0.15) n++;
    if (room.walls.right && room.width - r.maxX <= 0.15) n++;
    if (room.walls.back && r.minZ <= 0.15) n++;
    if (room.walls.front && room.depth - r.maxZ <= 0.15) n++;
  }
  return n;
}
