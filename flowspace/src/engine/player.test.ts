import { describe, expect, it } from 'vitest';
import { generateSession, stepSeconds } from './session';
import { PREPARE_SECONDS, SessionPlayer, type PlayerEvent } from './player';

const session = generateSession({
  durationMin: 10, goal: 'relax', level: 'beginner', intensity: 'gentle', equipment: ['mat'], exclude: [], guidance: 'standard', novelty: 'balanced', seed: 7,
});

function run(p: SessionPlayer, seconds: number, dt = 0.25) {
  for (let t = 0; t < seconds; t += dt) p.tick(dt);
}

describe('session player', () => {
  it('goes idle → preparing → transitioning/playing → completed', () => {
    const p = new SessionPlayer(session);
    const statuses: string[] = [];
    p.on((e) => e.type === 'status' && statuses.push(e.status));
    expect(p.status).toBe('idle');
    p.start();
    expect(p.status).toBe('preparing');
    run(p, PREPARE_SECONDS + 0.5);
    expect(['transitioning', 'playing']).toContain(p.status);
    run(p, session.totalSeconds + 5);
    expect(p.status).toBe('completed');
    expect(statuses).toContain('playing');
    expect(statuses).toContain('transitioning');
    expect(statuses[statuses.length - 1]).toBe('completed');
  });

  it('keeps the timeline frozen while paused and resumes exactly', () => {
    const p = new SessionPlayer(session);
    p.start();
    run(p, PREPARE_SECONDS + 20);
    const before = p.elapsed;
    p.pause();
    expect(p.status).toBe('paused');
    run(p, 60);
    expect(p.elapsed).toBe(before);
    p.resume();
    run(p, 5);
    expect(p.elapsed).toBeCloseTo(before + 5, 5);
  });

  it('skips to the next and previous step', () => {
    const p = new SessionPlayer(session);
    p.start();
    run(p, PREPARE_SECONDS + 1);
    p.next();
    expect(p.stepIndex).toBe(1);
    expect(p.stepElapsed).toBe(0);
    p.previous();
    expect(p.stepIndex).toBe(0);
    run(p, 5);
    p.previous();
    expect(p.stepIndex).toBe(0);
    expect(p.stepElapsed).toBe(0);
  });

  it('skip while paused stays paused', () => {
    const p = new SessionPlayer(session);
    p.start();
    run(p, PREPARE_SECONDS + 2);
    p.pause();
    p.next();
    expect(p.status).toBe('paused');
    expect(p.stepIndex).toBe(1);
  });

  it('total elapsed equals the scheduled duration at the end', () => {
    const p = new SessionPlayer(session);
    p.start();
    run(p, PREPARE_SECONDS + session.totalSeconds + 2, 0.5);
    expect(p.elapsed).toBeCloseTo(session.totalSeconds, 3);
  });

  it('fires the intro cue once per step and never during pause', () => {
    const p = new SessionPlayer(session);
    const cues: PlayerEvent[] = [];
    p.on((e) => e.type === 'cue' && cues.push(e));
    p.start();
    run(p, PREPARE_SECONDS + stepSeconds(session.steps[0]) + 1);
    const intros = cues.filter((c) => c.type === 'cue' && c.kind === 'intro');
    expect(intros.length).toBe(2);
    const n = cues.length;
    p.pause();
    run(p, 120);
    expect(cues.length).toBe(n);
  });

  it('restores from a resume point', () => {
    const p = new SessionPlayer(session, { stepIndex: 3, stepElapsed: 5 });
    p.startFromResume();
    expect(p.status).toBe('paused');
    expect(p.stepIndex).toBe(3);
    p.resume();
    run(p, 1);
    expect(p.stepElapsed).toBeCloseTo(6, 5);
  });

  it('completes immediately when skipping past the last step', () => {
    const p = new SessionPlayer(session);
    p.start();
    run(p, PREPARE_SECONDS + 1);
    for (let i = 0; i < session.steps.length + 2; i++) p.next();
    expect(p.status).toBe('completed');
  });
});
