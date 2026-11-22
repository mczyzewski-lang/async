/** STYLE A — CINEMATIC 3D. Documentary look: real scale, sunlit airliner, the wing sliced open to reveal computed airflow. */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Line } from '@react-three/drei';
import { ease, lerp, ramp, rand, win, type CamKey } from '../../engine/anim';
import type { Timeline } from '../../engine/timeline';
import { Airliner, WING, type AirlinerMaterials } from '../../kit/airliner';
import { buildFlow, pressureImage } from '../../kit/flow';
import { Brand, Live, Show, Simplified } from '../../kit/overlay';
import { Arrow, CameraRig, FlowDots, FlowLines, Tag, softTexture, useFilmFrame, useSectionGeometry } from '../../kit/three';
import type { FilmModule } from '../types';

const PITCH = (5 * Math.PI) / 180;
const SLICE_Z = 2.45;
const SUN = new THREE.Vector3(1, 0.17, -0.5).normalize();

// where the slice cuts the wing (plane-local -> world, plane is pitched nose-up about z)
const sFrac = (SLICE_Z - WING.z) / WING.span;
const CHORD = WING.root + (WING.tip - WING.root) * sFrac;
const lx = WING.x + WING.sweep * sFrac + CHORD * 0.5;
const ly = WING.y + WING.dihedral * sFrac;
const SEC: [number, number, number] = [lx * Math.cos(PITCH) + ly * Math.sin(PITCH), -lx * Math.sin(PITCH) + ly * Math.cos(PITCH), SLICE_Z];

/** Scene-level times every part of the film shares. */
function useBeats(tl: Timeline) {
  return useMemo(() => {
    const c = (id: string) => tl.cue(id).start;
    const s = (id: string) => tl.scene(id);
    return {
      c,
      s,
      secIn: c('a-wing-1') + 1.0,
      secOut: s('a-speed').start + 0.2,
      end: tl.timing.duration,
    };
  }, [tl]);
}

function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { sun: { value: SUN } },
        vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec3 d; uniform vec3 sun;
          void main(){
            vec3 n = normalize(d);
            float h = n.y;
            float s = max(dot(n, sun), 0.0);
            vec3 top = vec3(0.012,0.045,0.16), mid = vec3(0.07,0.2,0.46), low = vec3(0.16,0.22,0.36);
            vec3 hor = mix(vec3(0.42,0.55,0.74), vec3(1.0,0.66,0.38), pow(s, 2.5));
            vec3 c = mix(hor, mid, smoothstep(0.0,0.24,h));
            c = mix(c, top, smoothstep(0.16,0.85,h));
            c = mix(c, low, smoothstep(0.0,-0.3,h));
            c += vec3(1.0,0.55,0.25) * pow(s, 10.0) * 0.28;
            c += vec3(1.0,0.82,0.6) * pow(s, 220.0) * 0.7;
            c += vec3(1.0,0.95,0.85) * pow(s, 2600.0) * 5.0;
            gl_FragColor = vec4(c,1.0);
          }`,
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[1800, 48, 24]} />
    </mesh>
  );
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Camera-facing soft puffs. `place(i, t, out)` returns position and writes scale; all time-driven. */
function Puffs({ tl, count, place, color = '#ffffff', opacity = 0.5, additive = false, fog = true, fade }: { tl: Timeline; count: number; place: (i: number, t: number, out: THREE.Vector3) => number; color?: string; opacity?: number; additive?: boolean; fog?: boolean; fade?: (t: number) => number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(() => softTexture(128, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]), []);
  const cam = useThree((s) => s.camera);
  useFrame(() => {
    const mesh = ref.current!;
    const t = tl.now();
    const f = fade ? fade(t) : 1;
    mesh.visible = f > 0.003;
    if (!mesh.visible) return;
    (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * f;
    for (let i = 0; i < count; i++) {
      const sc = place(i, t, _p);
      mesh.setMatrixAt(i, _m.compose(_p, cam.quaternion, _s.set(sc, sc, sc)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={additive ? 6 : -5}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} color={color} transparent depthWrite={false} fog={fog} toneMapped={false} blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </instancedMesh>
  );
}

function World({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  // while the veil fully covers the frame the clouds are not drawn at all (saves fill-rate)
  const hide = { a: b.secIn + 2.4, b: b.secOut + 0.7 };
  // cloud deck streaming past (the aircraft is our reference frame)
  const deck = (i: number, t: number, out: THREE.Vector3) => {
    const x0 = (i / 150) * 520 + rand(i) * 6;
    const x = ((x0 + t * 24) % 520) - 260;
    out.set(x, -16 - rand(i + 500) * 9 - Math.abs(rand(i + 900) - 0.5) * 6, (rand(i + 100) - 0.5) * 420);
    return 26 + rand(i + 300) * 46;
  };
  // wisps at flight level, behind the aircraft, for parallax and a sense of speed
  const wisps = (i: number, t: number, out: THREE.Vector3) => {
    const x = ((rand(i + 40) * 300 + t * 58) % 300) - 150;
    out.set(x, -6 + rand(i + 70) * 16, -22 - rand(i + 90) * 60);
    return 10 + rand(i + 20) * 16;
  };
  return (
    <>
      <Sky />
      <Puffs tl={tl} count={150} place={deck} color="#d9cfc9" opacity={0.56} fade={(t) => 1 - win(t, hide.a, hide.b, 0.1, 0.1)} />
      <Puffs tl={tl} count={18} place={wisps} color="#ffe3c4" opacity={0.13} fade={(t) => 1 - win(t, hide.a, hide.b, 0.1, 0.1)} />
      <mesh position={[0, -40, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial color="#3a4f73" />
      </mesh>
    </>
  );
}

function Plane({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  const gl = useThree((s) => s.gl);
  const grp = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Group>(null);
  const clip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 10), []);
  const mats = useMemo<AirlinerMaterials>(() => {
    const common = { clippingPlanes: [clip], side: THREE.DoubleSide };
    return {
      body: new THREE.MeshPhysicalMaterial({ color: '#f3f5f8', roughness: 0.34, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25, ...common }),
      wing: new THREE.MeshStandardMaterial({ color: '#c3c9d2', roughness: 0.38, metalness: 0.75, ...common }),
      engine: new THREE.MeshStandardMaterial({ color: '#e9ecf1', roughness: 0.35, metalness: 0.5, ...common }),
      dark: new THREE.MeshStandardMaterial({ color: '#0d1420', roughness: 0.2, metalness: 0.6, ...common }),
      accent: new THREE.MeshStandardMaterial({ color: '#f4a340', roughness: 0.4, metalness: 0.2, ...common }),
      windows: new THREE.MeshStandardMaterial({ color: '#0d1420', roughness: 0.25, metalness: 0.5, clippingPlanes: [clip] }),
    };
  }, [clip]);
  const glowTex = useMemo(() => softTexture(64, [[0, 'rgba(255,214,150,1)'], [0.4, 'rgba(255,150,60,.5)'], [1, 'rgba(255,120,40,0)']]), []);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  useFilmFrame(tl, (t) => {
    const sec = win(t, b.secIn, b.secOut + 1.2, 1.6, 1.2);
    const calm = 1 - sec;
    grp.current!.position.y = Math.sin(t * 0.55) * 0.09 * calm;
    grp.current!.rotation.set(Math.sin(t * 0.4) * 0.012 * calm, 0, -PITCH);
    // the outer wing is wiped away to expose its cross-section
    clip.constant = lerp(10, SLICE_Z, ramp(t, b.secIn, b.secIn + 2.2) * (1 - ramp(t, b.secOut, b.secOut + 1.2)));
    const thrust = 0.55 + 0.45 * win(t, b.c('a-speed-2') - 0.3, b.s('a-aha').start, 0.6, 0.8);
    glow.current!.children.forEach((s) => s.scale.setScalar(0.7 * thrust + Math.sin(t * 31) * 0.015));
  });
  return (
    <Airliner ref={grp} mats={mats}>
      <group ref={glow}>
        {[1, -1].map((s) => (
          <sprite key={s} position={[0.15, -0.72, 1.75 * s]}>
            <spriteMaterial map={glowTex} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
      </group>
    </Airliner>
  );
}

const lowC = new THREE.Color('#7db8ff');
const highC = new THREE.Color('#ffd08a');

/** The explanatory core: a lit slice through the wing with real streamlines, pressure and forces. */
function WingSlice({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  const flow = useMemo(() => buildFlow({ alphaDeg: 5 }, { lines: 22, spread: 0.82 }), []);
  const cap = useSectionGeometry(flow.outline, 0.012);
  const capMat = useRef<THREE.MeshBasicMaterial>(null);
  const veil = useRef<THREE.MeshBasicMaterial>(null);
  const pres = useRef<THREE.MeshBasicMaterial>(null);
  const tilt = useRef<THREE.Group>(null);
  const PB = { x0: -1.5, x1: 1.9, y0: -0.95, y1: 0.95 };
  const presTex = useMemo(() => {
    const cv = pressureImage(flow, 340, 190, PB, (cp) => (cp < 0 ? [90, 170, 255, Math.min(1, -cp / 1.1) * 215] : [255, 138, 60, Math.min(1, cp / 0.55) * 215]));
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [flow]);
  const tTurn = b.c('a-turn-1');
  const tPush = b.c('a-turn-2');
  const tPres = b.c('a-pres-1');
  const tLift = b.c('a-pres-2');
  const vis = (t: number) => win(t, b.secIn + 1.4, b.secOut + 0.3, 0.9, 0.6);
  const flowVis = (t: number) => win(t, tTurn - 0.4, b.secOut + 0.2, 0.8, 0.5);
  useFilmFrame(tl, (t) => {
    capMat.current!.opacity = vis(t);
    veil.current!.opacity = 0.965 * win(t, b.secIn + 0.6, b.secOut + 0.9, 1.6, 0.9);
    pres.current!.opacity = 0.95 * win(t, tPres - 0.2, b.secOut, 1.2, 0.5);
    tilt.current!.visible = t > b.c('a-wing-2') - 0.2 && t < tTurn + 0.6;
  });
  const tiltVis = (t: number) => win(t, b.c('a-wing-2') + 0.9, tTurn + 0.3, 0.5, 0.4);
  const le = flow.outline.reduce((a, p) => (p[0] < a[0] ? p : a));
  return (
    <group position={SEC} scale={CHORD}>
      <mesh position={[0.6, 0, -0.06]}>
        <planeGeometry args={[60, 30]} />
        <meshBasicMaterial ref={veil} color="#06101f" transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
      <mesh position={[(PB.x0 + PB.x1) / 2, 0, 0.004]} renderOrder={2}>
        <planeGeometry args={[PB.x1 - PB.x0, PB.y1 - PB.y0]} />
        <meshBasicMaterial ref={pres} map={presTex} transparent opacity={0} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
      <mesh geometry={cap} position={[0, 0, 0.012]} renderOrder={3}>
        <meshBasicMaterial ref={capMat} color="#fff4de" transparent opacity={0} fog={false} toneMapped={false} />
      </mesh>
      {/* tilt reference: horizon vs chord */}
      <group ref={tilt}>
        <Line points={[[le[0], le[1], 0.03], [le[0] + 1.35, le[1], 0.03]]} color="#ffffff" lineWidth={1.2} dashed dashSize={0.04} gapSize={0.03} transparent opacity={0.7} />
        <Line points={[[le[0], le[1], 0.03], [le[0] + 1.35 * Math.cos(flow.alpha), le[1] - 1.35 * Math.sin(flow.alpha), 0.03]]} color="#ffcf8a" lineWidth={1.6} />
      </group>
      <FlowLines tl={tl} flow={flow} color="#dfeaff" width={1.4} z={0.02} opacity={(t) => 0.42 * flowVis(t)} reveal={(t) => ramp(t, tTurn - 0.3, tTurn + 2.4, ease.out)} />
      <FlowDots
        tl={tl}
        flow={flow}
        perLine={10}
        size={0.0085}
        z={0.03}
        stretch={3.2}
        flowTime={(t) => t * 0.62}
        opacity={(t) => flowVis(t) * ramp(t, tTurn + 0.2, tTurn + 1.6)}
        color={(sp, _l, out) => out.copy(lowC).lerp(highC, Math.min(1, Math.max(0, (sp - 0.85) / 0.6)))}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial transparent depthWrite={false} fog={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </FlowDots>
      {/* action / reaction */}
      <Arrow tl={tl} origin={[0.86, -0.02, 0.05]} dir={[0.22, -1, 0]} color="#8cc4ff" thickness={0.018} length={(t) => 0.5 * ramp(t, tPush + 0.2, tPush + 1.0, ease.outBack) * (1 - ramp(t, tLift - 0.4, tLift))} />
      <Arrow tl={tl} origin={[-0.08, 0.14, 0.05]} dir={[0, 1, 0]} color="#fff1d6" thickness={0.022} length={(t) => (0.4 * ramp(t, tPush + 1.5, tPush + 2.3, ease.outBack) + 0.14 * ramp(t, tLift, tLift + 0.8, ease.outBack)) * (1 - ramp(t, b.secOut - 0.3, b.secOut + 0.3))} />
      <Tag tl={tl} position={[0.2, 0.42, 0.05]} show={(t) => win(t, b.c('a-wing-2') + 0.2, tTurn + 0.2, 0.5, 0.4)} className="cine-tag">CURVED</Tag>
      <Tag tl={tl} position={[le[0] + 1.42, le[1] - 0.09, 0.05]} show={tiltVis} className="cine-tag" offset={[5, 0]}>TILTED A FEW DEGREES</Tag>
      <Tag tl={tl} position={[0.95, -0.3, 0.05]} offset={[9.5, 0]} show={(t) => win(t, tPush + 0.5, tPres - 0.2, 0.4, 0.4)} className="cine-tag cine-cool">AIR PUSHED DOWN</Tag>
      <Tag tl={tl} position={[-0.08, 0.5, 0.05]} offset={[9, 0]} show={(t) => win(t, tPush + 1.8, tPres - 0.2, 0.4, 0.4)} className="cine-tag">WING PUSHED UP</Tag>
      <Tag tl={tl} position={[-0.1, 0.34, 0.05]} show={(t) => win(t, tPres + 1.6, b.secOut - 0.2, 0.5, 0.4)} className="cine-tag cine-cool" offset={[-11, 0]}>LOWER PRESSURE</Tag>
      <Tag tl={tl} position={[-0.12, -0.3, 0.05]} show={(t) => win(t, tPres + 2.8, b.secOut - 0.2, 0.5, 0.4)} className="cine-tag cine-warm">HIGHER PRESSURE</Tag>
      <Tag tl={tl} position={[-0.08, 0.62, 0.05]} offset={[5, 0]} show={(t) => win(t, tLift + 0.9, b.secOut - 0.2, 0.4, 0.4)} className="cine-tag cine-big">LIFT</Tag>
    </group>
  );
}

/** The aha: a continuous sheet of air leaving the wings downward. */
function Downwash({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  const a = b.s('a-aha');
  const place = (i: number, t: number, out: THREE.Vector3) => {
    const side = i % 2 ? 1 : -1;
    const sp = 0.12 + rand(i) * 0.86;
    const age = (t * 0.2 + rand(i + 7)) % 1;
    const te = WING.x + WING.sweep * sp + (WING.root + (WING.tip - WING.root) * sp);
    out.set(te + age * 30, WING.y + WING.dihedral * sp - 0.1 - age * 6.5 - age * age * 2.5 + (rand(i + 3) - 0.5) * 0.25, side * (WING.z + WING.span * sp));
    return (0.22 + age * 1.5) * Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, age * 1.08))));
  };
  return (
    <>
      <Puffs tl={tl} count={900} place={place} color="#9fd4ff" opacity={0.16} additive fog={false} fade={(t) => win(t, a.start + 0.6, a.end + 0.2, 1.2, 0.5)} />
      <Arrow tl={tl} origin={[7.5, -1.6, 0]} dir={[0.25, -1, 0]} color="#bfe3ff" thickness={0.07} length={(t) => 2.6 * ramp(t, b.c('a-aha-2') + 0.6, b.c('a-aha-2') + 1.5, ease.outBack) * (1 - ramp(t, a.end - 0.4, a.end))} />
      <Arrow tl={tl} origin={[1.2, 0.9, 0]} dir={[0, 1, 0]} color="#fff1d6" thickness={0.07} length={(t) => 2.4 * ramp(t, b.c('a-aha-2') + 2.6, b.c('a-aha-2') + 3.4, ease.outBack) * (1 - ramp(t, a.end - 0.4, a.end))} />
    </>
  );
}

function Forces({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  const m = b.s('a-mystery');
  const r1 = b.c('a-rev-1');
  const r2e = tl.cue('a-rev-2').end;
  const out = (t: number) => 1 - ramp(t, r2e + 0.1, r2e + 0.8);
  const pop = (t: number, at: number, L: number) => L * ramp(t, at, at + 0.7, ease.outBack) * out(t);
  const sp = b.s('a-speed');
  // lift arrow doubles then quadruples with speed in the "speed" scene
  const speedLift = (t: number) => (0.7 + 2.1 * ramp(t, b.c('a-speed-1') + 2.0, b.c('a-speed-1') + 4.2)) * win(t, sp.start + 1.6, sp.end - 0.1, 0.6, 0.4);
  return (
    <>
      <Arrow tl={tl} origin={[0, -0.75, 0]} dir={[0, -1, 0]} color="#ffb964" thickness={0.06} length={(t) => 2.6 * ramp(t, m.start + 1.2, m.start + 2.2, ease.outBack) * (1 - ramp(t, m.end - 0.6, m.end))} />
      <Tag tl={tl} position={[0, -2.4, 0]} show={(t) => win(t, m.start + 1.8, m.end - 0.4, 0.4, 0.4)} className="cine-tag cine-big cine-warm" offset={[8, 0]}>400 TONS</Tag>
      <Arrow tl={tl} origin={[0.3, 0.7, 0]} dir={[0, 1, 0]} color="#fff1d6" thickness={0.06} length={speedLift} />
      {/* four forces */}
      <Arrow tl={tl} origin={[0.2, 0.75, 0]} dir={[0, 1, 0]} color="#fff1d6" thickness={0.07} length={(t) => pop(t, r1 + 0.1, 3.1)} />
      <Arrow tl={tl} origin={[0.2, -0.75, 0]} dir={[0, -1, 0]} color="#ffb964" thickness={0.07} length={(t) => pop(t, r1 + 0.8, 3.1)} />
      <Arrow tl={tl} origin={[-5.6, 0.1, 0]} dir={[-1, 0, 0]} color="#9ff0c0" thickness={0.06} length={(t) => pop(t, r1 + 1.9, 2.3)} />
      <Arrow tl={tl} origin={[5.6, 0.5, 0]} dir={[1, 0, 0]} color="#ff9d9d" thickness={0.06} length={(t) => pop(t, r1 + 2.6, 2.3)} />
      <Tag tl={tl} position={[0.2, 2.6, 0]} offset={[5, 0]} show={(t) => ramp(t, r1 + 0.5, r1 + 0.9) * out(t)} className="cine-tag cine-big">LIFT</Tag>
      <Tag tl={tl} position={[0.2, -2.6, 0]} offset={[7, 0]} show={(t) => ramp(t, r1 + 1.2, r1 + 1.6) * out(t)} className="cine-tag cine-big cine-warm">WEIGHT</Tag>
      <Tag tl={tl} position={[-6.8, 0.1, 0]} offset={[0, -2]} show={(t) => ramp(t, r1 + 2.2, r1 + 2.6) * out(t)} className="cine-tag cine-big cine-green">THRUST</Tag>
      <Tag tl={tl} position={[6.8, 0.5, 0]} offset={[0, -2]} show={(t) => ramp(t, r1 + 2.9, r1 + 3.3) * out(t)} className="cine-tag cine-big cine-red">DRAG</Tag>
    </>
  );
}

function Film({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  const keys = useMemo<CamKey[]>(() => {
    const S = b.s;
    const look: [number, number, number] = [SEC[0] + 0.3, SEC[1] + 0.12, SLICE_Z];
    return [
      { t: 0, pos: [-21, -6, 11], look: [0, 0.4, 0], fov: 34 },
      { t: S('a-hook').end, pos: [-14, -2.6, 15], look: [0, 0.2, 0], fov: 34, ease: ease.out },
      { t: S('a-mystery').end - 0.4, pos: [-7.5, 1.8, 10.5], look: [0, -0.5, 0.5], fov: 34 },
      { t: b.secIn + 2.6, pos: [look[0] + 0.2, 0.5, 9.4], look, fov: 26 },
      { t: b.c('a-turn-1'), pos: [look[0] + 0.1, 0.2, 8.9], look, fov: 26 },
      { t: b.c('a-pres-1'), pos: [look[0] + 0.9, 0.1, 8.7], look: [look[0] + 0.45, look[1], SLICE_Z], fov: 26 },
      { t: b.secOut, pos: [look[0] + 0.2, 0.15, 8.2], look, fov: 26 },
      { t: b.secOut + 3.2, pos: [-5, 2.6, 17], look: [0, 0.6, 0], fov: 36 },
      { t: S('a-speed').end - 0.02, pos: [-7.5, 3, 17.5], look: [0, 0.6, 0], fov: 36, ease: ease.linear },
      // cut: rear chase
      { t: S('a-aha').start, pos: [11.5, 3.6, 9], look: [3.2, -1.3, 0], fov: 38, ease: () => 1 },
      { t: S('a-aha').end - 0.02, pos: [16, 5.2, 11.5], look: [4.6, -1.9, 0], fov: 38, ease: ease.linear },
      // cut: heroic profile
      { t: S('a-reveal').start, pos: [0, 0.4, 21], look: [0, -0.9, 0], fov: 30, ease: () => 1 },
      { t: tl.cue('a-rev-2').end, pos: [-0.8, 0.8, 24.5], look: [0, -1.1, 0], fov: 30, ease: ease.linear },
      { t: b.end, pos: [-1.2, 1.0, 27], look: [0, -3.2, 0], fov: 30, ease: ease.inOut },
    ];
  }, [b]);
  return (
    <>
      <CameraRig tl={tl} keys={keys} shake={0.02} />
      <fogExp2 attach="fog" args={['#8492b4', 0.0034]} />
      <hemisphereLight args={['#9db9f0', '#c9a58c', 0.62]} />
      <directionalLight position={SUN.clone().multiplyScalar(60)} intensity={3.6} color="#ffc98f" />
      <directionalLight position={[-20, 8, 30]} intensity={0.75} color="#a9c4ff" />
      <Environment resolution={64} frames={1}>
        <color attach="background" args={['#27457e']} />
        <Lightformer form="rect" intensity={6} color="#ffc48a" position={[10, 4, -6]} scale={[10, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color="#e8c4a8" position={[0, -6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#9cc0ff" position={[0, 8, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>
      <World tl={tl} />
      <Plane tl={tl} />
      <WingSlice tl={tl} />
      <Downwash tl={tl} />
      <Forces tl={tl} />
    </>
  );
}

const big: React.CSSProperties = { fontFamily: 'var(--font-brand)', fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', textShadow: '0 0.2cqw 2cqw rgba(0,10,30,.55)' };
const small: React.CSSProperties = { fontFamily: 'var(--font-ui)', fontWeight: 500, color: 'rgba(255,255,255,.82)', letterSpacing: '0.22em', textTransform: 'uppercase', fontSize: '1.2cqw', textShadow: '0 0 1cqw rgba(0,10,30,.9)' };

function Overlay({ tl }: { tl: Timeline }) {
  const b = useBeats(tl);
  const c = b.c;
  const hook = b.s('a-hook');
  const sp = b.s('a-speed');
  const aha = b.s('a-aha');
  const turn = b.s('a-turn');
  const pres = b.s('a-pressure');
  return (
    <>
      <style>{`
        .cine-tag{font-family:var(--font-ui);font-size:1.12cqw;font-weight:600;letter-spacing:.2em;color:#fff;text-shadow:0 0 .8cqw rgba(0,8,24,.95),0 0 .2cqw rgba(0,8,24,.9)}
        .cine-cool{color:#a9d4ff}.cine-warm{color:#ffc37d}.cine-green{color:#a8f3c8}.cine-red{color:#ffb0b0}
        .cine-big{font-family:var(--font-brand);font-size:2.1cqw;letter-spacing:.26em}
      `}</style>
      {/* letterbox vignette for the documentary feel */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(2,8,20,.5) 100%)' }} />
      <Show tl={tl} from={c('a-hook-1') + 0.1} to={c('a-hook-2') - 0.1} className="left-[7%] top-[14%]">
        <div style={{ ...big, fontSize: '10cqw', lineHeight: 0.95 }}>
          400<span style={{ fontSize: '4cqw', marginLeft: '0.6cqw', fontWeight: 500 }}>tons</span>
        </div>
        <div style={{ ...small, marginTop: '1cqw' }}>metal · fuel · people</div>
      </Show>
      <Show tl={tl} from={c('a-hook-2') + 0.1} to={hook.end - 0.2} className="left-[7%] top-[14%]">
        <div style={{ ...big, fontSize: '10cqw', lineHeight: 0.95 }}>
          11<span style={{ fontSize: '4cqw', marginLeft: '0.6cqw', fontWeight: 500 }}>km up</span>
        </div>
        <div style={{ ...small, marginTop: '1cqw' }}>and nothing is holding it</div>
      </Show>
      <Show tl={tl} from={c('a-mys-2') + 0.2} to={b.s('a-mystery').end - 0.3} className="inset-x-0 top-[12%] text-center">
        <div style={{ ...big, fontSize: '4.6cqw' }}>What holds it up?</div>
      </Show>
      <Show tl={tl} from={c('a-wing-1') + 0.3} to={c('a-wing-2') - 0.1} className="left-[6%] top-[12%]">
        <div style={small}>The answer</div>
        <div style={{ ...big, fontSize: '4.6cqw', marginTop: '0.4cqw' }}>The wing</div>
      </Show>
      <Simplified tl={tl} from={turn.start + 1.2} to={pres.end - 0.4} text="2D slice of smooth, frictionless airflow. Colours and arrows exaggerated." />
      <Show tl={tl} from={c('a-turn-2') + 0.1} to={turn.end - 0.3} className="right-[5%] top-[10%] text-right">
        <div style={{ ...big, fontSize: '3.2cqw' }}>
          Air goes <span style={{ color: '#a9d4ff' }}>down</span>. Wing goes <span style={{ color: '#ffe2ad' }}>up</span>.
        </div>
      </Show>
      <Show tl={tl} from={c('a-pres-2') + 0.1} to={pres.end - 0.3} className="right-[5%] top-[10%] text-right">
        <div style={{ ...big, fontSize: '3.2cqw' }}>Two views. One force.</div>
      </Show>
      {/* speed -> lift */}
      <Show tl={tl} from={c('a-speed-1') + 1.4} to={sp.end - 0.3} className="right-[6%] top-[14%] w-[30cqw]">
        {[
          ['Speed', '#bcd6ff', 2, '× 2'],
          ['Lift', '#fff1d6', 4, '× 4'],
        ].map(([label, color, mult, txt]) => (
          <div key={label as string} style={{ marginBottom: '1.4cqw' }}>
            <div style={{ ...small, display: 'flex', justifyContent: 'space-between' }}>
              <span>{label}</span>
              <Live tl={tl} className="!static" update={(el, t) => (el.style.opacity = String(ramp(t, c('a-speed-1') + 3.6, c('a-speed-1') + 4.2)))}>
                <span style={{ color: color as string, letterSpacing: '0.05em', fontWeight: 700 }}>{txt}</span>
              </Live>
            </div>
            <div style={{ height: '0.7cqw', marginTop: '0.5cqw', background: 'rgba(255,255,255,.16)', borderRadius: '1cqw', overflow: 'hidden' }}>
              <Live tl={tl} className="!static h-full" style={{ background: color as string, borderRadius: '1cqw' }} update={(el, t) => (el.style.width = `${25 * lerp(1, mult as number, ramp(t, c('a-speed-1') + 2.0, c('a-speed-1') + 4.2))}%`)} />
            </div>
          </div>
        ))}
      </Show>
      <Show tl={tl} from={c('a-speed-2') + 0.2} to={sp.end - 0.3} className="left-[6%] bottom-[20%]">
        <div style={small}>Engines give speed</div>
        <div style={{ ...big, fontSize: '3cqw', marginTop: '0.3cqw' }}>Wings give lift</div>
      </Show>
      <Show tl={tl} from={c('a-aha-1') + 0.2} to={c('a-aha-2') + 0.3} className="right-[6%] top-[12%] text-right">
        <div style={{ ...big, fontSize: '4.6cqw' }}>Not floating.</div>
      </Show>
      <Show tl={tl} from={c('a-aha-2') + 0.6} to={aha.end - 0.3} className="right-[6%] top-[12%] text-right">
        <div style={{ ...big, fontSize: '4.2cqw', lineHeight: 1.05 }}>
          Tons of air,
          <br />
          every second.
        </div>
        <div style={{ ...small, marginTop: '1cqw' }}>pushed down — order-of-magnitude estimate</div>
      </Show>
      <Live tl={tl} className="inset-0" style={{ background: '#02060d' }} update={(el, t) => (el.style.opacity = String(Math.max(1 - ramp(t, 0, 1.2), 0.28 * ramp(t, tl.cue('a-rev-2').end + 0.2, tl.cue('a-rev-2').end + 1.2))))} />
      <Brand tl={tl} from={tl.cue('a-rev-2').end + 0.6} to={b.end + 1} className="!bottom-[24%]" />
    </>
  );
}

const film: FilmModule = { Film, Overlay, background: '#0a1730' };
export default film;
