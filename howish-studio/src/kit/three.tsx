/** Shared, style-agnostic 3D building blocks. All motion is a pure function of tl.now(). */
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { createRoot, type Root } from 'react-dom/client';
import { sampleCam, type CamKey } from '../engine/anim';
import type { Timeline } from '../engine/timeline';
import { sampleLine, type FlowField, type Streamline } from './flow';

type TFn = (t: number) => number;

/** Keyframed camera. In portrait (9:16) the FOV widens so the 16:9 framing still fits. */
export function CameraRig({ tl, keys, shake = 0 }: { tl: Timeline; keys: CamKey[]; shake?: number }) {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const o = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40 }), []);
  useFrame(() => {
    const t = tl.now();
    sampleCam(keys, t, o);
    if (shake) {
      o.pos.x += Math.sin(t * 1.3) * shake;
      o.pos.y += Math.sin(t * 1.7 + 1) * shake * 0.7;
    }
    cam.position.copy(o.pos);
    cam.lookAt(o.look);
    const aspect = size.width / size.height;
    let fov = o.fov;
    if (aspect < 1.6) {
      const h = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (16 / 9));
      fov = (2 * Math.atan(Math.tan(h / 2) / Math.max(aspect, 0.9)) * 180) / Math.PI;
    }
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }, -1);
  return null;
}

/** Runs fn(t) every frame, before render. The standard way to animate refs in a film. */
export function useFilmFrame(tl: Timeline, fn: (t: number) => void) {
  useFrame(() => fn(tl.now()));
}

/**
 * A DOM label anchored to a 3D point; opacity driven by show(t) in 0..1.
 * Own tiny implementation (instead of drei <Html>): the label root is torn down
 * asynchronously, so switching films never unmounts a React root mid-render.
 */
export function Tag({ tl, position, show, children, className = '', offset }: { tl: Timeline; position: [number, number, number] | ((t: number) => [number, number, number]); show: TFn; children: ReactNode; className?: string; offset?: [number, number] }) {
  const gl = useThree((s) => s.gl);
  const grp = useRef<THREE.Group>(null);
  const el = useMemo(() => {
    const d = document.createElement('div');
    d.className = `film-tag ${className}`;
    d.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;opacity:0;visibility:hidden;z-index:5';
    return d;
  }, [className]);
  const root = useRef<Root | null>(null);
  useLayoutEffect(() => {
    gl.domElement.parentElement?.appendChild(el);
    const r = createRoot(el);
    root.current = r;
    return () => {
      root.current = null;
      setTimeout(() => {
        r.unmount();
        el.remove();
      }, 0);
    };
  }, [gl, el]);
  useLayoutEffect(() => {
    root.current?.render(<>{children}</>);
  });
  useFrame(({ camera }) => {
    const t = tl.now();
    const g = grp.current!;
    g.position.fromArray(typeof position === 'function' ? position(t) : position);
    g.updateWorldMatrix(true, false);
    _tagV.setFromMatrixPosition(g.matrixWorld).project(camera);
    const s = _tagV.z > 1 ? 0 : show(t);
    el.style.opacity = String(s);
    el.style.visibility = s < 0.01 ? 'hidden' : 'visible';
    if (s < 0.01) return;
    el.style.left = `${(_tagV.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-_tagV.y * 0.5 + 0.5) * 100}%`;
    el.style.transform = `translate(-50%, -50%) translate(${offset?.[0] ?? 0}cqw, ${(offset?.[1] ?? 0) + (1 - s) * 0.8}cqw)`;
  });
  return <group ref={grp} />;
}
const _tagV = new THREE.Vector3();

/** Extruded airfoil cross-section (chord along x, span along z, centred). */
export function useSectionGeometry(outline: [number, number][], depth: number, bevel = 0) {
  return useMemo(() => {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [outline, depth, bevel]);
}

/** Computed streamlines drawn as fat lines. reveal(t) draws them in from the left. */
export function FlowLines({ tl, flow, color, width = 1.5, opacity, reveal, filter, z = 0, colorBySpeed }: { tl: Timeline; flow: FlowField; color: THREE.ColorRepresentation; width?: number; opacity: TFn; reveal?: TFn; filter?: (l: Streamline, i: number) => boolean; z?: number; colorBySpeed?: (speed: number) => THREE.Color }) {
  const lines = useMemo(() => flow.lines.filter((l, i) => (filter ? filter(l, i) : true)), [flow, filter]);
  const data = useMemo(
    () =>
      lines.map((l) => {
        const pts: [number, number, number][] = [];
        const cols: [number, number, number][] = [];
        for (let i = 0; i < l.n; i += 2) {
          pts.push([l.pts[i * 2], l.pts[i * 2 + 1], z]);
          if (colorBySpeed) {
            const c = colorBySpeed(l.speed[i]);
            cols.push([c.r, c.g, c.b]);
          }
        }
        return { pts, cols };
      }),
    [lines, z, colorBySpeed],
  );
  const refs = useRef<any[]>([]);
  useFrame(() => {
    const t = tl.now();
    const o = opacity(t);
    const r = reveal ? reveal(t) : 1;
    refs.current.forEach((ln, i) => {
      if (!ln) return;
      ln.visible = o > 0.003 && r > 0.001;
      ln.material.opacity = o;
      ln.geometry.instanceCount = Math.max(0, Math.floor((data[i].pts.length - 1) * r));
    });
  });
  return (
    <group>
      {data.map((d, i) => (
        <Line key={i} ref={(r: any) => (refs.current[i] = r)} points={d.pts} vertexColors={colorBySpeed ? d.cols : undefined} color={colorBySpeed ? 'white' : color} lineWidth={width} transparent depthWrite={false} />
      ))}
    </group>
  );
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _z = new THREE.Vector3(0, 0, 1);
const _smp = { x: 0, y: 0, speed: 0 };

/**
 * Air parcels riding the computed streamlines (instanced).
 *  - loop mode: endless stream; flowTime(t) is the flow clock.
 *  - release mode: one vertical front released at flowTime = 0 (for the "race" demo).
 */
export function FlowDots({ tl, flow, children, perLine = 7, size = 0.02, flowTime, opacity, color, mode = 'loop', filter, z = 0, stretch = 0, scaleFn }: { tl: Timeline; flow: FlowField; children: ReactNode; perLine?: number; size?: number; flowTime: TFn; opacity: TFn; color?: (speed: number, line: Streamline, out: THREE.Color) => void; mode?: 'loop' | 'release'; filter?: (l: Streamline, i: number) => boolean; z?: number; stretch?: number; scaleFn?: (t: number, index: number) => number }) {
  const lines = useMemo(() => flow.lines.filter((l, i) => (filter ? filter(l, i) : true)), [flow, filter]);
  const n = mode === 'loop' ? perLine : 1;
  const count = lines.length * n;
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (ref.current && color) for (let i = 0; i < count; i++) ref.current.setColorAt(i, _c.set('white'));
  }, [count, color]);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = tl.now();
    const o = opacity(t);
    mesh.visible = o > 0.003;
    if (!mesh.visible) return;
    (mesh.material as THREE.Material).opacity = o;
    const ft = flowTime(t);
    let k = 0;
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      const T = (l.n - 1) * flow.dt;
      for (let j = 0; j < n; j++, k++) {
        let tau: number;
        if (mode === 'loop') {
          tau = (((ft + (j / n) * T + li * 0.37) % T) + T) % T;
        } else tau = Math.max(0, Math.min(T, ft));
        sampleLine(l, flow.dt, tau, _smp);
        let s = size * (scaleFn ? scaleFn(t, k) : 1);
        if (mode === 'loop') s *= Math.min(1, tau / 0.25, (T - tau) / 0.25);
        else if (ft < 0) s = 0;
        _p.set(_smp.x, _smp.y, z);
        _q.identity();
        if (stretch) {
          sampleLine(l, flow.dt, tau + flow.dt, _smp);
          _q.setFromAxisAngle(_z, Math.atan2(_smp.y - _p.y, _smp.x - _p.x));
          _s.set(s * (1 + stretch * _smp.speed), s, s);
        } else _s.set(s, s, s);
        mesh.setMatrixAt(k, _m.compose(_p, _q, _s));
        if (color) {
          color(_smp.speed, l, _c);
          mesh.setColorAt(k, _c);
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (color && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      {children}
    </instancedMesh>
  );
}

/** Force arrow whose length is animated by length(t). Points along `dir` from `origin`. */
export function Arrow({ tl, origin, dir, length, color, thickness = 0.03, opacity, material }: { tl: Timeline; origin: [number, number, number] | ((t: number) => [number, number, number]); dir: [number, number, number]; length: TFn; color?: THREE.ColorRepresentation; thickness?: number; opacity?: TFn; material?: THREE.Material }) {
  const grp = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => material ?? new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false }), [material, color]);
  const geo = useMemo(() => {
    const shaft = new THREE.CylinderGeometry(thickness, thickness, 1, 20, 1, false);
    shaft.translate(0, 0.5, 0);
    const head = new THREE.ConeGeometry(thickness * 2.6, thickness * 5, 24);
    head.translate(0, thickness * 2.5, 0);
    return { shaft, head };
  }, [thickness]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()), [dir]);
  useFrame(() => {
    const t = tl.now();
    const L = length(t);
    const g = grp.current!;
    g.visible = L > 0.004;
    if (!g.visible) return;
    g.position.fromArray(typeof origin === 'function' ? origin(t) : origin);
    const hl = Math.min(thickness * 5, L * 0.6);
    shaft.current!.scale.set(1, Math.max(0.0001, L - hl), 1);
    head.current!.position.y = L - hl;
    head.current!.scale.set(1, hl / (thickness * 5), 1);
    if (opacity) (mat as THREE.Material).opacity = opacity(t);
  });
  return (
    <group ref={grp} quaternion={quat}>
      <mesh ref={shaft} material={mat} geometry={geo.shaft} />
      <mesh ref={head} material={mat} geometry={geo.head} />
    </group>
  );
}

/** Soft radial sprite texture (clouds, glows). */
export function softTexture(size = 128, stops: [number, string][] = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
