/** STYLE D — X-RAY SCIENCE. Transparent structure, computed flow data, HUD readouts. */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { clamp01, ease, lerp, ramp, rand, win, type CamKey } from '../../engine/anim';
import type { Timeline } from '../../engine/timeline';
import { flightEpisode } from '../../episodes/flight';
import { Airliner, WING, type AirlinerMaterials } from '../../kit/airliner';
import { airfoilOutline, buildFlow, pressureImage, type FlowField } from '../../kit/flow';
import { Brand, Live, Show, Simplified } from '../../kit/overlay';
import { Arrow, CameraRig, FlowDots, FlowLines, Tag, softTexture, useFilmFrame, useSectionGeometry } from '../../kit/three';
import type { FilmModule } from '../types';

const BG = '#04080f';
const CYAN = '#38e1ff';
const AMBER = '#ffb14a';
const ICE = '#d9fbff';
const S = 5; // flow units -> world units for the wing-slice lab
const LAB_Y = -100;
const SLICE_S = 0.45; // span station of the slice

const simp = (id: string) => flightEpisode.variants.D.scenes.find((s) => s.id === id)?.simplification ?? '';

/* ---------- colour ramps ---------- */
const cSlow = new THREE.Color(AMBER);
const cMid = new THREE.Color('#1c7ea8');
const cFast = new THREE.Color('#d2fcff');
function speedInto(speed: number, out: THREE.Color) {
  const k = clamp01((speed - 0.55) / 1.0);
  if (k < 0.45) out.copy(cSlow).lerp(cMid, k / 0.45);
  else out.copy(cMid).lerp(cFast, (k - 0.45) / 0.55);
}
const speedColor = (speed: number) => {
  const c = new THREE.Color();
  speedInto(speed, c);
  return c;
};
const dotColor = (speed: number, _l: unknown, out: THREE.Color) => speedInto(speed, out);
function cpColor(cp: number): [number, number, number, number] {
  if (cp < 0) {
    const a = clamp01((-cp - 0.06) / 1.1);
    return [40 + 60 * a, 150 + 70 * a, 255, Math.pow(a, 0.75) * 235];
  }
  const a = clamp01((cp - 0.04) / 0.6);
  return [255, 170 - 40 * a, 60, Math.pow(a, 0.75) * 235];
}

/* ---------- x-ray material ---------- */
function xrayMaterial(color: string, base: number, rim: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uScan: { value: 1e6 }, uBase: { value: base }, uRim: { value: rim }, uGain: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uScan; uniform float uBase; uniform float uRim; uniform float uGain; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ if (vW.x > uScan) discard;
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = uBase + pow(f, 2.4) * uRim;
        float edge = exp(-(uScan - vW.x) * 3.5) * 1.6;
        gl_FragColor = vec4(uColor * (a * uGain + edge), 1.0); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/* ---------- internal structure (frames, stringers, ribs, spars) ---------- */
const PROF: [number, number][] = [[-5, 0], [-4.93, 0.12], [-4.75, 0.26], [-4.4, 0.4], [-3.9, 0.5], [-3.2, 0.55], [-2, 0.56], [1.6, 0.56], [2.5, 0.53], [3.4, 0.44], [4.2, 0.3], [4.75, 0.16], [5, 0.07]];
function fusR(x: number) {
  for (let i = 0; i < PROF.length - 1; i++) if (x <= PROF[i + 1][0]) return lerp(PROF[i][1], PROF[i + 1][1], (x - PROF[i][0]) / (PROF[i + 1][0] - PROF[i][0]));
  return 0.07;
}
const fusY = (x: number) => (x > 2 ? Math.pow((x - 2) / 3, 2) * 0.28 : 0);
const RIB = airfoilOutline(22, 0.06, 0.1);
function ribPoints(s: number, sign: number): [number, number, number][] {
  const chord = WING.root + (WING.tip - WING.root) * s;
  return RIB.map(([x, y]) => [WING.x + x * chord + WING.sweep * s + chord * 0.5, WING.y + y * 1.2 * chord + WING.dihedral * s, sign * (WING.z + WING.span * s)]);
}
function structure() {
  const fus: number[] = [];
  const wing: number[] = [];
  for (let x = -4.25; x <= 4.6; x += 0.5) {
    const r = fusR(x) * 0.985;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, b = ((i + 1) / 28) * Math.PI * 2;
      fus.push(x, fusY(x) + Math.cos(a) * r, Math.sin(a) * r, x, fusY(x) + Math.cos(b) * r, Math.sin(b) * r);
    }
  }
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.3;
    for (let x = -4.75; x < 4.9; x += 0.25) {
      const r0 = fusR(x) * 0.985, r1 = fusR(x + 0.25) * 0.985;
      fus.push(x, fusY(x) + Math.cos(a) * r0, Math.sin(a) * r0, x + 0.25, fusY(x + 0.25) + Math.cos(a) * r1, Math.sin(a) * r1);
    }
  }
  // cabin floor
  fus.push(-3.9, -0.14, 0, 3.4, -0.14, 0);
  for (const sign of [1, -1]) {
    for (let i = 0; i <= 11; i++) {
      const p = ribPoints(i / 11, sign);
      for (let j = 0; j < p.length; j++) wing.push(...p[j], ...p[(j + 1) % p.length]);
    }
    for (const f of [0.18, 0.42, 0.66]) {
      const at = (s: number) => {
        const chord = WING.root + (WING.tip - WING.root) * s;
        return [WING.x + WING.sweep * s + chord * f, WING.y + WING.dihedral * s + 0.02 * chord, sign * (WING.z + WING.span * s)];
      };
      wing.push(...at(0), ...at(1));
    }
  }
  const mk = (a: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    return g;
  };
  return { fus: mk(fus), wing: mk(wing) };
}

/* ---------- the aircraft (opaque paint -> x-ray via scan plane) ---------- */
function Aircraft({ tl }: { tl: Timeline }) {
  const gl = useThree((s) => s.gl);
  const T = useTimes(tl);
  const m = useMemo(() => {
    gl.localClippingEnabled = true;
    const paintClip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const xrayClip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    const std = (color: string, rough: number, metal = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, clippingPlanes: [paintClip] });
    const paint: AirlinerMaterials = { body: std('#e9eef3', 0.45), wing: std('#aeb7c2', 0.4, 0.5), engine: std('#8d97a5', 0.35, 0.6), dark: std('#101822', 0.3), accent: std('#1b6fd1', 0.5) };
    const body = xrayMaterial(CYAN, 0.035, 0.75);
    const wing = xrayMaterial(CYAN, 0.03, 0.5);
    const eng = xrayMaterial('#9af0ff', 0.08, 0.9);
    const xray: AirlinerMaterials = { body, wing, engine: eng, dark: xrayMaterial(CYAN, 0.02, 0.3), accent: wing };
    const line = (o: number) => new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [xrayClip], toneMapped: false });
    return { paintClip, xrayClip, paint, xray, shaders: [body, wing, eng, xray.dark as THREE.ShaderMaterial], wing, fusLine: line(0.3), wingLine: line(0.4), geo: structure(), glow: softTexture(128, [[0, 'rgba(120,235,255,0.9)'], [0.4, 'rgba(56,225,255,0.25)'], [1, 'rgba(56,225,255,0)']]) };
  }, [gl]);
  const slice = useMemo(() => {
    const p = ribPoints(SLICE_S, 1);
    return [...p, p[0]];
  }, []);
  const root = useRef<THREE.Group>(null);
  const paintRef = useRef<THREE.Group>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const sliceRef = useRef<any>(null);
  useFilmFrame(tl, (t) => {
    const inPlane = t < T.cut1 || t >= T.cut2;
    root.current!.visible = inPlane;
    if (!inPlane) return;
    const sp = ramp(t, T.scanA, T.scanB, ease.inOut);
    const scan = t >= T.scanB ? 1e6 : lerp(-5.6, 5.6, sp);
    m.paintClip.constant = -scan;
    m.xrayClip.constant = scan;
    m.shaders.forEach((s) => (s.uniforms.uScan.value = scan));
    paintRef.current!.visible = t < T.scanB;
    scanRef.current!.visible = t > T.scanA - 0.2 && t < T.scanB;
    scanRef.current!.position.x = scan;
    (scanRef.current!.material as THREE.MeshBasicMaterial).opacity = 0.32 * win(t, T.scanA - 0.2, T.scanB, 0.3, 0.3);
    // wing lock-on highlight during the mystery scene
    const hi = win(t, T.mysCue + 1.2, T.cut1 + 0.5, 0.8, 0.4);
    const pulse = 1 + hi * (0.7 + 0.3 * Math.sin(t * 5));
    m.wing.uniforms.uGain.value = pulse;
    m.wingLine.opacity = 0.4 + 0.45 * hi;
    m.fusLine.opacity = 0.3 - 0.12 * hi;
    const so = win(t, T.cut1 - 2.2, T.cut1 + 0.3, 0.5, 0.2);
    sliceRef.current.visible = so > 0.01;
    sliceRef.current.material.opacity = so;
  });
  return (
    <group ref={root}>
      <group ref={paintRef}>
        <Airliner mats={m.paint} />
      </group>
      <Airliner mats={m.xray} />
      <lineSegments geometry={m.geo.fus} material={m.fusLine} />
      <lineSegments geometry={m.geo.wing} material={m.wingLine} />
      <mesh ref={scanRef} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial map={m.glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <Line ref={sliceRef} points={slice} color="#ffffff" lineWidth={2.2} transparent depthTest={false} />
      <Tag tl={tl} position={ribPoints(SLICE_S, 1)[6]} show={(t) => win(t, T.cut1 - 2.0, T.cut1 - 0.1, 0.4, 0.2)} offset={[5.5, -3]}>
        <Hud>SECTION A–A</Hud>
      </Tag>
    </group>
  );
}

/* ---------- wing-slice lab ---------- */
function SurfaceVectors({ tl, flow, grow }: { tl: Timeline; flow: FlowField; grow: (t: number) => number }) {
  const vecs = useMemo(() => {
    const o = flow.outline;
    const n = o.length;
    const out: { origin: [number, number, number]; dir: [number, number, number]; len: number; color: string }[] = [];
    for (let k = 0; k < 30; k++) {
      const i = Math.floor(((k + 0.5) / 30) * n);
      const a = o[(i - 2 + n) % n], b = o[(i + 2) % n], p = o[i];
      let nx = b[1] - a[1], ny = -(b[0] - a[0]);
      const l = Math.hypot(nx, ny);
      nx /= l;
      ny /= l;
      const cp = flow.cp(p[0] + nx * 0.015, p[1] + ny * 0.015);
      if (Number.isNaN(cp) || Math.abs(cp) < 0.08 || p[0] > 0.4) continue;
      const len = Math.min(0.42, Math.abs(cp) * 0.2);
      if (cp < 0) out.push({ origin: [p[0] + nx * 0.012, p[1] + ny * 0.012, 0.02], dir: [nx, ny, 0], len, color: '#7fd6ff' });
      else out.push({ origin: [p[0] + nx * (len + 0.012), p[1] + ny * (len + 0.012), 0.02], dir: [-nx, -ny, 0], len, color: AMBER });
    }
    return out;
  }, [flow]);
  return (
    <>
      {vecs.map((v, i) => (
        <Arrow key={i} tl={tl} origin={v.origin} dir={v.dir} color={v.color} thickness={0.0065} length={(t) => v.len * grow(t - i * 0.02)} />
      ))}
    </>
  );
}

const PB = { x0: -1.5, x1: 1.7, y0: -1.05, y1: 1.05 };

function Lab({ tl }: { tl: Timeline }) {
  const T = useTimes(tl);
  const flow = useMemo(() => buildFlow({ alphaDeg: 7 }, { lines: 34, spread: 1.3 }), []);
  const outline = flow.outline;
  const section = useSectionGeometry(outline, 0.5);
  const mats = useMemo(() => {
    const tex = new THREE.CanvasTexture(pressureImage(flow, 420, 276, PB, cpColor));
    tex.colorSpace = THREE.SRGBColorSpace;
    return { shell: xrayMaterial(CYAN, 0.05, 0.8), tex };
  }, [flow]);
  const loop = useMemo(() => [...outline, outline[0]].map(([x, y]) => [x, y, 0] as [number, number, number]), [outline]);
  const inner = useMemo(() => {
    // spars + stiffeners inside the section
    const segs: [number, number, number][] = [];
    const top = (x: number) => Math.max(...outline.filter((p) => Math.abs(p[0] - x) < 0.02).map((p) => p[1]));
    const bot = (x: number) => Math.min(...outline.filter((p) => Math.abs(p[0] - x) < 0.02).map((p) => p[1]));
    for (const x of [-0.28, -0.05, 0.18]) segs.push([x, bot(x) + 0.006, 0], [x, top(x) - 0.006, 0]);
    return segs;
  }, [outline]);
  const root = useRef<THREE.Group>(null);
  const pmap = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<any>(null);
  const ell = useMemo(() => Array.from({ length: 49 }, (_, i) => [-0.12 + Math.cos((i / 48) * Math.PI * 2) * 0.47, 0.2 + Math.sin((i / 48) * Math.PI * 2) * 0.125, 0.03] as [number, number, number]), []);
  const speedP = (t: number) => ramp(t, T.spA, T.spB, ease.linear);
  const flowTime = (t: number) => {
    const d = clamp01((t - T.spA) / (T.spB - T.spA));
    return 0.5 * t + 0.75 * (T.spB - T.spA) * (d * d * 0.5) + 0.75 * Math.max(0, t - T.spB);
  };
  const pOpacity = (t: number) => {
    const a = ramp(t, T.pres1, T.pres1 + 1.4, ease.out);
    const dip = win(t, T.wake1 - 0.2, T.wake2 + 0.3, 0.8, 0.9);
    return a * (1 - 0.72 * dip) * (1 - 0.6 * ramp(t, T.speed - 0.3, T.speed + 0.8));
  };
  useFilmFrame(tl, (t) => {
    const on = t >= T.cut1 && t < T.cut2;
    root.current!.visible = on;
    if (!on) return;
    pmap.current!.opacity = pOpacity(t);
    const h = win(t, T.flow2 + 0.8, T.pres1 + 0.4, 0.5, 0.6);
    ring.current.visible = h > 0.01;
    ring.current.material.opacity = h * (0.65 + 0.3 * Math.sin(t * 5));
  });
  const lift = (t: number) => {
    const v = 0.35 + 0.8 * speedP(t);
    return 0.5 * v * v * ramp(t, T.speed + 0.3, T.speed + 1.0, ease.out);
  };
  return (
    <group ref={root} position={[0, LAB_Y, 0]} scale={S}>
      <mesh position={[(PB.x0 + PB.x1) / 2, (PB.y0 + PB.y1) / 2, -0.02]}>
        <planeGeometry args={[PB.x1 - PB.x0, PB.y1 - PB.y0]} />
        <meshBasicMaterial ref={pmap} map={mats.tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <FlowLines tl={tl} flow={flow} color={CYAN} colorBySpeed={speedColor} width={1.4} opacity={(t) => 0.8 - 0.3 * ramp(t, T.pres1, T.pres1 + 1) + 0.3 * ramp(t, T.wake1 - 0.3, T.wake1 + 0.6)} reveal={(t) => ramp(t, T.cut1 + 0.2, T.flow1 + 3.2, ease.inOut)} />
      <FlowDots tl={tl} flow={flow} perLine={6} size={0.009} stretch={1.6} flowTime={flowTime} opacity={(t) => 0.95 * ramp(t, T.flow1 + 2.4, T.flow1 + 3.6)} color={dotColor}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </FlowDots>
      <mesh geometry={section} material={mats.shell} />
      <mesh position={[0, 0, -0.01]}>
        <shapeGeometry args={[useMemo(() => new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))), [outline])]} />
        <meshBasicMaterial color="#06131f" toneMapped={false} />
      </mesh>
      <Line points={loop} color={ICE} lineWidth={2} />
      <Line points={inner} segments color={CYAN} lineWidth={1} transparent opacity={0.6} />
      <Line ref={ring} points={ell} color="#ffffff" lineWidth={1.4} dashed dashSize={0.035} gapSize={0.025} transparent />
      <SurfaceVectors tl={tl} flow={flow} grow={(t) => ramp(t, T.pres2 - 0.4, T.pres2 + 1.0, ease.out) * (1 - ramp(t, T.wake1 - 0.4, T.wake1 + 0.4))} />
      {/* momentum view */}
      <Arrow tl={tl} origin={[0.98, 0.02, 0.03]} dir={[0, -1, 0]} color={AMBER} thickness={0.014} length={(t) => 0.42 * ramp(t, T.wake1 + 1.6, T.wake1 + 2.4, ease.out) * (1 - ramp(t, T.speed - 0.2, T.speed + 0.5))} />
      <Arrow tl={tl} origin={[-0.1, 0.11, 0.03]} dir={[0, 1, 0]} color={ICE} thickness={0.014} length={(t) => 0.42 * ramp(t, T.wake2 + 0.4, T.wake2 + 1.2, ease.out) * (1 - ramp(t, T.speed - 0.2, T.speed + 0.5))} />
      {/* lift vs weight during the speed scene */}
      <Arrow tl={tl} origin={[-0.1, 0.11, 0.03]} dir={[0, 1, 0]} color={ICE} thickness={0.016} length={lift} />
      <Arrow tl={tl} origin={[-0.1, -0.06, 0.03]} dir={[0, -1, 0]} color={AMBER} thickness={0.016} length={(t) => 0.5 * ramp(t, T.speed + 0.3, T.speed + 1.0, ease.out)} />

      <Tag tl={tl} position={[-0.85, 0.66, 0]} show={(t) => win(t, T.flow1 + 1.0, T.flow2 + 0.3, 0.5, 0.5)}>
        <Hud>STREAMLINES</Hud>
      </Tag>
      <Tag tl={tl} position={[-0.12, 0.5, 0]} show={(t) => win(t, T.flow2 + 1.6, T.pres1 + 0.3, 0.5, 0.5)}>
        <Hud big>FASTER → LOWER PRESSURE</Hud>
      </Tag>
      <Tag tl={tl} position={[-0.1, 0.6, 0]} show={(t) => win(t, T.pres1 + 1.2, T.wake1 - 0.2, 0.5, 0.5)}>
        <Hud big color="#8fd0ff">LOW P</Hud>
      </Tag>
      <Tag tl={tl} position={[-0.25, -0.42, 0]} show={(t) => win(t, T.pres1 + 0.5, T.wake1 - 0.2, 0.5, 0.5)}>
        <Hud big color={AMBER}>HIGH P</Hud>
      </Tag>
      <Tag tl={tl} position={[0.98, -0.52, 0]} show={(t) => win(t, T.wake1 + 2.0, T.speed, 0.5, 0.4)}>
        <Hud big color={AMBER}>DOWNWASH</Hud>
      </Tag>
      <Tag tl={tl} position={[-0.1, 0.64, 0]} show={(t) => win(t, T.wake2 + 0.8, T.speed, 0.5, 0.4)}>
        <Hud big>REACTION = LIFT</Hud>
      </Tag>
      <Tag tl={tl} position={(t) => [-0.1, 0.2 + lift(t), 0]} show={(t) => win(t, T.speed + 0.9, T.cut2, 0.4, 0.3)}>
        <Hud>LIFT</Hud>
      </Tag>
      <Tag tl={tl} position={[-0.1, -0.66, 0]} show={(t) => win(t, T.speed + 0.9, T.cut2, 0.4, 0.3)}>
        <Hud color={AMBER}>WEIGHT</Hud>
      </Tag>
    </group>
  );
}

/* ---------- deflected air stream behind the whole aircraft ---------- */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _zAxis = new THREE.Vector3(0, 0, 1), _c = new THREE.Color();
const N_STREAM = 300;
function streamPath(az: number, sign: number, u: number, out: THREE.Vector3) {
  const s = clamp01((az - WING.z) / WING.span);
  const chord = WING.root + (WING.tip - WING.root) * s;
  const xLE = WING.x + WING.sweep * s;
  const xTE = xLE + chord;
  const y0 = WING.y + WING.dihedral * s;
  const x = lerp(xLE - 4.5, xTE + 13, u);
  let y = y0 + 0.16;
  if (x > xLE) y = y0 + 0.16 - 0.3 * ease.smooth(clamp01((x - xLE) / chord));
  if (x > xTE) y -= 0.17 * (x - xTE) * (1 - 0.35 * s);
  out.set(x, y, sign * az);
}
function Downwash({ tl }: { tl: Timeline }) {
  const T = useTimes(tl);
  const ref = useRef<THREE.InstancedMesh>(null);
  const lines = useMemo(() => {
    const a: number[] = [];
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    for (const sign of [1, -1])
      for (let k = 0; k < 12; k++) {
        const az = 0.75 + (k / 11) * 4.2;
        for (let i = 0; i < 40; i++) {
          streamPath(az, sign, i / 40, v);
          streamPath(az, sign, (i + 1) / 40, w);
          a.push(v.x, v.y, v.z, w.x, w.y, w.z);
        }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    return g;
  }, []);
  const lmat = useRef<THREE.LineBasicMaterial>(null);
  const cA = useMemo(() => new THREE.Color(CYAN), []);
  const cB = useMemo(() => new THREE.Color(AMBER), []);
  useFilmFrame(tl, (t) => {
    const o = ramp(t, T.cut2 + 0.3, T.cut2 + 1.6) * (1 - ramp(t, T.rev - 0.2, T.rev + 1.2));
    const mesh = ref.current!;
    mesh.visible = o > 0.004 && t >= T.cut2;
    lmat.current!.opacity = 0.2 * o;
    if (!mesh.visible) return;
    (mesh.material as THREE.Material).opacity = o;
    for (let i = 0; i < N_STREAM; i++) {
      const sign = i % 2 ? 1 : -1;
      const az = 0.7 + rand(i * 3 + 1) * 4.3;
      const u = (t * 0.2 + rand(i * 7 + 2)) % 1;
      streamPath(az, sign, u, _p);
      const x0 = _p.x, y0 = _p.y;
      streamPath(az, sign, Math.min(1, u + 0.01), _s);
      _q.setFromAxisAngle(_zAxis, Math.atan2(_s.y - y0, _s.x - x0));
      const k = Math.min(1, u / 0.08, (1 - u) / 0.12);
      const warm = clamp01((u - 0.3) / 0.35);
      _s.set(0.34 * k, 0.022 * k, 0.022 * k);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      mesh.setColorAt(i, _c.copy(cA).lerp(cB, warm));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <lineSegments geometry={lines}>
        <lineBasicMaterial ref={lmat} color={CYAN} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </lineSegments>
      <instancedMesh ref={ref} args={[undefined, undefined, N_STREAM]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/* ---------- timing ---------- */
function times(tl: Timeline) {
  const hook = tl.cue('d-hook-1');
  const speed = tl.cue('d-speed-1');
  const rev = tl.scene('d-reveal').start;
  return {
    scanA: hook.start + 0.9,
    scanB: lerp(hook.start, hook.end, 0.82),
    mys: tl.scene('d-mystery').start,
    mysCue: tl.cue('d-mys-1').start,
    mysEnd: tl.cue('d-mys-1').end,
    cut1: tl.scene('d-flow').start,
    flow1: tl.cue('d-flow-1').start,
    flow2: tl.cue('d-flow-2').start,
    pres1: tl.cue('d-pres-1').start,
    pres2: tl.cue('d-pres-2').start,
    wake1: tl.cue('d-wake-1').start,
    wake2: tl.cue('d-wake-2').start,
    speed: speed.start,
    spA: speed.start + 1.0,
    spB: lerp(speed.start, speed.end, 0.88),
    cut2: tl.scene('d-aha').start,
    aha1: tl.cue('d-aha-1').start,
    aha2: tl.cue('d-aha-2').start,
    rev,
    revCue: tl.cue('d-rev-1').start,
    revEnd: tl.cue('d-rev-1').end,
    end: tl.timing.duration,
  };
}
const useTimes = (tl: Timeline) => useMemo(() => times(tl), [tl]);

function cameraKeys(T: ReturnType<typeof times>): CamKey[] {
  const L = LAB_Y;
  const wp = ribPoints(SLICE_S, 1)[0];
  return [
    { t: 0, pos: [-10.5, 2.6, 9.5], look: [-0.3, 0, 0], fov: 34 },
    { t: T.mys, pos: [-8.2, 2.9, 9.2], look: [0, -0.1, 0.4], fov: 34, ease: ease.linear },
    { t: T.mysCue + 3.2, pos: [-5.6, 4.2, 9.4], look: [-1.3, 0.7, 1.6], fov: 32 },
    { t: T.cut1 - 0.001, pos: [-3.6, 3.2, 7.6], look: [wp[0] - 0.2, wp[1], wp[2] - 0.4], fov: 26, ease: ease.in },
    { t: T.cut1, pos: [0.6, L + 0.5, 15], look: [0.6, L, 0], fov: 30 },
    { t: T.flow2, pos: [1.2, L + 0.5, 18], look: [1.2, L, 0], fov: 30 },
    { t: T.flow2 + 2.6, pos: [-0.3, L + 1.6, 14.5], look: [-0.3, L + 0.8, 0], fov: 30 },
    { t: T.pres1 - 0.2, pos: [-0.3, L + 1.6, 14.3], look: [-0.3, L + 0.8, 0], fov: 30, ease: ease.linear },
    { t: T.pres1 + 1.8, pos: [0.2, L + 0.3, 16.5], look: [0.2, L, 0], fov: 30 },
    { t: T.wake1, pos: [0.2, L + 0.3, 15.4], look: [0.2, L, 0], fov: 30, ease: ease.linear },
    { t: T.wake1 + 2.0, pos: [3.4, L - 0.2, 16.5], look: [3.4, L - 0.5, 0], fov: 30 },
    { t: T.wake2 + 0.2, pos: [3.6, L - 0.2, 16.5], look: [3.6, L - 0.5, 0], fov: 30, ease: ease.linear },
    { t: T.wake2 + 1.8, pos: [1.6, L + 0.2, 19], look: [1.6, L, 0], fov: 30 },
    { t: T.speed - 0.2, pos: [1.6, L + 0.2, 19], look: [1.6, L, 0], fov: 30 },
    { t: T.speed + 1.2, pos: [5.6, L + 0.4, 19], look: [5.6, L - 0.2, 0], fov: 30 },
    { t: T.cut2 - 0.001, pos: [5.6, L + 0.4, 18.4], look: [5.6, L - 0.2, 0], fov: 30, ease: ease.linear },
    { t: T.cut2, pos: [10.5, 3.4, 7.2], look: [2.6, -0.9, 0.3], fov: 36 },
    { t: T.rev - 0.3, pos: [12.5, 4.4, 8.2], look: [3.0, -1.0, 0.3], fov: 36, ease: ease.linear },
    { t: T.rev + 2.2, pos: [0, 0.2, 15.5], look: [0, -1.2, 0], fov: 34 },
    { t: T.end, pos: [0, 0.2, 16.8], look: [0, -1.2, 0], fov: 34, ease: ease.linear },
  ];
}

/* ---------- film ---------- */
function Film({ tl }: { tl: Timeline }) {
  const T = useTimes(tl);
  const keys = useMemo(() => cameraKeys(T), [T]);
  const fa = (a: number, d = 0) => (t: number) => ramp(t, T.revCue + a, T.revCue + a + 0.7, ease.out) * 1.7 + d;
  const ahaL = (a: number) => (t: number) => 1.5 * ramp(t, T.aha2 + a, T.aha2 + a + 0.8, ease.out) * (1 - ramp(t, T.rev - 0.3, T.rev + 0.4));
  const show = (a: number) => (t: number) => ramp(t, T.revCue + a + 0.4, T.revCue + a + 0.9);
  return (
    <>
      <color attach="background" args={[BG]} />
      <CameraRig tl={tl} keys={keys} shake={0.03} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-6, 8, 6]} intensity={2.4} />
      <directionalLight position={[5, -2, -6]} intensity={0.5} color={CYAN} />
      <Aircraft tl={tl} />
      <Lab tl={tl} />
      <Downwash tl={tl} />
      {/* aha: exchange of momentum */}
      <Arrow tl={tl} origin={[4.6, -0.9, 0]} dir={[0, -1, 0]} color={AMBER} thickness={0.06} length={ahaL(0.3)} />
      <Arrow tl={tl} origin={[-0.4, 0.65, 0]} dir={[0, 1, 0]} color={ICE} thickness={0.06} length={ahaL(1.6)} />
      {/* reveal: free-body diagram */}
      <Arrow tl={tl} origin={[-0.3, 0.6, 0]} dir={[0, 1, 0]} color={ICE} thickness={0.06} length={fa(1.0)} />
      <Arrow tl={tl} origin={[-0.3, -0.6, 0]} dir={[0, -1, 0]} color={AMBER} thickness={0.06} length={fa(0.2)} />
      <Arrow tl={tl} origin={[-5.15, 0, 0]} dir={[-1, 0, 0]} color={ICE} thickness={0.06} length={fa(1.7)} />
      <Arrow tl={tl} origin={[5.15, 0.25, 0]} dir={[1, 0, 0]} color={AMBER} thickness={0.06} length={fa(2.4)} />
      <Tag tl={tl} position={[-0.3, 2.75, 0]} show={show(1.0)}><Hud big>LIFT</Hud></Tag>
      <Tag tl={tl} position={[-0.3, -2.75, 0]} show={show(0.2)}><Hud big color={AMBER}>WEIGHT</Hud></Tag>
      <Tag tl={tl} position={[-7.65, 0, 0]} show={show(1.7)}><Hud big>THRUST</Hud></Tag>
      <Tag tl={tl} position={[7.55, 0.25, 0]} show={show(2.4)}><Hud big color={AMBER}>DRAG</Hud></Tag>
    </>
  );
}

/* ---------- overlay ---------- */
function Hud({ children, big, color = ICE }: { children: React.ReactNode; big?: boolean; color?: string }) {
  return (
    <span className="font-mono" style={{ fontSize: big ? '1.45cqw' : '1.1cqw', fontWeight: 600, letterSpacing: '0.12em', color, padding: '0.3cqw 0.7cqw', background: 'rgba(3,10,18,.72)', border: `1px solid ${color}55`, borderRadius: '0.25cqw' }}>
      {children}
    </span>
  );
}

const mono = (size: number, color = ICE, extra: React.CSSProperties = {}): React.CSSProperties => ({ fontSize: `${size}cqw`, color, letterSpacing: '0.1em', ...extra });

function Overlay({ tl }: { tl: Timeline }) {
  const T = useTimes(tl);
  const scenes = flightEpisode.variants.D.scenes;
  const gx = (v: number) => 44 + (v / 1.15) * 330;
  const gy = (l: number) => 236 - (l / 1.4) * 200;
  const curve = useMemo(() => Array.from({ length: 47 }, (_, i) => (i / 46) * 1.15).map((v, i) => `${i ? 'L' : 'M'}${gx(v).toFixed(1)} ${gy(v * v).toFixed(1)}`).join(' '), []);
  return (
    <div className="font-mono absolute inset-0">
      {/* grid + vignette */}
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(56,225,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,225,255,.05) 1px, transparent 1px)', backgroundSize: '5cqw 5cqw', mixBlendMode: 'screen' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 48%, rgba(2,5,10,.82) 100%)' }} />
      {/* cut masks */}
      <Live tl={tl} className="inset-0" style={{ background: BG }} update={(el, t) => (el.style.opacity = String(Math.max(1 - Math.abs(t - T.cut1) / 0.28, 1 - Math.abs(t - T.cut2) / 0.28, 0)))} />
      {/* frame + scene id */}
      {(['left-[2%] top-[3.5%] border-l border-t', 'right-[2%] top-[3.5%] border-r border-t', 'left-[2%] bottom-[3.5%] border-l border-b', 'right-[2%] bottom-[3.5%] border-r border-b'] as const).map((c) => (
        <div key={c} className={`absolute ${c}`} style={{ width: '2.2cqw', height: '2.2cqw', borderColor: 'rgba(56,225,255,.45)' }} />
      ))}
      {scenes.map((s, i) => (
        <Show key={s.id} tl={tl} from={tl.scene(s.id).start + 0.15} to={tl.scene(s.id).end + 0.1} className="right-[4%] top-[5%] text-right" rise={0.3} fade={0.3}>
          <div style={mono(0.95, 'rgba(56,225,255,.8)')}>
            D-{String(i + 1).padStart(2, '0')} / {s.title.toUpperCase()}
          </div>
        </Show>
      ))}

      {/* hook */}
      <Live
        tl={tl}
        className="left-[5%] bottom-[19%]"
        update={(el, t) => {
          const p = ramp(t, T.scanA, T.scanB, ease.inOut);
          el.style.opacity = String(win(t, 0.3, T.mys + 0.4, 0.5, 0.5));
          const a = el.firstElementChild as HTMLElement, b = el.lastElementChild as HTMLElement;
          a.textContent = p >= 1 ? 'X-RAY: ON' : p > 0 ? `X-RAY: ${String(Math.round(p * 100)).padStart(2, '0')}%` : 'PAINT: ON';
          a.style.color = p >= 1 ? CYAN : ICE;
          b.style.width = `${p * 100}%`;
        }}
      >
        <div style={mono(2.6, ICE, { fontWeight: 700 })} />
        <div style={{ height: '0.22cqw', marginTop: '0.5cqw', background: CYAN, boxShadow: `0 0 1cqw ${CYAN}` }} />
      </Live>

      {/* mystery readouts */}
      <Show tl={tl} from={T.mysCue + 0.9} to={T.cut1 - 0.15} className="left-[4%] top-[13%]" style={{ background: 'rgba(3,10,18,.78)', border: '1px solid rgba(56,225,255,.3)', padding: '0.7cqw 1.2cqw', minWidth: '21cqw' }} rise={0.5}>
        <div style={mono(0.95, 'rgba(56,225,255,.85)')}>MASS</div>
        <div style={mono(3.4, ICE, { fontWeight: 700, lineHeight: 1.1 })}>400 t</div>
      </Show>
      <Show tl={tl} from={lerp(T.mysCue, T.mysEnd, 0.5)} to={T.cut1 - 0.15} className="left-[4%] top-[25.5%]" style={{ background: 'rgba(3,10,18,.78)', border: '1px solid rgba(255,177,74,.35)', padding: '0.7cqw 1.2cqw', minWidth: '21cqw' }} rise={0.5}>
        <div style={mono(0.95, 'rgba(255,177,74,.9)')}>REQUIRED LIFT</div>
        <div style={mono(3.4, AMBER, { fontWeight: 700, lineHeight: 1.1 })}>≈ 3.9 MN</div>
        <div style={mono(0.85, 'rgba(217,251,255,.6)', { marginTop: '0.3cqw' })}>= 400 t × g</div>
      </Show>
      <Simplified tl={tl} from={lerp(T.mysCue, T.mysEnd, 0.5) + 0.4} to={T.cut1 - 0.2} text={simp('d-mystery')} />

      {/* flow */}
      <Simplified tl={tl} from={T.flow1 + 0.8} to={T.pres1 - 0.3} text={simp('d-flow')} />
      <Show tl={tl} from={T.flow1 + 2.6} to={T.pres1 + 0.2} className="left-[5%] bottom-[18%]" rise={0.4}>
        <div style={mono(0.9, 'rgba(217,251,255,.8)', { marginBottom: '0.35cqw' })}>AIR SPEED</div>
        <div style={{ width: '15cqw', height: '0.5cqw', background: `linear-gradient(90deg, ${AMBER}, #1c7ea8 45%, #d2fcff)` }} />
        <div className="flex justify-between" style={mono(0.8, 'rgba(217,251,255,.65)', { marginTop: '0.25cqw', width: '15cqw' })}>
          <span>SLOWER</span>
          <span>FASTER</span>
        </div>
      </Show>

      {/* pressure */}
      <Simplified tl={tl} from={T.pres1 + 0.6} to={T.wake1 - 0.3} text={simp('d-pressure')} />
      <Show tl={tl} from={T.pres1 + 1.0} to={T.wake1 - 0.2} className="left-[5%] bottom-[18%]" rise={0.4}>
        <div style={mono(0.9, 'rgba(217,251,255,.8)', { marginBottom: '0.35cqw' })}>PRESSURE vs SURROUNDING AIR</div>
        <div style={{ width: '15cqw', height: '0.5cqw', background: `linear-gradient(90deg, #4aa6ff, rgba(74,166,255,0) 48%, rgba(255,150,60,0) 52%, #ff963c)` }} />
        <div className="flex justify-between" style={mono(0.8, 'rgba(217,251,255,.65)', { marginTop: '0.25cqw', width: '15cqw' })}>
          <span>LOWER</span>
          <span>HIGHER</span>
        </div>
      </Show>
      <Show tl={tl} from={lerp(T.pres2, T.wake1, 0.55)} to={T.wake1 - 0.2} className="right-[5%] top-[15%] text-right" rise={0.5}>
        <div style={mono(0.95, 'rgba(56,225,255,.85)')}>SHARE OF LIFT</div>
        <div style={mono(2.1, ICE, { fontWeight: 700 })}>MOSTLY UPPER SURFACE</div>
      </Show>

      {/* wake */}
      <Simplified tl={tl} from={T.wake1 + 1.6} to={T.speed - 0.3} text="Vector lengths are illustrative, not to scale." />
      <Show tl={tl} from={lerp(T.wake2, T.speed, 0.5)} to={T.speed - 0.2} className="left-[5%] top-[14%]" rise={0.5}>
        <div style={mono(2.1, ICE, { fontWeight: 700, lineHeight: 1.25 })}>ONE FORCE</div>
        <div style={mono(1.3, 'rgba(56,225,255,.9)')}>MEASURED TWO WAYS</div>
      </Show>

      {/* speed graph */}
      <Show tl={tl} from={T.speed + 0.5} to={T.cut2 - 0.15} className="right-[4.5%] top-[13%]" style={{ width: '44cqw' }} rise={0.8}>
        <Live
          tl={tl}
          className="relative"
          style={{ position: 'relative', background: 'rgba(3,10,18,.86)', border: '1px solid rgba(56,225,255,.3)', padding: '1.2cqw 1.4cqw 1cqw' }}
          update={(el, t) => {
            const p = ramp(t, T.spA, T.spB, ease.linear);
            const v = p * 1.15;
            const q = (s: string) => el.querySelector(s) as SVGElement & HTMLElement;
            q('#xr-curve').style.strokeDashoffset = String(1 - p);
            q('#xr-dot').setAttribute('transform', `translate(${gx(v)} ${gy(v * v)})`);
            q('#xr-drop').setAttribute('d', `M${gx(v)} ${gy(v * v)} V236`);
            const over = v >= 1;
            q('#xr-speed').textContent = `${String(Math.round(v * 100)).padStart(3, '0')}%`;
            q('#xr-lift').textContent = `${String(Math.round(v * v * 100)).padStart(3, '0')}%`;
            q('#xr-lift').style.color = over ? '#ffffff' : ICE;
            q('#xr-over').style.opacity = String(ramp(t, T.spB - (T.spB - T.spA) * 0.13, T.spB - (T.spB - T.spA) * 0.13 + 0.35));
          }}
        >
          <div className="flex items-baseline justify-between">
            <div style={mono(1.5, ICE, { fontWeight: 700 })}>LIFT ∝ SPEED²</div>
            <div id="xr-over" style={mono(1.3, '#04080f', { fontWeight: 700, background: CYAN, padding: '0.15cqw 0.7cqw', opacity: 0 })}>LIFT &gt; WEIGHT</div>
          </div>
          <svg viewBox="0 0 400 262" style={{ width: '100%', display: 'block', marginTop: '0.4cqw' }}>
            <path d="M44 20 V236 H386" fill="none" stroke="rgba(217,251,255,.55)" strokeWidth="1.2" />
            {[0.25, 0.5, 0.75, 1].map((v) => (
              <path key={v} d={`M${gx(v)} 236 v5`} stroke="rgba(217,251,255,.55)" strokeWidth="1" />
            ))}
            <path d={`M44 ${gy(1)} H386`} stroke={AMBER} strokeWidth="1.6" strokeDasharray="6 5" />
            <text x="384" y={gy(1) - 7} textAnchor="end" fill={AMBER} fontSize="14" fontWeight="600" letterSpacing="1.5">WEIGHT</text>
            <path id="xr-drop" d="" stroke="rgba(56,225,255,.5)" strokeWidth="1" strokeDasharray="3 3" />
            <path id="xr-curve" d={curve} fill="none" stroke={CYAN} strokeWidth="3" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ filter: `drop-shadow(0 0 4px ${CYAN})` }} />
            <g id="xr-dot">
              <circle r="6.5" fill="#fff" />
              <circle r="11" fill="none" stroke={CYAN} strokeWidth="1.2" />
            </g>
            <text x="44" y="257" fill="rgba(217,251,255,.8)" fontSize="13" letterSpacing="1.5">SPEED →</text>
            <text x={gx(1)} y="257" textAnchor="middle" fill="rgba(217,251,255,.8)" fontSize="13" letterSpacing="1">TAKEOFF</text>
            <text x="34" y="22" textAnchor="end" fill="rgba(217,251,255,.8)" fontSize="13" letterSpacing="1.5" transform="rotate(-90 34 22)">LIFT →</text>
          </svg>
          <div className="flex" style={{ gap: '2.4cqw', marginTop: '0.5cqw' }}>
            <div>
              <div style={mono(0.95, 'rgba(56,225,255,.85)')}>SPEED / TAKEOFF SPEED</div>
              <div id="xr-speed" style={mono(1.9, ICE, { fontWeight: 700 })}>000%</div>
            </div>
            <div>
              <div style={mono(0.95, 'rgba(56,225,255,.85)')}>LIFT / WEIGHT</div>
              <div id="xr-lift" style={mono(1.9, ICE, { fontWeight: 700 })}>000%</div>
            </div>
          </div>
        </Live>
      </Show>

      {/* aha */}
      <Show tl={tl} from={T.aha2 + 0.5} to={T.rev - 0.2} className="left-[4%] top-[12%] flex items-center" rise={0.6}>
        <div className="flex items-center" style={{ gap: '1.6cqw', background: 'rgba(3,10,18,.7)', border: '1px solid rgba(56,225,255,.3)', padding: '0.6cqw 1.8cqw' }}>
          <span style={mono(2.5, AMBER, { fontWeight: 700 })}>AIR ↓</span>
          <span style={mono(2.2, 'rgba(217,251,255,.7)')}>⇄</span>
          <span style={mono(2.5, ICE, { fontWeight: 700 })}>WING ↑</span>
        </div>
      </Show>
      <Show tl={tl} from={T.aha2 + 1.2} to={T.rev - 0.2} className="left-[4%] top-[20.5%]" rise={0.4}>
        <div style={mono(0.95, 'rgba(217,251,255,.75)')}>CONTINUOUS EXCHANGE OF MOMENTUM</div>
      </Show>

      {/* reveal */}
      <Show tl={tl} from={T.revCue + 3.4} to={T.end + 1} className="left-[5%] top-[12%]" rise={0.5}>
        <div style={mono(1.9, ICE, { fontWeight: 700, lineHeight: 1.25 })}>FORCES IN BALANCE</div>
        <div style={mono(1.1, 'rgba(56,225,255,.9)')}>STRAIGHT AND LEVEL</div>
      </Show>
      <Brand tl={tl} from={Math.max(T.revCue + 4.2, T.revEnd - 1.2)} to={T.end + 1} className="!bottom-[12.5%]" />
    </div>
  );
}

const film: FilmModule = { Film, Overlay, background: BG, flat: true };
export default film;
