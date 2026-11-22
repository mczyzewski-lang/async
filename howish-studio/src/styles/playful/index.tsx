/** STYLE C — PLAYFUL 3D. Toy-like world; every transform is a pure function of tl.now(). */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, ease, lerp, ramp, rand, win, type CamKey } from '../../engine/anim';
import type { Timeline } from '../../engine/timeline';
import { Airliner, type AirlinerMaterials } from '../../kit/airliner';
import { buildFlow } from '../../kit/flow';
import { Brand, Live, Show, Simplified } from '../../kit/overlay';
import { CameraRig, FlowDots, FlowLines, softTexture, useFilmFrame, useSectionGeometry } from '../../kit/three';
import type { FilmModule } from '../types';

const PURPLE = '#261e54';
const YELLOW = '#ffc83d';
const CORAL = '#ff6b5e';
const SKYBLUE = '#7cc4ff';

const std = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...o });
const M = {
  white: std('#fffaf0'),
  yellow: std(YELLOW),
  coral: std(CORAL),
  violet: std('#7a6cf0'),
  dark: std(PURPLE, { roughness: 0.4 }),
  cloud: std('#ffffff', { roughness: 1 }),
  eleph: std('#a9b1d8'),
  ear: std('#f3a6c0'),
  grass: std('#7bd389', { roughness: 1 }),
  hill: std('#58bf7a', { roughness: 1 }),
  road: std('#5b5876', { roughness: 1 }),
  stripe: std('#fff3c4', { roughness: 1 }),
  car: std('#ff5a4d'),
  cabin: std('#ffd9cf'),
  glass: std('#3a4a9a', { roughness: 0.2 }),
  balloonA: std('#ff7eb6'),
  balloonB: std('#58d6c9'),
  wing: std('#fffaf0'),
  blob: std('#c9efff', { roughness: 0.5 }),
  eyes: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
};
const planeMats: AirlinerMaterials = { body: M.white, wing: M.yellow, engine: M.violet, dark: M.dark, accent: M.coral };

/** Two googly eyes facing +z, in unit-blob space (vertex coloured). */
function eyesGeometry(spread = 0.34, y = 0.18, z = 0.8, r = 0.26) {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, c: string) => {
    const col = new THREE.Color(c);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  for (const s of [-1, 1]) {
    parts.push(paint(new THREE.SphereGeometry(r, 12, 10).translate(s * spread, y, z), '#ffffff'));
    parts.push(paint(new THREE.SphereGeometry(r * 0.5, 10, 8).translate(s * spread + 0.05, y, z + r * 0.72), PURPLE));
  }
  return mergeGeometries(parts)!;
}

interface Times {
  hook: { start: number; end: number }; mys: { start: number; end: number }; hand: { start: number; end: number }; wing: { start: number; end: number };
  pres: { start: number; end: number }; speed: { start: number; end: number }; aha: { start: number; end: number }; rev: { start: number; end: number };
  hook1: number; hook2: number; mysA: number; mysD: number; hand1: number; hand2: number; wing1: number; wing2: number; wing3: number; pres1: number; presEnd: number;
  speed1: number; speed2: number; aha1: number; aha2: number; rev1: number; end: number; cuts: number[];
}
function times(tl: Timeline): Times {
  const s = tl.scene, c = tl.cue;
  const mc = c('c-mys-1');
  const T = {
    hook: s('c-hook'), mys: s('c-mystery'), hand: s('c-hand'), wing: s('c-wing'), pres: s('c-pressure'), speed: s('c-speed'), aha: s('c-aha'), rev: s('c-reveal'),
    hook1: c('c-hook-1').start, hook2: c('c-hook-2').start, mysA: mc.start, mysD: mc.end - mc.start,
    hand1: c('c-hand-1').start, hand2: c('c-hand-2').start, wing1: c('c-wing-1').start, wing2: c('c-wing-2').start, wing3: c('c-wing-3').start,
    pres1: c('c-pres-1').start, presEnd: c('c-pres-1').end, speed1: c('c-speed-1').start, speed2: c('c-speed-2').start,
    aha1: c('c-aha-1').start, aha2: c('c-aha-2').start, rev1: c('c-rev-1').start, end: tl.timing.duration, cuts: [] as number[],
  };
  T.cuts = [T.hand.start, T.wing.start, T.speed.start, T.aha.start];
  return T;
}
const useTimes = (tl: Timeline) => useMemo(() => times(tl), [tl]);
/** runway progress helpers */
const runP = (T: Times, t: number) => clamp01((t - T.speed.start) / (T.speed.end - T.speed.start));
const liftP = (p: number) => ramp(p, 0.66, 1, ease.inOut);
const wrap = (x: number, L: number) => ((((x + L) % (2 * L)) + 2 * L) % (2 * L)) - L;
const damp = (tau: number, f = 13, k = 4) => (tau < 0 ? 0 : Math.exp(-k * tau) * Math.sin(f * tau));

/* ------------------------------------------------------------------ sky */
function Sky({ tl, T }: { tl: Timeline; T: Times }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
        vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ float k = smoothstep(-0.25,0.55,h); gl_FragColor = vec4(mix(bot,top,k),1.0); }',
      }),
    [],
  );
  const c = useMemo(() => ({ dt: new THREE.Color('#3f9bff'), db: new THREE.Color('#d6f1ff'), st: new THREE.Color('#6a48c9'), sb: new THREE.Color('#ffb46e') }), []);
  const sun = useRef<THREE.Mesh>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const dir = useRef<THREE.DirectionalLight>(null);
  const sunTex = useMemo(() => softTexture(128, [[0, 'rgba(255,250,220,1)'], [0.35, 'rgba(255,225,140,.95)'], [0.5, 'rgba(255,190,110,.35)'], [1, 'rgba(255,170,110,0)']]), []);
  useFilmFrame(tl, (t) => {
    const k = ramp(t, T.rev.start - 0.6, T.rev.start + 1.6);
    mat.uniforms.top.value.copy(c.dt).lerp(c.st, k);
    mat.uniforms.bot.value.copy(c.db).lerp(c.sb, k);
    sun.current!.visible = k > 0.01;
    (sun.current!.material as THREE.MeshBasicMaterial).opacity = k;
    hemi.current!.color.set('#ffffff').lerp(new THREE.Color('#ffd9b8'), k);
    dir.current!.color.set('#fff6e0').lerp(new THREE.Color('#ffb070'), k);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffffff', '#c2b4ff', 1.5]} />
      <directionalLight ref={dir} position={[-4, 7, 6]} intensity={1.9} />
      <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[900, 24, 16]} />
      </mesh>
      <mesh ref={sun} position={[60, 6, -120]}>
        <planeGeometry args={[90, 90]} />
        <meshBasicMaterial map={sunTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

const CLOUDS: [number, number, number, number][] = [
  [-14, 4, -14, 1.5], [6, 6.5, -20, 2.1], [18, 1.5, -12, 1.3], [-24, -2.5, -18, 1.8], [10, -5, -10, 1.2], [-6, 8, -26, 2.4], [26, 7, -24, 1.9], [-2, -6.5, -15, 1.5], [-18, 9, -8, 1.0], [14, -1, -30, 2.6],
];
function Clouds({ tl, show }: { tl: Timeline; show: (t: number) => boolean }) {
  const grp = useRef<THREE.Group>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 18, 14), []);
  useFilmFrame(tl, (t) => {
    const g = grp.current!;
    g.visible = show(t);
    if (!g.visible) return;
    g.children.forEach((c, i) => {
      c.position.x = wrap(CLOUDS[i][0] + t * (1.6 + (i % 3) * 0.5), 34);
      c.position.y = CLOUDS[i][1] + Math.sin(t * 0.6 + i) * 0.15;
    });
  });
  return (
    <group ref={grp}>
      {CLOUDS.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          {[[0, 0, 0, 1], [0.95, -0.12, 0.1, 0.72], [-0.95, -0.15, 0, 0.66], [0.4, 0.45, -0.1, 0.7], [-0.45, 0.35, 0.1, 0.6], [1.6, -0.3, 0, 0.45], [-1.6, -0.3, 0, 0.42]].map(([a, b, c, r], j) => (
            <mesh key={j} geometry={geo} material={M.cloud} position={[a, b, c]} scale={[r, r * 0.82, r]} />
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ hero plane */
function Hero({ tl, T }: { tl: Timeline; T: Times }) {
  const grp = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const gear = useRef<THREE.Group>(null);
  const gags = useRef<THREE.Group>(null);
  const strings = useRef<THREE.Group>(null);
  const balloons = useRef<THREE.Group>(null);
  const sph = useMemo(() => new THREE.SphereGeometry(1, 20, 16), []);
  useFilmFrame(tl, (t) => {
    const g = grp.current!;
    const inSky = t < T.hand.start || t >= T.aha.start;
    const inRun = t >= T.speed.start && t < T.aha.start;
    g.visible = inSky || inRun;
    if (!g.visible) return;
    let y = 0, x = 0, pitch = 0, roll = 0, sq = 1;
    if (inRun) {
      const p = runP(T, t);
      const L = liftP(p);
      y = 3.4 * L + Math.sin(t * 22) * 0.02 * (1 - L) * p;
      pitch = 0.22 * ramp(p, 0.58, 0.8);
      gear.current!.visible = true;
      gear.current!.scale.setScalar(1 - ramp(p, 0.86, 0.98));
    } else {
      gear.current!.visible = false;
      y = Math.sin(t * 1.7) * 0.22;
      roll = Math.sin(t * 1.1) * 0.07;
      pitch = Math.sin(t * 0.9 + 1) * 0.025;
      if (t < T.mys.start) {
        // smug wing-wiggle + leaning back on "Relaxing"
        roll += damp(t - (T.hook1 + 0.5), 9, 1.6) * 0.3;
        pitch += 0.09 * ramp(t, T.hook2 + 0.9, T.hook2 + 1.6);
        x = lerp(7, 0, ramp(t, 0, 1.4, ease.out));
      } else if (t < T.hand.start) {
        const f = (t - T.mysA) / T.mysD;
        const flap = win(f, 0.42, 0.63, 0.03, 0.03);
        roll = roll * (1 - flap) + Math.sin(t * 17) * 0.34 * flap;
        y += Math.abs(Math.sin(t * 17)) * 0.25 * flap;
      } else if (t >= T.rev.start) {
        const k = ramp(t, T.rev1 + 0.5, T.rev1 + 2.4);
        roll += k * Math.PI * 2;
        y += ramp(t, T.rev1 + 2, T.end, ease.inOut) * 1.6;
        pitch += ramp(t, T.rev1 + 2, T.end) * 0.12;
      } else {
        sq = 1 + damp(t - T.aha2, 10, 3) * 0.05;
      }
    }
    g.position.set(x, y, 0);
    g.rotation.set(roll, 0, -pitch);
    g.scale.set(1, sq, 1);
    const blink = (t + 0.4) % 3.3 < 0.13 ? 0.12 : 1;
    eyes.current!.scale.y = blink;
    // gags
    const gv = t >= T.mys.start && t < T.hand.start;
    gags.current!.visible = gv;
    if (gv) {
      const f = (t - T.mysA) / T.mysD;
      const s1 = win(f, 0.0, 0.2, 0.05, 0.03);
      const s2 = win(f, 0.2, 0.42, 0.05, 0.03);
      strings.current!.visible = s1 > 0.01;
      strings.current!.scale.set(1, s1, 1);
      balloons.current!.visible = s2 > 0.01;
      balloons.current!.scale.setScalar(ease.outBack(s2));
      balloons.current!.rotation.z = Math.sin(t * 3) * 0.06;
    }
  });
  return (
    <Airliner ref={grp} mats={planeMats}>
      {/* face */}
      <group ref={eyes} position={[-4.42, 0.3, 0]}>
        {[1, -1].map((s) => (
          <group key={s} position={[0, 0, 0.26 * s]}>
            <mesh geometry={sph} scale={[0.14, 0.2, 0.17]}>
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <mesh geometry={sph} position={[-0.09, 0.0, 0.02 * s]} scale={[0.07, 0.11, 0.09]}>
              <meshBasicMaterial color={PURPLE} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
      {[1, -1].map((s) => (
        <mesh key={s} position={[-4.5, -0.02, 0.345 * s]} rotation={[0, -0.45 * s, Math.PI]} material={M.dark}>
          <torusGeometry args={[0.13, 0.03, 8, 16, Math.PI]} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={sph} material={M.ear} position={[-4.38, 0.0, 0.42 * s]} scale={[0.13, 0.09, 0.04]} />
      ))}
      {/* landing gear (runway only) */}
      <group ref={gear}>
        {[[-3.6, -0.78, 0], [0.1, -1.0, 0.85], [0.1, -1.0, -0.85]].map((p, i) => (
          <group key={i} position={p as [number, number, number]}>
            <mesh material={M.dark} position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
            </mesh>
            <mesh material={M.dark} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.24, 16]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* wrong-idea gags */}
      <group ref={gags}>
        <group ref={strings}>
          {[-2.6, 2.2].map((x) => (
            <mesh key={x} material={M.dark} position={[x, 7.5, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 14, 6]} />
            </mesh>
          ))}
        </group>
        <group ref={balloons} position={[0, 0.5, 0]}>
          {[[-2.2, 3.2, 0.2, 0], [-0.9, 4.1, -0.3, 1], [0.4, 3.5, 0.3, 2], [1.6, 4.3, -0.1, 3], [2.8, 3.3, 0.2, 4]].map(([x, y, z, i]) => (
            <group key={i}>
              <mesh geometry={sph} material={[M.balloonA, M.yellow, M.balloonB, M.coral, M.violet][i]} position={[x, y, z]} scale={[0.62, 0.74, 0.62]} />
              <mesh material={M.dark} position={[x * 0.75, y / 2 - 0.2, z]} rotation={[0, 0, Math.atan2(x * 0.5, y - 0.4)]}>
                <cylinderGeometry args={[0.018, 0.018, Math.hypot(y - 0.9, x * 0.5), 5]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </Airliner>
  );
}

/* ------------------------------------------------------------------ elephants */
function Elephants({ tl, T }: { tl: Timeline; T: Times }) {
  const grp = useRef<THREE.Group>(null);
  const sph = useMemo(() => new THREE.SphereGeometry(1, 18, 14), []);
  const trunk = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.1, 0.72), new THREE.Vector3(0, -0.12, 0.9), new THREE.Vector3(0, -0.4, 0.9), new THREE.Vector3(0, -0.52, 1.02)]), 12, 0.09, 8), []);
  const leg = useMemo(() => new THREE.CylinderGeometry(0.14, 0.15, 0.36, 10), []);
  const N = 8;
  useFilmFrame(tl, (t) => {
    const g = grp.current!;
    g.visible = t < T.mys.start + 0.2;
    if (!g.visible) return;
    const out = ramp(t, T.mys.start - 0.7, T.mys.start, ease.in);
    g.position.y = -3.3 - out * 9;
    for (let i = 0; i < N; i++) {
      const a = T.hook1 + 0.7 + i * 0.2;
      const p = ramp(t, a, a + 0.45, ease.outBack);
      const e = g.children[i + 1];
      e.scale.setScalar(Math.max(0.0001, p) * 0.92);
      e.position.y = 0.5 + Math.abs(Math.sin(t * 3 + i * 1.3)) * 0.1 * p;
      e.rotation.z = Math.sin(t * 2.2 + i) * 0.05;
    }
  });
  return (
    <group ref={grp} position={[0, -3.3, 0.5]}>
      <group scale={[1, 0.55, 1]}>
        {[-4.6, -3, -1.5, 0, 1.5, 3, 4.6].map((x, i) => (
          <mesh key={x} geometry={sph} material={M.cloud} position={[x, -0.2 + (i % 2) * 0.1, 0]} scale={[1.5, 1.05, 1.5]} />
        ))}
      </group>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} position={[(i - (N - 1) / 2) * 1.22, 0.5, 0.2 + (i % 2) * 0.25]} rotation={[0, -0.35, 0]}>
          <mesh geometry={sph} material={M.eleph} position={[0, 0.5, 0]} scale={[0.5, 0.46, 0.46]} />
          <mesh geometry={sph} material={M.eleph} position={[0, 0.72, 0.42]} scale={0.34} />
          {[1, -1].map((s) => (
            <group key={s}>
              <mesh geometry={sph} material={M.eleph} position={[0.4 * s, 0.82, 0.3]} scale={[0.27, 0.3, 0.07]} />
              <mesh geometry={sph} material={M.ear} position={[0.4 * s, 0.82, 0.34]} scale={[0.19, 0.22, 0.05]} />
              <mesh geometry={sph} position={[0.13 * s, 0.82, 0.72]} scale={0.05}>
                <meshBasicMaterial color={PURPLE} />
              </mesh>
              <mesh geometry={leg} material={M.eleph} position={[0.24 * s, 0.14, 0.22]} />
              <mesh geometry={leg} material={M.eleph} position={[0.24 * s, 0.14, -0.2]} />
            </group>
          ))}
          <mesh geometry={trunk} material={M.eleph} position={[0, 0.66, 0]} />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ 3D-anchored DOM labels
   The film projects anchor points each frame; the overlay reads them. (Avoids portal roots.) */
const anchors = new WeakMap<Timeline, Record<string, [number, number]>>();
const _v = new THREE.Vector3();
function Anchor({ tl, id, position }: { tl: Timeline; id: string; position: [number, number, number] | ((t: number) => [number, number, number]) }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    const g = ref.current!;
    g.position.fromArray(typeof position === 'function' ? position(tl.now()) : position);
    g.updateWorldMatrix(true, false);
    _v.setFromMatrixPosition(g.matrixWorld).project(camera);
    let m = anchors.get(tl);
    if (!m) anchors.set(tl, (m = {}));
    m[id] = [(_v.x * 0.5 + 0.5) * 100, (-_v.y * 0.5 + 0.5) * 100];
  });
  return <group ref={ref} />;
}
function Pin({ tl, id, show, children }: { tl: Timeline; id: string; show: (t: number) => number; children: React.ReactNode }) {
  return (
    <Live
      tl={tl}
      style={{ opacity: 0 }}
      update={(el, t) => {
        const a = anchors.get(tl)?.[id];
        const s = a ? show(t) : 0;
        el.style.opacity = String(s);
        el.style.visibility = s < 0.01 ? 'hidden' : 'visible';
        if (a) {
          el.style.left = `${Math.min(86, Math.max(14, a[0]))}%`;
          el.style.top = `${a[1]}%`;
        }
        el.style.transform = `translate(-50%, -50%) scale(${0.6 + 0.4 * ease.outBack(clamp01(s))})`;
      }}
    >
      {children}
    </Live>
  );
}

/* ------------------------------------------------------------------ chunky arrow */
function Arrow({ tl, origin, dir, length, color, thickness = 0.03 }: { tl: Timeline; origin: [number, number, number] | ((t: number) => [number, number, number]); dir: [number, number, number]; length: (t: number) => number; color: string; thickness?: number }) {
  const grp = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => ({ shaft: new THREE.CylinderGeometry(thickness, thickness, 1, 18).translate(0, 0.5, 0), head: new THREE.ConeGeometry(thickness * 2.7, thickness * 4.6, 22).translate(0, thickness * 2.3, 0) }), [thickness]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()), [dir]);
  useFilmFrame(tl, (t) => {
    const L = length(t);
    const g = grp.current!;
    g.visible = L > 0.01;
    if (!g.visible) return;
    g.position.fromArray(typeof origin === 'function' ? origin(t) : origin);
    const hl = Math.min(thickness * 4.6, L * 0.7);
    shaft.current!.scale.y = Math.max(0.0001, L - hl);
    head.current!.position.y = L - hl;
    head.current!.scale.setScalar(hl / (thickness * 4.6));
  });
  return (
    <group ref={grp} quaternion={quat}>
      <mesh ref={shaft} geometry={geo.shaft} material={mat} />
      <mesh ref={head} geometry={geo.head} material={mat} />
    </group>
  );
}

/* ------------------------------------------------------------------ generic eyed blobs */
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
function Blobs({ tl, count, show, place, color = '#c9efff' }: { tl: Timeline; count: number; show: (t: number) => boolean; place: (i: number, t: number, o: { x: number; y: number; z: number; s: number }) => void; color?: string }) {
  const body = useRef<THREE.InstancedMesh>(null);
  const eye = useRef<THREE.InstancedMesh>(null);
  const eg = useMemo(() => eyesGeometry(), []);
  const mat = useMemo(() => std(color, { roughness: 0.5 }), [color]);
  const o = useMemo(() => ({ x: 0, y: 0, z: 0, s: 1 }), []);
  useFilmFrame(tl, (t) => {
    const v = show(t);
    body.current!.visible = eye.current!.visible = v;
    if (!v) return;
    for (let i = 0; i < count; i++) {
      place(i, t, o);
      _m.compose(_p.set(o.x, o.y, o.z), _q, _s.setScalar(Math.max(0.0001, o.s)));
      body.current!.setMatrixAt(i, _m);
      eye.current!.setMatrixAt(i, _m);
    }
    body.current!.instanceMatrix.needsUpdate = eye.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={body} args={[undefined, mat, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12]} />
      </instancedMesh>
      <instancedMesh ref={eye} args={[eg, M.eyes, count]} frustumCulled={false} />
    </>
  );
}

/* ------------------------------------------------------------------ ground (car + runway) */
function Ground({ tl, T }: { tl: Timeline; T: Times }) {
  const grp = useRef<THREE.Group>(null);
  const dashes = useRef<THREE.Group>(null);
  const hills = useRef<THREE.Group>(null);
  const trees = useRef<THREE.Group>(null);
  const sph = useMemo(() => new THREE.SphereGeometry(1, 20, 14), []);
  useFilmFrame(tl, (t) => {
    const car = t >= T.hand.start && t < T.wing.start;
    const run = t >= T.speed.start && t < T.aha.start;
    const g = grp.current!;
    g.visible = car || run;
    if (!g.visible) return;
    g.position.y = car ? 0 : -1.22;
    const d = car ? t * 7 : 150 * Math.pow(runP(T, t), 2.4);
    dashes.current!.children.forEach((c, i) => (c.position.x = wrap(i * 4 - 40 + d, 40)));
    hills.current!.children.forEach((c, i) => (c.position.x = wrap(i * 13 - 45 + d * 0.25, 52)));
    trees.current!.children.forEach((c, i) => (c.position.x = wrap(i * 9.5 - 42 + d * 0.7, 47)));
  });
  return (
    <group ref={grp}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={M.grass} position={[0, -0.02, -40]}>
        <planeGeometry args={[400, 140]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={M.road}>
        <planeGeometry args={[400, 5.2]} />
      </mesh>
      <group ref={dashes}>
        {Array.from({ length: 20 }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} material={M.stripe} position={[0, 0.01, 0]}>
            <planeGeometry args={[1.8, 0.22]} />
          </mesh>
        ))}
      </group>
      <group ref={hills}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} geometry={sph} material={M.hill} position={[0, -1, -26 - (i % 3) * 7]} scale={[9 + (i % 3) * 3, 4 + (i % 2) * 2.2, 6]} />
        ))}
      </group>
      <group ref={trees}>
        {Array.from({ length: 10 }, (_, i) => (
          <group key={i} position={[0, 0, -5.5 - (i % 3) * 2.6]}>
            <mesh material={std('#8a5a3c')} position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.13, 0.16, 1, 8]} />
            </mesh>
            <mesh geometry={sph} material={i % 2 ? M.hill : std('#3fae6c', { roughness: 1 })} position={[0, 1.5, 0]} scale={[0.8, 0.95, 0.8]} />
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ car + hand */
const HAND: [number, number, number] = [0.15, 1.2, 1.75];
const handTilt = (T: Times, t: number) => ramp(t, T.hand2 + 0.15, T.hand2 + 0.9, ease.outBack);
const handRise = (T: Times, t: number) => 0.55 * ramp(t, T.hand2 + 0.9, T.hand2 + 1.6, ease.outBack) + damp(t - (T.hand2 + 1.6), 8, 2) * 0.05;
function Car({ tl, T }: { tl: Timeline; T: Times }) {
  const grp = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Mesh>(null);
  const wheels = useRef<THREE.Group>(null);
  const show = (t: number) => t >= T.hand.start && t < T.wing.start;
  useFilmFrame(tl, (t) => {
    const g = grp.current!;
    g.visible = show(t);
    if (!g.visible) return;
    body.current!.position.y = Math.abs(Math.sin(t * 9)) * 0.035;
    body.current!.position.x = lerp(9, 0, ramp(t, T.hand.start, T.hand.start + 1.1, ease.out));
    wheels.current!.children.forEach((w) => (w.rotation.z = t * 20));
    const tilt = handTilt(T, t);
    const rise = handRise(T, t);
    hand.current!.position.set(HAND[0], HAND[1] + rise, HAND[2]);
    hand.current!.rotation.z = -tilt * 0.42;
    arm.current!.position.set(HAND[0], HAND[1] + rise * 0.5 - 0.02, 1.15);
    arm.current!.rotation.x = Math.PI / 2 - Math.atan2(rise, 1.1);
  });
  return (
    <group ref={grp}>
      <group ref={body}>
        <RoundedBox args={[3.3, 0.72, 1.5]} radius={0.24} smoothness={4} position={[0, 0.72, 0]} material={M.car} />
        <RoundedBox args={[1.8, 0.7, 1.36]} radius={0.26} smoothness={4} position={[0.25, 1.3, 0]} material={M.cabin} />
        <RoundedBox args={[1.15, 0.4, 0.05]} radius={0.02} position={[0.25, 1.34, 0.67]} material={M.glass} />
        {[1, -1].map((s) => (
          <mesh key={s} position={[-1.63, 0.8, 0.45 * s]} scale={[0.08, 0.14, 0.14]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial color="#fff6c8" toneMapped={false} />
          </mesh>
        ))}
        <group ref={wheels}>
          {[[-1.05, 0.36, 0.72], [1.05, 0.36, 0.72], [-1.05, 0.36, -0.72], [1.05, 0.36, -0.72]].map((p, i) => (
            <group key={i} position={p as [number, number, number]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={M.dark}>
                <cylinderGeometry args={[0.36, 0.36, 0.26, 20]} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} material={M.stripe} position={[0.12, 0, 0]}>
                <cylinderGeometry args={[0.09, 0.09, 0.28, 10]} />
              </mesh>
            </group>
          ))}
        </group>
        <mesh ref={arm} material={M.cabin}>
          <cylinderGeometry args={[0.1, 0.1, 1.15, 10]} />
        </mesh>
        <group ref={hand}>
          <RoundedBox args={[0.55, 0.16, 0.6]} radius={0.075} smoothness={4} position={[0.22, 0, 0]} material={M.yellow} />
          {[-0.225, -0.075, 0.075, 0.225].map((z, i) => (
            <RoundedBox key={z} args={[0.5 - (i === 0 || i === 3 ? 0.08 : 0), 0.13, 0.135]} radius={0.06} smoothness={3} position={[-0.26 + (i === 0 || i === 3 ? 0.04 : 0), 0, z]} material={M.yellow} />
          ))}
          <RoundedBox args={[0.34, 0.13, 0.15]} radius={0.06} smoothness={3} position={[0.12, 0, 0.36]} rotation={[0, -0.6, 0]} material={M.yellow} />
        </group>
      </group>
      <Blobs
        tl={tl}
        count={36}
        show={show}
        place={(i, t, o) => {
          const lane = i % 4;
          const u = (t * 0.4 + Math.floor(i / 4) / 9 + lane * 0.031) % 1;
          const x = -7.5 + 15 * u;
          const k = ease.smooth(clamp01((x - HAND[0] + 0.6) / 2.4));
          o.x = x;
          o.y = HAND[1] - 0.2 + lane * 0.23 - handTilt(T, t) * 1.25 * k + Math.sin(t * 5 + i) * 0.015;
          o.z = HAND[2] + (lane % 2 ? 0.12 : -0.12);
          o.s = 0.115 * Math.min(1, u * 8, (1 - u) * 8) * ramp(t, T.hand.start + 0.8, T.hand.start + 1.4);
        }}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ wing section set */
const WS = 3.2;
function WingSet({ tl, T }: { tl: Timeline; T: Times }) {
  const flow = useMemo(() => buildFlow({ alphaDeg: 8 }, { lines: 26, spread: 0.8 }), []);
  const geo = useSectionGeometry(flow.outline, 0.7, 0.03);
  const grp = useRef<THREE.Group>(null);
  const wing = useRef<THREE.Group>(null);
  const lo = useRef<THREE.Mesh>(null);
  const hi = useRef<THREE.Mesh>(null);
  const eg = useMemo(() => eyesGeometry(), []);
  const weg = useMemo(() => eyesGeometry(0.4, 0, 0, 0.3), []);
  const tex = useMemo(() => softTexture(128, [[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,.75)'], [1, 'rgba(255,255,255,0)']]), []);
  const show = (t: number) => (t >= T.wing.start && t < T.speed.start ? 1 : 0);
  const filter = useMemo(() => (l: { y0: number }) => l.y0 > -0.62 && l.y0 < 0.36, []);
  const flowTime = (t: number) => t * 0.75;
  useFilmFrame(tl, (t) => {
    const g = grp.current!;
    g.visible = show(t) > 0;
    if (!g.visible) return;
    const pop = ramp(t, T.wing.start, T.wing.start + 0.6, ease.outBack);
    const bounce = damp(t - T.wing3, 12, 3) * 0.07 + 0.05 * ramp(t, T.wing3, T.wing3 + 0.4, ease.outBack);
    wing.current!.position.y = bounce;
    wing.current!.scale.set(pop, pop * (1 + damp(t - T.wing3, 12, 3) * 0.12), pop);
    const pz = ramp(t, T.pres1 + 1.2, T.pres1 + 2.0);
    (lo.current!.material as THREE.MeshBasicMaterial).opacity = pz * 0.85;
    (hi.current!.material as THREE.MeshBasicMaterial).opacity = pz * 0.85;
    const pulse = 1 + Math.sin(t * 3) * 0.04;
    lo.current!.scale.set(1.5 * pulse, 0.62 * pulse, 1);
    hi.current!.scale.set(1.25 * pulse, 0.5 * pulse, 1);
  });
  const up = (t: number) => 0.46 * ramp(t, T.wing3, T.wing3 + 0.6, ease.outBack) * (1 - ramp(t, T.pres1 + 0.6, T.pres1 + 1.1));
  const down = (t: number) => 0.36 * ramp(t, T.wing2 + 1.0, T.wing2 + 1.6, ease.outBack) * (1 - ramp(t, T.pres1 + 0.6, T.pres1 + 1.1));
  return (
    <group ref={grp} scale={WS}>
      <group ref={wing}>
        <mesh geometry={geo} material={M.wing} />
        <mesh geometry={weg} material={M.eyes} position={[-0.3, 0.085, 0.37]} scale={0.14} rotation={[0, 0, -0.14]} />
        <mesh position={[-0.3, 0.02, 0.38]} rotation={[0, 0, Math.PI - 0.14]} material={M.dark}>
          <torusGeometry args={[0.035, 0.008, 6, 14, Math.PI]} />
        </mesh>
      </group>
      <mesh ref={lo} position={[-0.12, 0.42, -0.4]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#6a3dff" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={hi} position={[-0.1, -0.36, -0.4]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={tex} color="#ff7a59" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <FlowLines tl={tl} flow={flow} color="#ffffff" width={2.5} opacity={(t) => show(t) * 0.5 * ramp(t, T.wing1 + 1.2, T.wing2)} reveal={(t) => ramp(t, T.wing1 + 1.2, T.wing2 + 0.6, ease.out)} filter={filter} z={-0.1} />
      <FlowDots tl={tl} flow={flow} perLine={6} size={0.05} flowTime={flowTime} opacity={show} filter={filter} z={0.05} scaleFn={(t, i) => 1 + Math.sin(t * 6 + i * 2.1) * 0.08}>
        <sphereGeometry args={[1, 14, 10]} />
        <primitive object={M.blob} attach="material" />
      </FlowDots>
      <FlowDots tl={tl} flow={flow} perLine={6} size={0.05} flowTime={flowTime} opacity={show} filter={filter} z={0.05} scaleFn={(t, i) => 1 + Math.sin(t * 6 + i * 2.1) * 0.08}>
        <primitive object={eg} attach="geometry" />
        <primitive object={M.eyes} attach="material" />
      </FlowDots>
      <Arrow tl={tl} origin={(t) => [-0.08, 0.16 + damp(t - T.wing3, 12, 3) * 0.05, 0.5]} dir={[0, 1, 0]} length={up} color={YELLOW} thickness={0.04} />
      <Arrow tl={tl} origin={[0.95, -0.2, 0.5]} dir={[0.35, -1, 0]} length={down} color="#2f6fe0" thickness={0.032} />
      <Anchor tl={tl} id="up" position={[0.5, 0.5, 0.5]} />
      <Anchor tl={tl} id="down" position={[1.62, -0.3, 0.5]} />
      <Anchor tl={tl} id="low" position={[-0.05, 0.36, 0.5]} />
      <Anchor tl={tl} id="high" position={[-0.05, -0.4, 0.5]} />
    </group>
  );
}

/* ------------------------------------------------------------------ aha: air thrown down */
function Downwash({ tl, T }: { tl: Timeline; T: Times }) {
  const show = (t: number) => t >= T.aha.start && t < T.rev.start + 1.2;
  const on = (t: number) => ramp(t, T.aha1 + 0.6, T.aha2 + 0.4) * (1 - ramp(t, T.rev.start, T.rev.start + 1.2));
  return (
    <>
      <Blobs
        tl={tl}
        count={44}
        show={show}
        place={(i, t, o) => {
          const side = i % 2 ? 1 : -1;
          const zz = 0.9 + rand(i * 3 + 1) * 3.9;
          const u = (t * 0.5 + rand(i + 11) + i / 44) % 1;
          o.x = 0.4 + 0.42 * zz + u * 9;
          o.y = -0.25 + 0.09 * zz - 3.1 * Math.pow(u, 0.85);
          o.z = side * zz;
          o.s = 0.23 * Math.min(1, u * 7, (1 - u) * 4) * on(t);
        }}
      />
      <Arrow tl={tl} origin={[-0.6, 0.75, 0]} dir={[0, 1, 0]} length={(t) => 1.6 * ramp(t, T.aha2 + 1.6, T.aha2 + 2.2, ease.outBack) * (1 - ramp(t, T.rev.start - 0.3, T.rev.start + 0.3))} color={YELLOW} thickness={0.1} />
      <Arrow tl={tl} origin={[4.2, -1.3, 0]} dir={[0.15, -1, 0]} length={(t) => 2.0 * ramp(t, T.aha2 + 1.0, T.aha2 + 1.6, ease.outBack) * (1 - ramp(t, T.rev.start - 0.3, T.rev.start + 0.3))} color="#3f8cff" thickness={0.09} />
    </>
  );
}

/* ------------------------------------------------------------------ camera */
function camKeys(T: Times): CamKey[] {
  const e = 0.001;
  const k: CamKey[] = [];
  const cut = (t: number, pos: CamKey['pos'], look: CamKey['look'], fov = 40) => {
    if (k.length) k.push({ ...k[k.length - 1], t: t - e });
    k.push({ t, pos, look, fov });
  };
  const to = (t: number, pos: CamKey['pos'], look: CamKey['look'], fov = 40, es = ease.inOut) => k.push({ t, pos, look, fov, ease: es });
  // hook: face close-up -> pull back to reveal elephants
  cut(0, [-8.6, 0.9, 4.2], [-3.6, 0.2, 0], 36);
  to(T.hook1 + 0.5, [-8.6, 0.9, 4.2], [-3.6, 0.2, 0], 36);
  to(T.hook1 + 1.7, [-5.5, 0.2, 15.5], [0, -1.35, 0], 40, ease.inOut);
  to(T.hook2, [-5, 0.2, 15.2], [0, -1.35, 0], 40);
  to(T.mys.start, [-6.5, 1.4, 12.5], [-0.6, 0.2, 0], 38);
  // mystery
  to(T.mysA + T.mysD * 0.2, [-5, 2.6, 14], [0, 2.2, 0], 42);
  to(T.mysA + T.mysD * 0.42, [-3, 3, 14.5], [0, 2.2, 0], 42);
  to(T.mysA + T.mysD * 0.64, [-9, 1.2, 11], [-0.5, 0.3, 0], 40);
  to(T.hand.start - e, [-10, 0.8, 7], [-3, 0.2, 0], 34);
  // car
  cut(T.hand.start, [-2.4, 2.2, 8.6], [0.2, 0.95, 0], 40);
  to(T.hand2, [-0.6, 2.6, 7.6], [0.3, 1.1, 0.8], 40);
  to(T.hand2 + 0.9, [0.6, 3.0, 6.6], [0.6, 1.2, 1.75], 38, ease.out);
  to(T.wing.start - e, [1.0, 3.1, 6.3], [0.8, 1.25, 1.75], 38);
  // wing section
  cut(T.wing.start, [0.8, 0.3, 7.6], [0.8, 0.1, 0], 38);
  to(T.wing2, [1.2, 0.1, 8.4], [1.2, -0.1, 0], 38);
  to(T.wing3, [1.5, -0.2, 8.8], [1.5, -0.3, 0], 38);
  to(T.wing3 + 0.5, [1.5, 0.3, 9.2], [1.5, 0.1, 0], 38, ease.outBack);
  to(T.pres1, [1.3, 0.2, 9], [1.3, 0.1, 0], 38);
  to(T.pres1 + 1.3, [0.5, -0.05, 9.4], [0.5, -0.1, 0], 38);
  to(T.speed.start - e, [0.5, -0.05, 9.0], [0.5, -0.1, 0], 38);
  // runway
  const yL = 3.4;
  cut(T.speed.start, [-7, 0.3, 9.5], [-1.5, 0.0, 0], 40);
  to(T.speed2, [-3, 0.4, 12.5], [-0.3, 0.1, 0], 40);
  to(lerp(T.speed.start, T.speed.end, 0.7), [-1, 0.3, 14.5], [-0.3, 0.5, 0], 40);
  to(T.aha.start - e, [1.5, 1.2, 17.5], [-0.3, yL * 0.8, 0], 40);
  // aha: rear chase
  cut(T.aha.start, [-8, 1.2, 7.5], [-1.5, 0, 0], 38);
  to(T.aha2, [-1, 0.6, 12.5], [1.4, -0.9, 0], 40);
  to(T.aha2 + 2.2, [4.5, 0.2, 12.5], [2.4, -1.2, 0], 42);
  to(T.rev.start, [5.2, 0.3, 12.5], [2.4, -1.1, 0], 42);
  // reveal
  to(T.rev1 + 1.4, [-9, 0.6, 12], [-0.5, 0.3, 0], 38);
  to(T.end, [-13, -0.5, 18], [0, 1.6, 0], 38);
  return k;
}

function Film({ tl }: { tl: Timeline }) {
  const T = useTimes(tl);
  const keys = useMemo(() => camKeys(T), [T]);
  return (
    <>
      <CameraRig tl={tl} keys={keys} shake={0.03} />
      <Sky tl={tl} T={T} />
      <Clouds tl={tl} show={(t) => t < T.hand.start || t >= T.aha.start} />
      <Hero tl={tl} T={T} />
      <Elephants tl={tl} T={T} />
      <Ground tl={tl} T={T} />
      <Car tl={tl} T={T} />
      <WingSet tl={tl} T={T} />
      <Downwash tl={tl} T={T} />
      <Anchor tl={tl} id="eng" position={(t) => [-0.55, -1.95 + 3.4 * liftP(runP(T, t)), 1.75]} />
      <Anchor tl={tl} id="wings" position={(t) => [1.2, 1.5 + 3.4 * liftP(runP(T, t)), 0]} />
    </>
  );
}

/* ------------------------------------------------------------------ overlay */
function Txt({ children, size = 3, color = '#fff', stroke = PURPLE }: { children: React.ReactNode; size?: number; color?: string; stroke?: string }) {
  return (
    <span className="font-play" style={{ fontSize: `${size}cqw`, fontWeight: 800, lineHeight: 1.05, color, WebkitTextStroke: `${size * 0.22}cqw ${stroke}`, paintOrder: 'stroke fill', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function Wipe({ tl, T }: { tl: Timeline; T: Times }) {
  return (
    <Live
      tl={tl}
      className="left-1/2 top-1/2 rounded-full"
      style={{ width: '130cqw', height: '130cqw', marginLeft: '-65cqw', marginTop: '-65cqw', background: YELLOW }}
      update={(el, t) => {
        let s = 0;
        for (const c of T.cuts) s = Math.max(s, 1 - Math.abs(t - c) / 0.3);
        el.style.transform = `scale(${ease.smooth(clamp01(s * 1.25))})`;
        el.style.visibility = s <= 0 ? 'hidden' : 'visible';
      }}
    />
  );
}

function Gag({ tl, T, i, label, a, b }: { tl: Timeline; T: Times; i: number; label: string; a: number; b: number }) {
  const A = T.mysA + T.mysD * a;
  const B = T.mysA + T.mysD * b;
  const X = lerp(A, B, 0.6);
  return (
    <Show tl={tl} from={A} to={T.mysA + T.mysD * 0.66} className="left-[5%]" style={{ top: `${14 + i * 9}%` }} pop>
      <div className="relative inline-block">
        <Txt size={3.6}>{label}</Txt>
        <Live tl={tl} className="left-[-4%] top-[52%] rounded-full" style={{ height: '0.7cqw', width: '108%', background: CORAL, transformOrigin: 'left center', boxShadow: `0 0 0 0.25cqw ${PURPLE}` }} update={(el, t) => (el.style.transform = `rotate(-4deg) scaleX(${ramp(t, X, X + 0.25, ease.out)})`)} />
        <Live tl={tl} className="left-[108%] top-[-10%]" update={(el, t) => { const p = ramp(t, X + 0.1, X + 0.4, ease.outBack); el.style.transform = `scale(${p})`; }}>
          <Txt size={4} color={CORAL}>✕</Txt>
        </Live>
      </div>
    </Show>
  );
}

function Speedo({ tl, T }: { tl: Timeline; T: Times }) {
  return (
    <Show tl={tl} from={T.speed1 + 0.2} to={T.aha.start - 0.25} className="right-[4%] top-[6%]" pop>
      <div style={{ width: '17cqw', height: '10.4cqw', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, height: '17cqw', borderRadius: '50%', background: `conic-gradient(from -90deg, #fffaf0 0deg, #fffaf0 100deg, ${YELLOW} 100deg, ${CORAL} 180deg, transparent 180deg)`, border: `0.7cqw solid ${PURPLE}`, boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', left: '3.6cqw', top: '3.6cqw', width: '9.8cqw', height: '9.8cqw', borderRadius: '50%', background: PURPLE }} />
        <Live tl={tl} className="rounded-full" style={{ left: '8.15cqw', top: '1.6cqw', width: '0.7cqw', height: '7cqw', background: '#fff', transformOrigin: '50% 98%', boxShadow: `0 0 0 0.2cqw ${PURPLE}` }} update={(el, t) => { const v = Math.pow(runP(T, t), 1.4); el.style.transform = `rotate(${-86 + 172 * v + Math.sin(t * 30) * 1.2 * v}deg)`; }} />
        <div className="font-play absolute inset-x-0 text-center" style={{ top: '5.9cqw', fontSize: '1.5cqw', fontWeight: 800, color: '#fff', letterSpacing: '0.12em' }}>SPEED</div>
      </div>
      <Live tl={tl} className="relative mt-[0.4cqw] text-center" style={{ position: 'relative' }} update={(el, t) => { const on = runP(T, t) > 0.66; el.style.opacity = on ? '1' : '0'; el.style.transform = `scale(${on ? 1 + damp(t - lerp(T.speed.start, T.speed.end, 0.66), 12, 4) * 0.3 : 0.6})`; }}>
        <Txt size={2.6} color={YELLOW}>Lift-off!</Txt>
      </Live>
    </Show>
  );
}

function Goggles({ tl, T }: { tl: Timeline; T: Times }) {
  return (
    <Live
      tl={tl}
      className="inset-0"
      update={(el, t) => {
        const p = ramp(t, T.pres1 + 0.5, T.pres1 + 1.3, ease.out);
        const out = ramp(t, T.speed.start - 0.3, T.speed.start, ease.in);
        el.style.visibility = p <= 0 || t >= T.speed.start + 0.3 ? 'hidden' : 'visible';
        el.style.transform = `scale(${lerp(3.2, 1, p) + out * 0.3})`;
        el.style.opacity = String(Math.min(1, p * 2));
      }}
    >
      <svg viewBox="0 0 160 90" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <mask id="gog">
            <rect x="-200" y="-200" width="560" height="490" fill="#fff" />
            <rect x="4" y="4" width="152" height="71" rx="34" fill="#000" />
          </mask>
        </defs>
        <rect x="-200" y="-200" width="560" height="490" fill={PURPLE} mask="url(#gog)" />
        <rect x="4" y="4" width="152" height="71" rx="34" fill="rgba(122,108,240,.13)" stroke={YELLOW} strokeWidth="1.6" />
        <rect x="7" y="7" width="146" height="65" rx="31" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="0.5" />
      </svg>
    </Live>
  );
}

function Overlay({ tl }: { tl: Timeline }) {
  const T = useTimes(tl);
  const scenes = tl.timing.scenes;
  return (
    <>
      {/* hook */}
      <Show tl={tl} from={T.hook1 + 1.5} to={T.mys.start - 0.5} className="inset-x-0 top-[7%] flex justify-center" pop>
        <Txt size={5.2}>
          = <Live tl={tl} className="relative inline-block" style={{ position: 'relative', color: YELLOW, minWidth: '1.3em', textAlign: 'right' }} update={(el, t) => { const n = Math.round(clamp01((t - (T.hook1 + 0.9)) / 1.6) * 8) * 10; if (el.textContent !== String(n)) el.textContent = String(n); }} /> elephants
        </Txt>
      </Show>
      <Simplified tl={tl} from={T.hook1 + 2.2} to={T.mys.start - 0.4} text="≈ 400 t airliner ÷ ≈ 5 t per elephant" />
      {/* mystery */}
      <Gag tl={tl} T={T} i={0} label="Strings?" a={0.02} b={0.2} />
      <Gag tl={tl} T={T} i={1} label="Balloons?" a={0.22} b={0.42} />
      <Gag tl={tl} T={T} i={2} label="Flapping?" a={0.44} b={0.64} />
      <Show tl={tl} from={T.mysA + T.mysD * 0.68} to={T.hand.start - 0.25} className="inset-x-0 top-[9%] flex justify-center" pop>
        <Txt size={5.4} color={YELLOW}>So what’s the trick?</Txt>
      </Show>
      {/* hand */}
      <Show tl={tl} from={T.hand1 + 0.6} to={T.hand2 - 0.1} className="inset-x-0 top-[8%] flex justify-center" pop>
        <Txt size={4.2}>You already know it!</Txt>
      </Show>
      <Show tl={tl} from={T.hand2 + 0.1} to={T.hand2 + 1.0} className="left-[10%] top-[14%]" pop>
        <Txt size={4.4}>Tilt…</Txt>
      </Show>
      <Show tl={tl} from={T.hand2 + 1.0} to={T.wing.start - 0.25} className="right-[9%] top-[12%]" pop>
        <div style={{ transform: 'rotate(-6deg)' }}>
          <Txt size={6} color={YELLOW}>Whoosh!</Txt>
        </div>
      </Show>
      <Simplified tl={tl} from={T.hand2 + 0.4} to={T.wing.start - 0.3} text="A hand makes lift the same basic way as a wing — just far less efficiently" />
      {/* wing */}
      <Show tl={tl} from={T.wing1 + 0.3} to={T.wing2 - 0.1} className="inset-x-0 top-[8%] flex justify-center" pop>
        <Txt size={4}>Tilted. Curved. Super smooth.</Txt>
      </Show>
      <Simplified tl={tl} from={T.wing2} to={T.pres1} text="Air blobs are cartoon stand-ins for parcels of air on computed flow paths" />
      <Pin tl={tl} id="up" show={(t) => win(t, T.wing3 + 0.25, T.pres1 + 0.8, 0.3, 0.3)}>
        <Txt size={3.6} color={YELLOW}>Wing goes UP!</Txt>
      </Pin>
      <Pin tl={tl} id="down" show={(t) => win(t, T.wing2 + 1.3, T.pres1 + 0.8, 0.3, 0.3)}>
        <Txt size={2.7} color="#cfeaff">Air goes down</Txt>
      </Pin>
      {/* pressure */}
      <Pin tl={tl} id="low" show={(t) => win(t, T.pres1 + 1.5, T.speed.start - 0.2, 0.3, 0.15)}>
        <Txt size={2.8} color="#ddd6ff">Low pressure</Txt>
      </Pin>
      <Pin tl={tl} id="high" show={(t) => win(t, T.pres1 + 2.1, T.speed.start - 0.2, 0.3, 0.15)}>
        <Txt size={2.8} color="#ffe0d4">High pressure</Txt>
      </Pin>
      <Goggles tl={tl} T={T} />
      <Show tl={tl} from={T.pres1 + 3.2} to={T.speed.start - 0.3} className="inset-x-0 top-[9.5%] flex justify-center" pop>
        <Txt size={3.2} color={YELLOW}>Same push, different glasses</Txt>
      </Show>
      {/* speed */}
      <Speedo tl={tl} T={T} />
      <Show tl={tl} from={T.speed1 + 0.3} to={T.speed2 - 0.1} className="left-[5%] top-[9%]" pop>
        <Txt size={4.4}>It needs speed!</Txt>
      </Show>
      <Pin tl={tl} id="eng" show={(t) => win(t, T.speed2 + 0.2, T.aha.start - 0.3, 0.3, 0.2)}>
        <Txt size={2.6} color="#ddd6ff">Engines = speed</Txt>
      </Pin>
      <Pin tl={tl} id="wings" show={(t) => win(t, T.speed2 + 1.2, T.aha.start - 0.3, 0.3, 0.2)}>
        <Txt size={2.6} color={YELLOW}>Wings = lift</Txt>
      </Pin>
      {/* aha */}
      <Show tl={tl} from={T.aha2 + 0.2} to={T.rev.start - 0.2} className="inset-x-0 top-[8%] flex justify-center" pop>
        <Txt size={5}>
          Not floating — <span style={{ color: YELLOW }}>pushing!</span>
        </Txt>
      </Show>
      <Simplified tl={tl} from={T.aha2 + 0.6} to={T.rev.start - 0.3} text="“Surfing” is a metaphor: the wing rides the reaction to air it sends down" />
      {/* reveal */}
      <Show tl={tl} from={T.rev1 + 0.3} to={T.end + 1} className="inset-x-0 top-[9%] flex justify-center" pop>
        <Txt size={4.3}>
          Push air <span style={{ color: '#9fd8ff' }}>down</span> → get pushed <span style={{ color: YELLOW }}>up</span>
        </Txt>
      </Show>
      <Brand tl={tl} from={Math.max(T.rev1 + 2.6, scenes['c-reveal'].end - 3.2)} to={T.end + 1} />
      <Wipe tl={tl} T={T} />
    </>
  );
}

const film: FilmModule = { Film, Overlay, background: SKYBLUE, flat: true };
export default film;
