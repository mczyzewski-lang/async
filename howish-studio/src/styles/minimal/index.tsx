/** STYLE B — MINIMAL EXPLAINER. Flat ink + two accents on paper; one persistent diagram. */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { clamp01, ease, ramp, win, type CamKey } from '../../engine/anim';
import type { Timeline } from '../../engine/timeline';
import { Airliner, type AirlinerMaterials } from '../../kit/airliner';
import { buildFlow, pressureImage, type Streamline } from '../../kit/flow';
import { Brand, Live, Show, Simplified } from '../../kit/overlay';
import { Arrow, CameraRig, FlowDots, FlowLines, Tag, useFilmFrame, useSectionGeometry } from '../../kit/three';
import type { FilmModule } from '../types';

const PAPER = '#f4f1ea';
const INK = '#151b33';
const ORANGE = '#ff5a36';
const BLUE = '#2f6bff';
const S = 5; // flow units -> world units
const OFF = 26;

const flow = buildFlow({ alphaDeg: 7 }, { lines: 22 });
const P = (x: number, y: number): [number, number, number] => [x * S, y * S, 0.5];
const PAD = { background: 'rgba(244,241,234,.88)', boxShadow: '0 0 1.2cqw 0.9cqw rgba(244,241,234,.88)' } as const;
const upper = flow.lines.filter((l) => l.side === 1).sort((a, b) => a.y0 - b.y0);
const lower = flow.lines.filter((l) => l.side === -1).sort((a, b) => b.y0 - a.y0);
const raceTop = upper[1];
const raceBot = lower[1];
const isRace = (l: Streamline) => l === raceTop || l === raceBot;
const isNear = (l: Streamline) => upper.slice(0, 4).includes(l) || lower.slice(0, 4).includes(l);
const notRace = (l: Streamline) => !isRace(l);
const dotLines = (l: Streamline, i: number) => !isRace(l) && i % 2 === 0;

/** All beat times for this film, derived from cue ids only. */
function useBeats(tl: Timeline) {
  return useMemo(() => {
    const c = (id: string) => tl.cue(id).start;
    const s = (id: string) => tl.scene(id);
    const speed0 = c('b-speed-1') + 0.5;
    const speed1 = tl.cue('b-speed-1').end + 0.2;
    return {
      end: tl.timing.duration,
      hook: c('b-hook-1'),
      myth: s('b-myth'), myth1: c('b-myth-1'), myth2: c('b-myth-2'), race0: c('b-myth-2') + 1.3, mythEnd: tl.cue('b-myth-2').end,
      steps: s('b-steps'), st: [c('b-step-1'), c('b-step-2'), c('b-step-3'), c('b-step-4')],
      pres: s('b-pressure'), pres1: c('b-pres-1'),
      speed: s('b-speed'), speed0, speed1,
      aha: s('b-aha'), aha1: c('b-aha-1'), aha2: c('b-aha-2'),
      rev: s('b-reveal'), rev1: c('b-rev-1'), revEnd: tl.cue('b-rev-1').end,
    };
  }, [tl]);
}
type Beats = ReturnType<typeof useBeats>;

/** speed multiplier 1 -> 2 during the speed scene (back to 1 afterwards) */
const speedF = (b: Beats, t: number) => 1 + ramp(t, b.speed0, b.speed1, ease.linear) - ramp(t, b.aha.start - 0.6, b.aha.start, ease.linear);
/** analytic integral of the flow clock so seeking is exact */
function flowClock(b: Beats, t: number) {
  const base = 0.55;
  const seg = (a: number, e: number) => (t <= a ? 0 : t >= e ? (e - a) / 2 + (t - e) : ((t - a) * (t - a)) / (2 * (e - a)));
  return base * (t + seg(b.speed0, b.speed1) - seg(b.aha.start - 0.6, b.aha.start));
}
const planeX = (b: Beats, t: number) => {
  if (t < b.aha.start - 1) return OFF * (1 - ramp(t, 0, 1.8, ease.out)) - 0.5 * clamp01(t / b.myth.start) - OFF * ramp(t, b.myth.start - 0.3, b.myth.start + 0.8, ease.in);
  return 1.2 + OFF * (1 - ramp(t, b.aha.start - 0.2, b.aha.start + 1.3, ease.out)) - 0.5 * clamp01((t - b.aha.start) / (b.rev.start - b.aha.start)) - OFF * ramp(t, b.rev.start - 0.3, b.rev.start + 0.8, ease.in);
};
const diagX = (b: Beats, t: number) => {
  if (t < b.rev.start - 0.5) return OFF * (1 - ramp(t, b.myth.start + 0.2, b.myth.start + 1.5, ease.out)) - 3.1 * win(t, b.speed.start - 0.2, b.aha.start - 0.6, 1.2, 0.4) - OFF * ramp(t, b.aha.start - 0.4, b.aha.start + 0.7, ease.in);
  return OFF * (1 - ramp(t, b.rev.start + 0.2, b.rev.start + 1.5, ease.out));
};

function Plane({ tl, b }: { tl: Timeline; b: Beats }) {
  const ref = useRef<THREE.Group>(null);
  const dots = useRef<THREE.Group>(null);
  const mats = useMemo<AirlinerMaterials>(() => {
    const m = (c: string) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
    return { body: m(INK), wing: m(BLUE), engine: m('#0c1124'), dark: m('#2a3358'), accent: m(ORANGE) };
  }, []);
  const air = useMemo(() => new THREE.MeshBasicMaterial({ color: BLUE, transparent: true }), []);
  useFilmFrame(tl, (t) => {
    const g = ref.current!;
    g.position.set(planeX(b, t), 0.8 + Math.sin(t * 1.1) * 0.08, 0);
    g.visible = Math.abs(g.position.x) < OFF - 3;
    const o = win(t, b.aha2 - 0.2, b.rev.start + 0.3, 0.6, 0.4);
    dots.current!.visible = o > 0.01;
    air.opacity = o * 0.85;
    dots.current!.children.forEach((d, i) => {
      const u = (((t * 0.55 + i / 16) % 1) + 1) % 1;
      const lane = (i % 4) - 1.5;
      d.position.set(0.3 + lane * 0.35 + u * 3.4, -0.75 - u * u * 2.3 - Math.abs(lane) * 0.08, 1);
      d.scale.setScalar(0.17 * Math.sin(Math.PI * Math.min(1, u * 1.05)) + 0.001);
    });
  });
  const mid = (t: number): [number, number, number] => [planeX(b, t) - 0.4, 0.8 + Math.sin(t * 1.1) * 0.08, 1.2];
  const eq = (t: number) => 1.9 * ramp(t, b.aha1 + 0.2, b.aha1 + 1.3, ease.outBack);
  return (
    <>
      <group ref={ref} scale={0.92}>
        <Airliner mats={mats} />
        <group ref={dots}>
          {Array.from({ length: 16 }, (_, i) => (
            <mesh key={i} material={air}>
              <circleGeometry args={[1, 20]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* aha: lift = weight */}
      <Arrow tl={tl} origin={(t) => { const p = mid(t); return [p[0], p[1] - 0.75, p[2]]; }} dir={[0, -1, 0]} color={INK} thickness={0.15} length={(t) => 1.9 * ramp(t, b.hook + 1.0, b.hook + 2.0, ease.outBack) * (1 - ramp(t, b.myth.start - 0.4, b.myth.start, ease.in)) + eq(t) * (1 - ramp(t, b.rev.start - 0.4, b.rev.start, ease.in))} />
      <Arrow tl={tl} origin={(t) => { const p = mid(t); return [p[0], p[1] + 0.75, p[2]]; }} dir={[0, 1, 0]} color={ORANGE} thickness={0.15} length={(t) => eq(t) * (1 - ramp(t, b.rev.start - 0.4, b.rev.start, ease.in))} />
      <Tag tl={tl} className="font-brand" position={(t) => { const p = mid(t); return [p[0] + 1.3, p[1] + 2.2, p[2]]; }} show={(t) => win(t, b.aha1 + 0.9, b.rev.start - 0.3, 0.4, 0.3)}>
        <span style={{ color: ORANGE, fontSize: '2.7cqw', fontWeight: 700 }}>Lift</span>
      </Tag>
      <Tag tl={tl} className="font-brand" position={(t) => { const p = mid(t); return [p[0] + 1.5, p[1] - 2.4, p[2]]; }} show={(t) => win(t, b.hook + 1.6, b.myth.start - 0.3, 0.4, 0.3) + win(t, b.aha1 + 0.9, b.rev.start - 0.3, 0.4, 0.3)}>
        <span style={{ color: INK, fontSize: '2.7cqw', fontWeight: 700 }}>Weight</span>
      </Tag>
    </>
  );
}

function Diagram({ tl, b }: { tl: Timeline; b: Beats }) {
  const ref = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const pres = useRef<THREE.Mesh>(null);
  const section = useSectionGeometry(flow.outline, 0.02);
  const wingMat = useMemo(() => new THREE.MeshBasicMaterial({ color: INK }), []);
  const bounds = { x0: -1.5, x1: 1.9, y0: -1.1, y1: 1.1 };
  const presTex = useMemo(() => {
    const cv = pressureImage(flow, 340, 220, bounds, (cp) => {
      const a = clamp01((Math.abs(cp) - 0.07) * 1.15);
      return cp < 0 ? [47, 107, 255, a * 190] : [255, 90, 54, a * 215];
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // tilt construction: trailing edge, chord direction, arc
  const geo = useMemo(() => {
    const te = flow.outline[0];
    const le = flow.outline.reduce((a, p) => (p[0] < a[0] ? p : a));
    const ang = Math.atan2(le[1] - te[1], te[0] - le[0]);
    const r = 1.25;
    const arc: [number, number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (ang * i) / 16;
      arc.push([te[0] - Math.cos(a) * r, te[1] + Math.sin(a) * r, 0.05]);
    }
    const chord: [number, number, number][] = [[te[0], te[1], 0.05], [te[0] - Math.cos(ang) * 1.42, te[1] + Math.sin(ang) * 1.42, 0.05]];
    const horiz: [number, number, number][] = [[te[0], te[1], 0.05], [te[0] - 1.42, te[1], 0.05]];
    return { te, arc, chord, horiz };
  }, []);
  const linesOn = (t: number) => (Math.abs(diagX(b, t)) < OFF - 1 ? 1 : 0);
  useFilmFrame(tl, (t) => {
    const g = ref.current!;
    g.position.x = diagX(b, t);
    g.visible = Math.abs(g.position.x) < OFF - 0.5;
    const tv = win(t, b.st[1] + 0.3, b.st[2] + 0.2, 0.5, 0.5);
    tilt.current!.visible = tv > 0.01;
    tilt.current!.children.forEach((c: any) => c.material && (c.material.opacity = tv));
    const pv = win(t, b.pres1 + 0.3, b.speed.start + 0.1, 0.9, 0.6);
    pres.current!.visible = pv > 0.01;
    (pres.current!.material as THREE.MeshBasicMaterial).opacity = pv;
  });
  const fc = (t: number) => flowClock(b, t);
  const liftLen = (t: number) => {
    const f = speedF(b, t);
    const on = ramp(t, b.st[3] + 1.6, b.st[3] + 2.6, ease.outBack) * (1 - ramp(t, b.aha.start - 0.5, b.aha.start, ease.in)) + ramp(t, b.rev1 + 2.0, b.rev1 + 2.9, ease.outBack);
    return 1.3 * f * f * on;
  };
  const downLen = (t: number) => 1.6 * (ramp(t, b.st[3] + 0.2, b.st[3] + 1.2, ease.outBack) * (1 - ramp(t, b.pres.start - 0.2, b.pres.start + 0.4, ease.in)) + ramp(t, b.rev1 + 0.2, b.rev1 + 1.1, ease.outBack));
  const wakeLen = (t: number) => 2.2 * win(t, b.st[2] + 2.2, b.st[3] + 0.3, 0.8, 0.4);
  return (
    <group ref={ref}>
      <group scale={S}>
        <mesh ref={pres} position={[(bounds.x0 + bounds.x1) / 2, 0, -0.05]}>
          <planeGeometry args={[bounds.x1 - bounds.x0, bounds.y1 - bounds.y0]} />
          <meshBasicMaterial map={presTex} transparent depthWrite={false} />
        </mesh>
        <FlowLines tl={tl} flow={flow} color={INK} width={1.6} filter={notRace} opacity={(t) => linesOn(t) * (0.2 + 0.1 * ramp(t, b.st[0], b.st[0] + 1))} reveal={(t) => ramp(t, b.myth.start + 0.8, b.myth.start + 2.6, ease.out)} />
        <FlowLines tl={tl} flow={flow} color={INK} width={1.6} filter={isRace} opacity={(t) => linesOn(t) * (0.3 + 0.5 * win(t, b.myth2, b.steps.start, 0.6, 0.6))} reveal={(t) => ramp(t, b.myth.start + 0.8, b.myth.start + 2.6, ease.out)} />
        <FlowLines tl={tl} flow={flow} color={BLUE} width={3.2} filter={isNear} z={0.01} opacity={(t) => win(t, b.st[2] + 0.2, b.pres.start + 0.3, 0.5, 0.8) * 0.95 + 0.9 * ramp(t, b.rev1, b.rev1 + 0.8)} reveal={(t) => Math.max(ramp(t, b.st[2] + 0.2, b.st[2] + 2.6, ease.inOut) * (t < b.rev.start ? 1 : 0), ramp(t, b.rev1, b.rev1 + 1.6, ease.inOut))} />
        {/* air moving past: starts with step 1 */}
        <FlowDots tl={tl} flow={flow} perLine={5} size={0.02} z={0.02} flowTime={fc} filter={dotLines} opacity={(t) => linesOn(t) * (win(t, b.st[0] + 0.2, b.aha.start, 0.8, 0.3) * (1 - 0.55 * win(t, b.pres.start, b.speed.start, 0.6, 0.6)) + ramp(t, b.rev.start + 0.5, b.rev.start + 1.5)) * 0.8}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial color={INK} transparent />
        </FlowDots>
        {/* the race: two parcels released together */}
        <FlowDots tl={tl} flow={flow} mode="release" size={0.058} z={0.04} filter={isRace} flowTime={(t) => Math.min(3.75, 0.95 + Math.max(0, (t - b.race0) * 0.62))} opacity={(t) => win(t, b.myth2 + 0.3, b.steps.start + 0.1, 0.4, 0.4)} color={(_s, l, out) => out.set(l.side === 1 ? ORANGE : BLUE)}>
          <circleGeometry args={[1, 28]} />
          <meshBasicMaterial transparent toneMapped={false} />
        </FlowDots>
        <mesh geometry={section} material={wingMat} position={[0, 0, 0.03]} />
        <group ref={tilt}>
          <Line points={geo.horiz} color={INK} lineWidth={1.6} dashed dashSize={0.06} gapSize={0.05} transparent />
          <Line points={geo.chord} color={ORANGE} lineWidth={2.4} transparent />
          <Line points={geo.arc} color={ORANGE} lineWidth={2.4} transparent />
        </group>
      </group>
      {/* step 1: wing moves forward */}
      <Arrow tl={tl} origin={P(0.4, 0.45)} dir={[-1, 0, 0]} color={INK} thickness={0.12} length={(t) => 3.2 * win(t, b.st[0] + 1.6, b.st[1] + 0.2, 0.7, 0.4)} />
      {/* step 3: air leaves heading down */}
      <Arrow tl={tl} origin={P(0.62, -0.14)} dir={[1, -0.22, 0]} color={BLUE} thickness={0.12} length={wakeLen} />
      {/* step 4: action / reaction */}
      <Arrow tl={tl} origin={P(0.98, -0.22)} dir={[0, -1, 0]} color={BLUE} thickness={0.15} length={downLen} />
      <Arrow tl={tl} origin={P(-0.08, 0.2)} dir={[0, 1, 0]} color={ORANGE} thickness={0.1} length={liftLen} />
      <Tag tl={tl} className="font-brand" position={P(-1.02, 0.03)} show={(t) => win(t, b.st[1] + 1.0, b.st[2], 0.4, 0.4)}>
        <span style={{ color: ORANGE, fontSize: '2.7cqw', fontWeight: 700 }}>tilt</span>
      </Tag>
      <Tag tl={tl} className="font-brand" position={P(0.95, 0.3)} show={(t) => win(t, b.mythEnd - 2.3, b.steps.start - 0.1, 0.4, 0.3)}>
        <span style={{ color: ORANGE, fontSize: '2.7cqw', fontWeight: 700 }}>Top arrives first</span>
      </Tag>
      <Tag tl={tl} className="font-brand" position={P(0.66, -0.52)} show={(t) => win(t, b.st[3] + 0.8, b.pres.start, 0.4, 0.3) + ramp(t, b.rev1 + 0.8, b.rev1 + 1.2)}>
        <span style={{ color: BLUE, fontSize: '2.6cqw', fontWeight: 700 }}>Air down</span>
      </Tag>
      <Tag tl={tl} className="font-brand" position={(t) => [0.9, 0.2 * S + 0.5 + liftLen(t) * 0.5, 0.5]} show={(t) => win(t, b.st[3] + 2.2, b.pres.start, 0.4, 0.3) + win(t, b.speed0, b.aha.start - 0.6, 0.4, 0.3) + ramp(t, b.rev1 + 2.5, b.rev1 + 2.9)}>
        <span style={{ color: ORANGE, fontSize: '2.7cqw', fontWeight: 700 }}>Lift</span>
      </Tag>
      <Tag tl={tl} className="font-brand" position={P(0.62, 0.42)} show={(t) => win(t, b.pres1 + 1.8, b.speed.start, 0.5, 0.4)}>
        <span style={{ color: BLUE, fontSize: '2.7cqw', fontWeight: 700 }}>− lower pressure</span>
      </Tag>
      <Tag tl={tl} className="font-brand" position={P(0.3, -0.36)} show={(t) => win(t, b.pres1 + 2.6, b.speed.start, 0.5, 0.4)}>
        <span style={{ color: ORANGE, fontSize: '2.7cqw', fontWeight: 700 }}>+ higher pressure</span>
      </Tag>
    </group>
  );
}

function Film({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  const keys = useMemo<CamKey[]>(() => {
    const k = (t: number, x: number, y: number, z: number, e = ease.inOut): CamKey => ({ t, pos: [x, y, z], look: [x, y, 0], fov: 10.2, ease: e });
    return [
      k(0, 0.4, 0.1, 47, ease.linear),
      k(b.myth.start, 0, 0.2, 43, ease.out),
      k(b.myth.start + 1.5, 0.9, -0.3, 47),
      k(b.steps.start, 1.5, -0.4, 44, ease.linear),
      k(b.st[1] + 0.8, -0.9, 1.0, 37),
      k(b.st[2], -0.7, 0.9, 38, ease.linear),
      k(b.st[2] + 1.6, -0.6, 0.5, 48),
      k(b.st[3] + 1.5, -0.3, 0.5, 48.5),
      k(b.pres.start, -0.2, 0.4, 47, ease.linear),
      k(b.pres1 + 1.6, 0.6, -0.3, 39),
      k(b.speed.start, 0.5, -0.2, 38, ease.linear),
      k(b.speed.start + 1.4, 0.5, 1.9, 61),
      k(b.aha.start - 0.3, 0.3, 2.0, 59, ease.linear),
      k(b.aha.start + 1.4, 0, -0.2, 48),
      k(b.rev.start, -0.5, -0.3, 45, ease.linear),
      k(b.rev.start + 1.6, -1.0, -0.6, 46),
      k(b.end, -1.4, -0.3, 50, ease.linear),
    ];
  }, [b]);
  return (
    <>
      <color attach="background" args={[PAPER]} />
      <CameraRig tl={tl} keys={keys} />
      <Plane tl={tl} b={b} />
      <Diagram tl={tl} b={b} />
    </>
  );
}

const H = { fontWeight: 700, color: INK, letterSpacing: '-0.02em', lineHeight: 1.05 } as const;

function Overlay({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  const steps = ['Moves fast', 'Curved + tilted', 'Air turns down', 'Wing pushed up'];
  const bar = (i: 0 | 1) => (el: HTMLDivElement, t: number) => {
    const f = speedF(b, t);
    const v = i === 0 ? f : f * f;
    const col = el.firstElementChild as HTMLElement;
    col.style.height = `${v * 4.4}cqw`;
    (el.lastElementChild as HTMLElement).textContent = `×${v.toFixed(1)}`;
    const o = win(t, b.speed.start + 0.6 + i * 0.25, b.aha.start - 0.5, 0.5, 0.4);
    el.style.opacity = String(o);
    el.style.transform = `translateY(${(1 - o) * 1.2}cqw)`;
  };
  return (
    <div className="font-brand">
      <Show tl={tl} from={b.hook + 0.2} to={b.hook + 3.0} className="left-[6%] top-[9%]" style={{ ...H, fontSize: '4.6cqw' }}>
        Heavier than air.
      </Show>
      <Show tl={tl} from={b.hook + 3.2} to={b.myth.start - 0.2} className="left-[6%] top-[9%]" style={{ ...H, fontSize: '5.4cqw' }}>
        Why doesn’t it <span style={{ color: ORANGE }}>fall?</span>
      </Show>

      <Show tl={tl} from={b.myth1 + 0.3} to={b.steps.start - 0.2} className="left-[6%] top-[11%]" style={{ ...H, fontSize: '3.5cqw' }}>
        <div style={{ fontSize: '1.3cqw', letterSpacing: '0.2em', color: ORANGE, marginBottom: '0.7cqw' }}>MYTH</div>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          “Air on top must catch up”
          <Live tl={tl} className="left-0 top-[54%]" style={{ height: '0.42cqw', background: ORANGE, borderRadius: '1cqw' }} update={(el, t) => (el.style.width = `${ramp(t, b.myth2 + 0.1, b.myth2 + 0.8, ease.out) * 100}%`)} />
        </div>
      </Show>
      <Simplified tl={tl} dark={false} from={b.myth2 + 1} to={b.steps.start - 0.3} text="Computed for smooth, frictionless 2D flow" />

      <Show tl={tl} from={b.st[0] - 0.1} to={b.pres.start - 0.2} className="left-[6%] top-[9.5%]" style={{ fontSize: '1.3cqw', letterSpacing: '0.2em', color: INK, opacity: 0.6, fontWeight: 700 }}>
        WHAT REALLY HAPPENS
      </Show>
      {steps.map((s, i) => (
        <Show key={s} tl={tl} from={b.st[i] + 0.5} to={b.pres.start - 0.2 + i * 0.04} className="left-[6%] flex items-center" style={{ top: `${14 + i * 6.4}%`, gap: '1cqw', ...PAD }} rise={0.8}>
          <Live tl={tl} className="!static grid place-items-center" style={{ width: '3.3cqw', height: '3.3cqw', borderRadius: '50%', fontSize: '1.8cqw', fontWeight: 700 }} update={(el, t) => {
            const cur = t >= b.st[i] && (i === 3 || t < b.st[i + 1]);
            el.style.background = cur ? ORANGE : 'transparent';
            el.style.color = cur ? '#fff' : INK;
            el.style.boxShadow = cur ? 'none' : `inset 0 0 0 0.2cqw ${INK}`;
          }}>
            {i + 1}
          </Live>
          <span style={{ ...H, fontSize: '2.5cqw' }}>{s}</span>
        </Show>
      ))}
      <Simplified tl={tl} dark={false} from={b.st[3] + 1} to={b.pres.start - 0.3} text="Arrow lengths are illustrative, not to scale" />

      <Show tl={tl} from={b.pres1 + 0.2} to={b.speed.start - 0.2} className="left-[6%] top-[9%]" style={{ ...H, fontSize: '3.8cqw' }}>
        Pressure agrees.
      </Show>
      <Simplified tl={tl} dark={false} from={b.pres1 + 2} to={b.speed.start - 0.3} text="Pressure relative to surrounding air, exaggerated" />

      <Show tl={tl} from={b.speed.start + 0.5} to={b.aha.start - 0.5} className="right-[6%] top-[9%]" style={{ ...H, fontSize: '3.8cqw' }}>
        Speed <span style={{ color: BLUE }}>×2</span> → Lift <span style={{ color: ORANGE }}>×4</span>
      </Show>
      {(['Speed', 'Lift'] as const).map((name, i) => (
        <Live key={name} tl={tl} update={bar(i as 0 | 1)} className="flex flex-col items-center justify-end" style={{ right: `${19 - i * 11}%`, bottom: '24%', width: '8cqw', height: '26cqw', opacity: 0 }}>
          <div style={{ order: 2, width: '5.2cqw', background: i ? ORANGE : BLUE, borderRadius: '0.5cqw 0.5cqw 0 0' }} />
          <div style={{ order: 3, ...H, fontSize: '2cqw', marginTop: '0.6cqw' }}>{name}</div>
          <div style={{ order: 1, ...H, fontSize: '2.4cqw', color: i ? ORANGE : BLUE, marginBottom: '0.5cqw', fontVariantNumeric: 'tabular-nums' }} />
        </Live>
      ))}

      <Show tl={tl} from={b.aha1 + 0.6} to={b.aha2 - 0.1} className="left-[6%] top-[9%]" style={{ ...H, fontSize: '5cqw' }}>
        <span style={{ color: ORANGE }}>Lift</span> = Weight
      </Show>
      <Show tl={tl} from={b.aha2 + 0.1} to={b.rev.start - 0.3} className="left-[6%] top-[9%]" style={{ ...H, fontSize: '4.2cqw' }}>
        Not floating. <span style={{ color: BLUE }}>Working.</span>
      </Show>

      <Show tl={tl} from={b.rev1 + 0.3} to={b.end} className="left-[6%] top-[9%]" style={{ ...H, fontSize: '5cqw' }}>
        <span style={{ color: BLUE }}>Air down.</span> <span style={{ color: ORANGE }}>Wing up.</span>
      </Show>
      <Brand tl={tl} dark={false} from={b.revEnd + 0.2} to={b.end + 1} className="!bottom-auto !top-[8.5%] !items-end pr-[6%]" />
    </div>
  );
}

const film: FilmModule = { Film, Overlay, background: PAPER, flat: true };
export default film;
