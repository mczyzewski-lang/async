import { describe, expect, it } from 'vitest';
import type { ExperienceLevel, GoalId, Intensity, SessionRequest } from '@/content/types';
import { POSE_BY_ID } from '@/content/poses';
import { DURATION_TOLERANCE, eligiblePoses, generateSession, moveStep, removeStep, replaceStep, alternativesFor, sessionSeconds, stepSeconds } from './session';
import { GOAL_ORDER } from './labels';

const base: SessionRequest = {
  durationMin: 20,
  goal: 'neckShoulders',
  level: 'beginner',
  intensity: 'moderate',
  equipment: ['mat'],
  exclude: [],
  guidance: 'standard',
  novelty: 'balanced',
  seed: 1234,
};

describe('session generator', () => {
  it.each([10, 20, 30, 40, 50])('hits %i minutes within ±30 s for every goal and level', (min) => {
    const levels: ExperienceLevel[] = ['newcomer', 'beginner', 'intermediate', 'advanced'];
    const intensities: Intensity[] = ['gentle', 'moderate', 'dynamic'];
    for (const goal of GOAL_ORDER as GoalId[]) {
      for (const level of levels) {
        for (const intensity of intensities) {
          const s = generateSession({ ...base, durationMin: min, goal, level, intensity, seed: min * 31 + goal.length });
          const diff = Math.abs(s.totalSeconds - min * 60);
          expect(diff, `${min} ${goal} ${level} ${intensity}: ${s.totalSeconds}`).toBeLessThanOrEqual(DURATION_TOLERANCE);
          expect(s.totalSeconds).toBe(sessionSeconds(s.steps));
        }
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = generateSession(base);
    const b = generateSession(base);
    expect(a.steps.map((s) => s.poseId + s.side + s.holdDuration)).toEqual(b.steps.map((s) => s.poseId + s.side + s.holdDuration));
  });

  it('follows the arrival → warmup → main → cooldown → relax structure', () => {
    const s = generateSession({ ...base, durationMin: 30 });
    const order = ['arrival', 'warmup', 'main', 'cooldown', 'relax'];
    const idx = s.steps.map((st) => order.indexOf(st.phase));
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
    expect(s.steps[0].phase).toBe('arrival');
    expect(s.steps[s.steps.length - 1].poseId).toBe('savasana');
    expect(s.steps.some((st) => st.phase === 'warmup')).toBe(true);
    expect(s.steps.some((st) => st.phase === 'main')).toBe(true);
  });

  it('balances left and right sides with equal holds', () => {
    for (const goal of GOAL_ORDER) {
      const s = generateSession({ ...base, goal, durationMin: 40 });
      for (let i = 0; i < s.steps.length; i++) {
        const st = s.steps[i];
        if (st.side === 'L') {
          expect(s.steps[i + 1].side).toBe('R');
          expect(s.steps[i + 1].poseId).toBe(st.poseId);
          expect(s.steps[i + 1].holdDuration).toBe(st.holdDuration);
        }
        if (st.side === 'R') expect(s.steps[i - 1].side).toBe('L');
      }
    }
  });

  it('never includes excluded movements', () => {
    const exclude = ['kneeling', 'wristLoad', 'lyingProne'] as const;
    for (const goal of GOAL_ORDER) {
      const s = generateSession({ ...base, goal, exclude: [...exclude], durationMin: 30 });
      for (const st of s.steps) {
        const p = POSE_BY_ID[st.poseId];
        expect(p.session!.movements.some((m) => (exclude as readonly string[]).includes(m)), `${goal}:${p.id}`).toBe(false);
      }
    }
  });

  it('keeps beginners away from advanced or supervised poses', () => {
    for (const goal of GOAL_ORDER) {
      for (const level of ['newcomer', 'beginner'] as ExperienceLevel[]) {
        const s = generateSession({ ...base, goal, level, durationMin: 50, intensity: 'dynamic' });
        for (const st of s.steps) {
          const p = POSE_BY_ID[st.poseId];
          expect(p.difficulty).toBe('beginner');
          expect(p.requiresSupervision ?? false).toBe(false);
        }
      }
    }
  });

  it('only demands prepared peak poses after their preparation', () => {
    const s = generateSession({ ...base, level: 'advanced', intensity: 'dynamic', goal: 'strength', durationMin: 50 });
    const seen = new Set<string>();
    for (const st of s.steps) {
      const prep = POSE_BY_ID[st.poseId].session!.needsPrep;
      if (prep?.length && !seen.has(st.poseId)) expect(prep.some((id) => seen.has(id)), st.poseId).toBe(true);
      seen.add(st.poseId);
    }
  });

  it('does not repeat poses back to back', () => {
    const s = generateSession({ ...base, durationMin: 50, goal: 'relax', level: 'newcomer' });
    for (let i = 1; i < s.steps.length; i++) {
      const a = s.steps[i - 1];
      const b = s.steps[i];
      if (a.poseId === b.poseId) expect(a.side === 'L' && b.side === 'R').toBe(true);
    }
  });

  it('uses only poses with a 3D demonstration', () => {
    const s = generateSession({ ...base, durationMin: 50 });
    expect(s.steps.every((st) => POSE_BY_ID[st.poseId].animation)).toBe(true);
  });

  it('supports manual editing (replace, remove, reorder) with recomputed totals', () => {
    const s = generateSession(base);
    const target = s.steps.find((st) => st.phase === 'main')!;
    const alt = alternativesFor(target, s)[0];
    const r = replaceStep(s, target.id, alt);
    expect(r.steps.some((st) => st.poseId === alt.id)).toBe(true);
    expect(Math.abs(r.totalSeconds - 20 * 60)).toBeLessThanOrEqual(60);
    const rem = removeStep(r, r.steps[2].id);
    expect(rem.totalSeconds).toBe(sessionSeconds(rem.steps));
    const mv = moveStep(rem, rem.steps[2].id, 1);
    expect(mv.steps.length).toBe(rem.steps.length);
    expect(stepSeconds(mv.steps[0])).toBeGreaterThan(0);
  });

  it('has enough eligible poses for every level', () => {
    for (const level of ['newcomer', 'beginner', 'intermediate', 'advanced'] as ExperienceLevel[]) {
      expect(eligiblePoses({ ...base, level }).length).toBeGreaterThan(15);
    }
  });
});
