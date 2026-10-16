import type {
  BaseShape,
  Difficulty,
  Equipment,
  ExperienceLevel,
  SessionPhase,
  SessionRequest,
  SessionStep,
  YogaPose,
  YogaSession,
} from '@/content/types';
import { POSES } from '@/content/poses';
import { GOAL_LABELS } from './labels';

// ---------------------------------------------------------------------------
// Deterministic PRNG (sessions can be saved and regenerated from their seed)
// ---------------------------------------------------------------------------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** Seconds of transition/rest between consecutive steps. */
export const REST_BETWEEN = 4;
/** Allowed deviation from the requested duration. */
export const DURATION_TOLERANCE = 30;

const PHASE_SHARE: Record<SessionPhase, number> = {
  arrival: 0.08,
  warmup: 0.24,
  main: 0.44,
  cooldown: 0.14,
  relax: 0.1,
};

const LEVEL_RULES: Record<ExperienceLevel, { difficulties: Difficulty[]; maxIntensity: number; holdScale: number; supervision: boolean }> = {
  newcomer: { difficulties: ['beginner'], maxIntensity: 2, holdScale: 0.85, supervision: false },
  beginner: { difficulties: ['beginner'], maxIntensity: 3, holdScale: 1, supervision: false },
  intermediate: { difficulties: ['beginner', 'intermediate'], maxIntensity: 4, holdScale: 1.1, supervision: false },
  advanced: { difficulties: ['beginner', 'intermediate', 'advanced'], maxIntensity: 5, holdScale: 1.2, supervision: true },
};

export function poseBase(p: YogaPose): BaseShape {
  const a = p.animation;
  if (!a) return 'standing';
  const hold = a.keyframes.find((k) => k.id === a.hold) ?? a.keyframes[a.keyframes.length - 1];
  return hold.base;
}

function firstBase(p: YogaPose): BaseShape {
  return p.animation?.keyframes[0]?.base ?? 'standing';
}

const BASE_DISTANCE: Record<BaseShape, Partial<Record<BaseShape, number>>> = {
  standing: { standing: 0, allfours: 2, plank: 2, kneeling: 2, seated: 3, prone: 3, supine: 4 },
  allfours: { allfours: 0, kneeling: 1, plank: 1, prone: 1, standing: 2, seated: 2, supine: 3 },
  plank: { plank: 0, allfours: 1, prone: 1, kneeling: 2, standing: 2, seated: 3, supine: 4 },
  kneeling: { kneeling: 0, allfours: 1, seated: 1, plank: 2, prone: 2, standing: 2, supine: 2 },
  seated: { seated: 0, supine: 1, kneeling: 1, allfours: 2, prone: 3, plank: 3, standing: 3 },
  prone: { prone: 0, allfours: 1, plank: 1, kneeling: 2, seated: 3, supine: 4, standing: 3 },
  supine: { supine: 0, seated: 1, kneeling: 2, allfours: 3, prone: 4, plank: 4, standing: 4 },
};

export function transitionCost(a: BaseShape, b: BaseShape) {
  return BASE_DISTANCE[a][b] ?? 3;
}

/** Poses allowed by level, safety exclusions and preferences. */
export function eligiblePoses(req: SessionRequest, pool: YogaPose[] = POSES): YogaPose[] {
  const rules = LEVEL_RULES[req.level];
  const maxI = Math.min(rules.maxIntensity, req.intensity === 'gentle' ? 3 : 5);
  return pool.filter((p) => {
    if (!p.session || !p.animation) return false;
    if (!rules.difficulties.includes(p.difficulty)) return false;
    if (p.session.intensity > maxI) return false;
    if (p.requiresSupervision && !rules.supervision) return false;
    if (p.session.movements.some((m) => req.exclude.includes(m))) return false;
    return true;
  });
}

interface Candidate {
  pose: YogaPose;
  score: number;
}

function scorePose(p: YogaPose, phase: SessionPhase, req: SessionRequest, prevBase: BaseShape, used: Map<string, number>, placed: Set<string>, progress: number, rnd: () => number) {
  const s = p.session!;
  const role = phase === 'main' ? (s.roles.includes('main') || s.roles.includes('peak')) : s.roles.includes(phase);
  if (!role) return -Infinity;
  let score = (s.goals[req.goal] ?? 0) * 3;
  // Intensity curve: main part peaks in the middle.
  if (phase === 'main') {
    const desired = req.intensity === 'gentle' ? 2 : req.intensity === 'dynamic' ? 3.6 : 2.8;
    const curve = desired + Math.sin(progress * Math.PI) * 0.8;
    score -= Math.abs(s.intensity - curve) * 1.1;
    if (s.roles.includes('peak') && (progress < 0.25 || progress > 0.85)) score -= 3;
  } else {
    score -= Math.max(0, s.intensity - 2) * 1.5;
  }
  score -= transitionCost(prevBase, firstBase(p)) * 0.9;
  const n = used.get(p.id) ?? 0;
  score -= n * 12;
  const known = req.knownPoses?.includes(p.id) ?? false;
  if (req.novelty === 'familiar') score += known ? 1.5 : 0;
  if (req.novelty === 'new') score += known ? -1 : 1;
  if (s.needsPrep?.length && !s.needsPrep.some((id) => placed.has(id))) return -Infinity;
  score += rnd() * 1.6;
  return score;
}

export function stepSeconds(st: Pick<SessionStep, 'entryDuration' | 'holdDuration' | 'exitDuration' | 'restDuration'>) {
  return st.entryDuration + st.holdDuration + st.exitDuration + st.restDuration;
}

export function sessionSeconds(steps: SessionStep[]) {
  return steps.reduce((s, st) => s + stepSeconds(st), 0);
}

let idCounter = 0;
const stepId = () => `st-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

/** Builds the narration lines for a step according to the guidance preference. */
export function narrationFor(p: YogaPose, side: SessionStep['side'], guidance: SessionRequest['guidance'], phase: SessionPhase): string[] {
  const sideTxt = side === 'L' ? ' Lewa strona.' : side === 'R' ? ' Prawa strona.' : '';
  const lines = [`${p.narration.intro}${sideTxt}`];
  if (guidance !== 'minimal') lines.push(...p.narration.cues.slice(0, guidance === 'detailed' ? 3 : 1));
  if (guidance === 'detailed' && p.narration.breath) lines.push(p.narration.breath);
  if (phase === 'relax' && guidance !== 'minimal') lines.push('Pozwól sobie po prostu odpocząć.');
  return lines;
}

export function makeStep(p: YogaPose, side: SessionStep['side'], phase: SessionPhase, req: SessionRequest, hold?: number): SessionStep {
  const s = p.session!;
  const scale = LEVEL_RULES[req.level].holdScale * (req.intensity === 'gentle' ? 1.1 : 1);
  const h = hold ?? Math.round(Math.min(s.hold.max, Math.max(s.hold.min, s.hold.default * scale)));
  return {
    id: stepId(),
    poseId: p.id,
    side,
    phase,
    entryDuration: s.entry,
    holdDuration: h,
    exitDuration: s.exit,
    restDuration: REST_BETWEEN,
    narration: narrationFor(p, side, req.guidance, phase),
    transition: side === 'R' ? 'Zmień stronę.' : `Przejdź do pozycji: ${p.namePL}.`,
  };
}

function pushPose(steps: SessionStep[], p: YogaPose, phase: SessionPhase, req: SessionRequest) {
  if (p.sided) {
    steps.push(makeStep(p, 'L', phase, req));
    steps.push(makeStep(p, 'R', phase, req));
  } else steps.push(makeStep(p, 'none', phase, req));
}

/**
 * Scales holds (within each pose's min/max) and finally the closing relaxation
 * so that the session lands within ±30 s of the target.
 */
export function fitTiming(steps: SessionStep[], targetSeconds: number, poses: Record<string, YogaPose>) {
  for (let iter = 0; iter < 8; iter++) {
    const diff = targetSeconds - sessionSeconds(steps);
    if (Math.abs(diff) <= 2) break;
    const adjustable = steps.filter((st) => st.phase !== 'relax');
    const room = adjustable.map((st) => {
      const h = poses[st.poseId].session!.hold;
      return diff > 0 ? h.max - st.holdDuration : st.holdDuration - h.min;
    });
    const totalRoom = room.reduce((a, b) => a + Math.max(0, b), 0);
    if (totalRoom <= 0.5) break;
    const k = Math.min(1, Math.abs(diff) / totalRoom);
    adjustable.forEach((st, i) => {
      const delta = Math.max(0, room[i]) * k * Math.sign(diff);
      st.holdDuration = Math.round(st.holdDuration + delta);
    });
    // keep left/right pairs equal
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i].side === 'L' && steps[i + 1].side === 'R' && steps[i].poseId === steps[i + 1].poseId) {
        const avg = Math.round((steps[i].holdDuration + steps[i + 1].holdDuration) / 2);
        steps[i].holdDuration = avg;
        steps[i + 1].holdDuration = avg;
      }
    }
  }
  // Closing relaxation absorbs the remainder (bounded to a comfortable range).
  const relax = steps.filter((st) => st.phase === 'relax');
  if (relax.length) {
    const last = relax[relax.length - 1];
    const diff = targetSeconds - sessionSeconds(steps);
    const h = poses[last.poseId].session!.hold;
    last.holdDuration = Math.round(Math.min(Math.max(h.min, last.holdDuration + diff), Math.max(h.max, targetSeconds * 0.16)));
  }
  // Arrival breathing can absorb a small remainder too.
  const arrival = steps.find((st) => st.phase === 'arrival');
  if (arrival) {
    const diff = targetSeconds - sessionSeconds(steps);
    const h = poses[arrival.poseId].session!.hold;
    arrival.holdDuration = Math.round(Math.min(h.max * 1.5, Math.max(h.min, arrival.holdDuration + diff)));
  }
  return steps;
}

/** Generates a complete, phase-structured session. Deterministic for a given request (incl. seed). */
export function generateSession(req: SessionRequest, pool: YogaPose[] = POSES): YogaSession {
  const target = Math.round(req.durationMin * 60);
  const rnd = mulberry32(req.seed);
  const poses = Object.fromEntries(pool.map((p) => [p.id, p]));
  let eligible = eligiblePoses(req, pool);
  // Graceful fallback: if exclusions leave too few poses, relax the intensity filter first.
  if (eligible.length < 8) eligible = eligiblePoses({ ...req, intensity: 'dynamic' }, pool);

  const steps: SessionStep[] = [];
  const used = new Map<string, number>();
  const placed = new Set<string>();
  let prevBase: BaseShape = 'standing';
  const phases: SessionPhase[] = ['arrival', 'warmup', 'main', 'cooldown', 'relax'];

  // Relaxation is planned first so its time is reserved.
  const relaxPose = eligible.find((p) => p.id === 'savasana') ?? eligible.find((p) => p.session!.roles.includes('relax'));

  for (const phase of phases) {
    if (phase === 'relax') {
      if (relaxPose) {
        const st = makeStep(relaxPose, 'none', 'relax', req);
        st.holdDuration = Math.round(Math.max(60, Math.min(420, target * PHASE_SHARE.relax)));
        st.restDuration = 0;
        steps.push(st);
      }
      continue;
    }
    const budget = target * PHASE_SHARE[phase];
    let spent = 0;
    let guard = 0;
    if (phase === 'arrival') {
      // A calm seated (or supine for evening goals) arrival with breathing.
      const pref = req.goal === 'beforeSleep' || req.goal === 'relax' ? ['child', 'easy-seated'] : ['easy-seated', 'mountain'];
      const p = pref.map((id) => eligible.find((e) => e.id === id)).find(Boolean) ?? eligible.find((e) => e.session!.roles.includes('arrival'));
      if (p) {
        const st = makeStep(p, 'none', 'arrival', req);
        st.holdDuration = Math.round(Math.max(st.holdDuration, Math.min(150, budget * 0.8)));
        st.narration = ['Zaczniemy od spokojnego oddechu.', ...st.narration];
        steps.push(st);
        used.set(p.id, 1);
        prevBase = poseBase(p);
        spent += stepSeconds(st);
      }
    }
    while (spent < budget - 20 && guard++ < 40) {
      const progress = spent / budget;
      const cands: Candidate[] = eligible
        .filter((p) => p.id !== relaxPose?.id || phase === 'cooldown')
        .map((p) => ({ pose: p, score: scorePose(p, phase, req, prevBase, used, placed, progress, rnd) }))
        .filter((c) => Number.isFinite(c.score))
        .sort((a, b) => b.score - a.score);
      const pick = cands[0];
      if (!pick) break;
      // Do not overshoot the phase budget by a long sided pose.
      const before = steps.length;
      pushPose(steps, pick.pose, phase, req);
      const added = steps.slice(before).reduce((s, st) => s + stepSeconds(st), 0);
      if (spent + added > budget + 45 && spent > budget * 0.6) {
        steps.length = before;
        // Mark as used once so the next best pose gets a chance.
        used.set(pick.pose.id, (used.get(pick.pose.id) ?? 0) + 1);
        if (cands.length < 2) break;
        continue;
      }
      spent += added;
      used.set(pick.pose.id, (used.get(pick.pose.id) ?? 0) + 1);
      placed.add(pick.pose.id);
      prevBase = poseBase(pick.pose);
    }
  }

  applyEntryDurations(steps, poses);
  fitTiming(steps, target, poses);

  // If still outside tolerance (e.g. very short sessions), add or drop a gentle cooldown pose and refit.
  for (let attempt = 0; attempt < 4; attempt++) {
    const diff = target - sessionSeconds(steps);
    if (Math.abs(diff) <= DURATION_TOLERANCE) break;
    const coolIdx = steps.findIndex((s) => s.phase === 'relax');
    if (diff > 0) {
      const extra = eligible.find((p) => p.session!.roles.includes('cooldown') && !used.has(p.id) && !p.sided) ?? eligible.find((p) => p.session!.roles.includes('cooldown') && !p.sided);
      if (!extra) break;
      steps.splice(coolIdx < 0 ? steps.length : coolIdx, 0, makeStep(extra, 'none', 'cooldown', req));
      used.set(extra.id, (used.get(extra.id) ?? 0) + 1);
    } else {
      const needed = new Set(steps.flatMap((s) => poses[s.poseId].session?.needsPrep ?? []));
      const removable = steps.map((s, i) => ({ s, i })).filter(({ s }) => (s.phase === 'main' || s.phase === 'warmup') && !needed.has(s.poseId));
      const victim = removable[removable.length - 1];
      if (!victim) break;
      const pair = steps[victim.i].side === 'R' ? 2 : 1;
      steps.splice(victim.i - (pair - 1), pair);
    }
    applyEntryDurations(steps, poses);
    fitTiming(steps, target, poses);
  }

  const equipment = new Set<Equipment>(['mat']);
  for (const st of steps) for (const e of poses[st.poseId].equipment) if (req.equipment.includes(e)) equipment.add(e);
  const diffs = steps.map((st) => poses[st.poseId].difficulty);
  const difficulty: Difficulty = diffs.includes('advanced') ? 'advanced' : diffs.includes('intermediate') ? 'intermediate' : 'beginner';

  return {
    id: `sess-${req.seed.toString(36)}-${req.durationMin}`,
    titlePL: `${GOAL_LABELS[req.goal]} · ${req.durationMin} min`,
    request: req,
    steps,
    totalSeconds: sessionSeconds(steps),
    createdAt: Date.now(),
    equipment: [...equipment],
    difficulty,
  };
}

/** Entry time = the pose's own keyframe animation + a planned bridge from the previous base shape. */
export function applyEntryDurations(steps: SessionStep[], poses: Record<string, YogaPose>) {
  let prev: BaseShape = 'standing';
  for (const st of steps) {
    const p = poses[st.poseId];
    const anim = p.animation;
    const own = anim ? anim.entry.reduce((sum, id) => sum + (anim.keyframes.find((k) => k.id === id)?.duration ?? 1.5) + 0.35, 0) : 4;
    const bridge = transitionCost(prev, firstBase(p)) * 1.6;
    st.entryDuration = Math.max(p.session?.entry ?? 5, Math.ceil(own + bridge + 1));
    prev = poseBase(p);
  }
  return steps;
}

/** Recomputes totals after a manual edit (keeps the user's choices, no refit). */
export function recomputeSession(s: YogaSession): YogaSession {
  return { ...s, totalSeconds: sessionSeconds(s.steps) };
}

/** Alternatives for replacing a step: same phase role, similar intensity, allowed by the request. */
export function alternativesFor(step: SessionStep, session: YogaSession, pool: YogaPose[] = POSES): YogaPose[] {
  const current = pool.find((p) => p.id === step.poseId);
  const eligible = eligiblePoses(session.request, pool);
  const phaseRole = step.phase === 'main' ? ['main', 'peak'] : [step.phase];
  return eligible
    .filter((p) => p.id !== step.poseId && p.session!.roles.some((r) => phaseRole.includes(r)))
    .sort((a, b) => {
      const ga = (a.session!.goals[session.request.goal] ?? 0) - Math.abs(a.session!.intensity - (current?.session?.intensity ?? 2));
      const gb = (b.session!.goals[session.request.goal] ?? 0) - Math.abs(b.session!.intensity - (current?.session?.intensity ?? 2));
      return gb - ga;
    })
    .slice(0, 12);
}

/** Replaces one step (both sides for sided poses) and refits timing to the original target. */
export function replaceStep(session: YogaSession, stepId: string, newPose: YogaPose, pool: YogaPose[] = POSES): YogaSession {
  const idx = session.steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return session;
  const old = session.steps[idx];
  const steps = [...session.steps];
  // remove the old pose (including its pair)
  let start = idx;
  let count = 1;
  if (old.side === 'R' && steps[idx - 1]?.poseId === old.poseId) start = idx - 1;
  if (steps[start].side === 'L' && steps[start + 1]?.poseId === old.poseId) count = 2;
  const fresh: SessionStep[] = [];
  pushPose(fresh, newPose, old.phase, session.request);
  steps.splice(start, count, ...fresh);
  const poses = Object.fromEntries(pool.map((p) => [p.id, p]));
  applyEntryDurations(steps, poses);
  fitTiming(steps, session.request.durationMin * 60, poses);
  return { ...session, steps, totalSeconds: sessionSeconds(steps), custom: true };
}

export function removeStep(session: YogaSession, stepId: string, refit = true, pool: YogaPose[] = POSES): YogaSession {
  const idx = session.steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return session;
  const st = session.steps[idx];
  const steps = session.steps.filter((s, i) => {
    if (i === idx) return false;
    // remove the paired side as well
    if (s.poseId === st.poseId && ((st.side === 'L' && i === idx + 1 && s.side === 'R') || (st.side === 'R' && i === idx - 1 && s.side === 'L'))) return false;
    return true;
  });
  const poses = Object.fromEntries(pool.map((p) => [p.id, p]));
  applyEntryDurations(steps, poses);
  if (refit) fitTiming(steps, session.request.durationMin * 60, poses);
  return { ...session, steps, totalSeconds: sessionSeconds(steps), custom: true };
}

/** Moves a pose block (with its paired side) up or down. */
export function moveStep(session: YogaSession, stepId: string, dir: -1 | 1): YogaSession {
  const blocks: SessionStep[][] = [];
  for (const s of session.steps) {
    const last = blocks[blocks.length - 1];
    if (last && s.side === 'R' && last[0].side === 'L' && last[0].poseId === s.poseId) last.push(s);
    else blocks.push([s]);
  }
  const bi = blocks.findIndex((b) => b.some((s) => s.id === stepId));
  const to = bi + dir;
  if (bi < 0 || to < 0 || to >= blocks.length) return session;
  [blocks[bi], blocks[to]] = [blocks[to], blocks[bi]];
  // phases follow position: keep the phase label of the destination slot
  const steps = blocks.flat();
  applyEntryDurations(steps, Object.fromEntries(POSES.map((p) => [p.id, p])));
  return { ...session, steps, totalSeconds: sessionSeconds(steps), custom: true };
}

export function setDuration(session: YogaSession, minutes: number): YogaSession {
  return generateSession({ ...session.request, durationMin: minutes });
}

export function newSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
