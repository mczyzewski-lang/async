import type { SessionStep, YogaSession } from '@/content/types';
import { stepSeconds } from './session';

export type PlayerStatus = 'idle' | 'preparing' | 'playing' | 'paused' | 'transitioning' | 'completed';
export type StepPhase = 'entry' | 'hold' | 'exit' | 'rest';

export interface PlayerSnapshot {
  status: PlayerStatus;
  stepIndex: number;
  phase: StepPhase;
  /** Seconds elapsed within the current step. */
  stepElapsed: number;
  /** Seconds of the session timeline elapsed (excludes pauses and preparation). */
  elapsed: number;
  total: number;
  prepareLeft: number;
}

export type PlayerEvent =
  | { type: 'status'; status: PlayerStatus }
  | { type: 'step'; index: number; step: SessionStep; reason: 'auto' | 'skip' | 'previous' | 'start' | 'resume' }
  | { type: 'phase'; index: number; phase: StepPhase }
  | { type: 'cue'; index: number; text: string; kind: 'intro' | 'cue' | 'breath' | 'closing' | 'exit' }
  | { type: 'complete' };

export const PREPARE_SECONDS = 4;

/**
 * Pure, clock-driven state machine for a guided session. The UI calls `tick(dt)` from its
 * animation loop; the player never reads wall-clock time itself, which keeps it deterministic
 * and testable, and guarantees that timers, voice cues and animation stay in sync across
 * pause / resume / skip.
 */
export class SessionPlayer {
  status: PlayerStatus = 'idle';
  stepIndex = 0;
  phase: StepPhase = 'entry';
  stepElapsed = 0;
  prepareLeft = 0;
  private listeners = new Set<(e: PlayerEvent) => void>();
  private firedCues = new Set<string>();
  private pausedFrom: PlayerStatus = 'playing';
  readonly offsets: number[];

  constructor(public session: YogaSession, start?: { stepIndex: number; stepElapsed: number }) {
    this.offsets = [];
    let acc = 0;
    for (const s of session.steps) {
      this.offsets.push(acc);
      acc += stepSeconds(s);
    }
    if (start) {
      this.stepIndex = Math.min(start.stepIndex, session.steps.length - 1);
      this.stepElapsed = Math.max(0, Math.min(start.stepElapsed, stepSeconds(session.steps[this.stepIndex]) - 1));
      this.phase = this.phaseAt(this.stepElapsed);
    }
  }

  get total() {
    return this.session.steps.reduce((s, st) => s + stepSeconds(st), 0);
  }
  get elapsed() {
    return (this.offsets[this.stepIndex] ?? 0) + this.stepElapsed;
  }
  get step(): SessionStep {
    return this.session.steps[this.stepIndex];
  }

  on(fn: (e: PlayerEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(e: PlayerEvent) {
    this.listeners.forEach((l) => l(e));
  }
  private setStatus(s: PlayerStatus) {
    if (this.status === s) return;
    this.status = s;
    this.emit({ type: 'status', status: s });
  }

  snapshot(): PlayerSnapshot {
    return {
      status: this.status,
      stepIndex: this.stepIndex,
      phase: this.phase,
      stepElapsed: this.stepElapsed,
      elapsed: this.elapsed,
      total: this.total,
      prepareLeft: this.prepareLeft,
    };
  }

  phaseAt(t: number, step = this.step): StepPhase {
    if (t < step.entryDuration) return 'entry';
    if (t < step.entryDuration + step.holdDuration) return 'hold';
    if (t < step.entryDuration + step.holdDuration + step.exitDuration) return 'exit';
    return 'rest';
  }

  start() {
    if (this.status !== 'idle') return;
    this.prepareLeft = PREPARE_SECONDS;
    this.setStatus('preparing');
  }

  private beginStep(reason: 'auto' | 'skip' | 'previous' | 'start' | 'resume') {
    if (reason !== 'resume') this.stepElapsed = 0;
    this.phase = this.phaseAt(this.stepElapsed);
    this.firedCues = new Set(reason === 'resume' ? ['intro'] : []);
    this.emit({ type: 'step', index: this.stepIndex, step: this.step, reason });
    this.emit({ type: 'phase', index: this.stepIndex, phase: this.phase });
    this.setStatus(this.phase === 'hold' ? 'playing' : 'transitioning');
    this.fireCues();
  }

  pause() {
    if (this.status === 'playing' || this.status === 'transitioning' || this.status === 'preparing') {
      this.pausedFrom = this.status;
      this.setStatus('paused');
    }
  }

  resume() {
    if (this.status !== 'paused') return;
    this.setStatus(this.pausedFrom);
  }

  toggle() {
    if (this.status === 'paused') this.resume();
    else this.pause();
  }

  next() {
    if (this.status === 'completed' || this.status === 'idle') return;
    const wasPaused = this.status === 'paused';
    if (this.stepIndex >= this.session.steps.length - 1) {
      this.complete();
      return;
    }
    this.stepIndex++;
    this.prepareLeft = 0;
    this.beginStep('skip');
    if (wasPaused) {
      this.pausedFrom = this.status;
      this.setStatus('paused');
    }
  }

  previous() {
    if (this.status === 'completed' || this.status === 'idle') return;
    const wasPaused = this.status === 'paused';
    // Within the first seconds go to the previous step, otherwise restart the current one.
    if (this.stepElapsed < 3 && this.stepIndex > 0) this.stepIndex--;
    this.prepareLeft = 0;
    this.beginStep('previous');
    if (wasPaused) {
      this.pausedFrom = this.status;
      this.setStatus('paused');
    }
  }

  complete() {
    this.stepIndex = this.session.steps.length - 1;
    this.stepElapsed = stepSeconds(this.step);
    this.setStatus('completed');
    this.emit({ type: 'complete' });
  }

  private fireCues() {
    const st = this.step;
    const fire = (key: string, text: string | undefined, kind: Extract<PlayerEvent, { type: 'cue' }>['kind']) => {
      if (!text || this.firedCues.has(key)) return;
      this.firedCues.add(key);
      this.emit({ type: 'cue', index: this.stepIndex, text, kind });
    };
    const lines = st.narration;
    const t = this.stepElapsed;
    if (t >= 0) fire('intro', st.side === 'R' && this.stepIndex > 0 && this.session.steps[this.stepIndex - 1].poseId === st.poseId ? `Druga strona. ${lines[0] ?? ''}` : lines[0], 'intro');
    const holdStart = st.entryDuration;
    if (t >= holdStart - 1 && lines[1]) fire('cue1', lines[1], 'cue');
    if (t >= holdStart + Math.min(8, st.holdDuration * 0.3) && lines[2]) fire('cue2', lines[2], 'cue');
    if (st.holdDuration >= 40 && t >= holdStart + st.holdDuration * 0.55 && lines[3]) fire('breath', lines[3], 'breath');
    if (st.phase !== 'relax' && st.holdDuration >= 25 && t >= holdStart + st.holdDuration - 8) fire('closing', 'Jeszcze kilka spokojnych oddechów.', 'closing');
    if (t >= holdStart + st.holdDuration && this.stepIndex < this.session.steps.length - 1) {
      const next = this.session.steps[this.stepIndex + 1];
      fire('exit', next.side === 'R' && next.poseId === st.poseId ? 'Powoli wyjdź z pozycji. Za chwilę druga strona.' : 'Powoli wyjdź z pozycji.', 'exit');
    }
  }

  /** Advances time. Returns true while the session is active. */
  tick(dt: number): boolean {
    if (dt <= 0) return this.status !== 'completed';
    if (this.status === 'preparing') {
      this.prepareLeft -= dt;
      if (this.prepareLeft <= 0) {
        this.prepareLeft = 0;
        this.beginStep('start');
      }
      return true;
    }
    if (this.status !== 'playing' && this.status !== 'transitioning') return this.status !== 'completed';
    let remaining = dt;
    while (remaining > 0 && (this.status === 'playing' || this.status === 'transitioning')) {
      const len = stepSeconds(this.step);
      const left = len - this.stepElapsed;
      const adv = Math.min(left, remaining);
      this.stepElapsed += adv;
      remaining -= adv;
      const ph = this.phaseAt(this.stepElapsed);
      if (ph !== this.phase && this.stepElapsed < len) {
        this.phase = ph;
        this.emit({ type: 'phase', index: this.stepIndex, phase: ph });
        this.setStatus(ph === 'hold' ? 'playing' : 'transitioning');
      }
      this.fireCues();
      if (this.stepElapsed >= len - 1e-6) {
        if (this.stepIndex >= this.session.steps.length - 1) {
          this.complete();
          return false;
        }
        this.stepIndex++;
        this.beginStep('auto');
      }
    }
    return true;
  }

  /** Persistable resume point. */
  resumePoint() {
    return { stepIndex: this.stepIndex, stepElapsed: this.stepElapsed };
  }

  /** Continue a restored session (from `resumePoint`). */
  startFromResume() {
    if (this.status !== 'idle') return;
    this.beginStep('resume');
    this.pausedFrom = this.status;
    this.setStatus('paused');
  }
}
