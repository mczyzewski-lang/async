import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { TechnicalGuide } from '@/content/types';
import { CameraRig, type CameraRequest } from './CameraRig';
import { TechOverlay } from './TechOverlay';
import { InstructorRig } from './rig/InstructorRig';
import { World, type Quality } from './world/World';
import type { EnvironmentId } from './world/environments';

export type QualitySetting = 'auto' | Quality;

function Rig({ rig, visible = true }: { rig: InstructorRig; visible?: boolean }) {
  useFrame((_, dt) => rig.update(Math.min(dt, 0.1)));
  return <primitive object={rig.group} visible={visible} />;
}

/** Renders two synchronized views (left: rig A, right: rig B) with one shared camera. */
function SplitRenderer({ a, b }: { a: InstructorRig; b: InstructorRig }) {
  const { gl, scene, camera, size } = useThree();
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const w = size.width;
    const h = size.height;
    const half = Math.floor(w / 2);
    const origAspect = cam.aspect;
    cam.aspect = half / h;
    cam.updateProjectionMatrix();
    gl.setScissorTest(true);
    for (const [i, show, hide] of [[0, a, b], [1, b, a]] as const) {
      show.group.visible = true;
      hide.group.visible = false;
      gl.setViewport(i * half, 0, half, h);
      gl.setScissor(i * half, 0, half, h);
      gl.render(scene, cam);
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, w, h);
    a.group.visible = true;
    b.group.visible = true;
    cam.aspect = origAspect;
    cam.updateProjectionMatrix();
  }, 1);
  return null;
}

export interface StageProps {
  env: EnvironmentId;
  quality?: QualitySetting;
  onRig?: (rig: InstructorRig) => void;
  compare?: boolean;
  onCompareRig?: (rig: InstructorRig) => void;
  camera?: CameraRequest | null;
  techMode?: boolean;
  guides?: TechnicalGuide[];
  autoRotate?: boolean;
  interactive?: boolean;
  className?: string;
  onInteract?: () => void;
  onCameraUpdate?: (cam: THREE.Camera, target: THREE.Vector3) => void;
  children?: ReactNode;
  testId?: string;
  viewShift?: number;
  viewShiftX?: number;
}

export function Stage({
  env,
  quality = 'auto',
  onRig,
  compare = false,
  onCompareRig,
  camera = null,
  techMode = false,
  guides = [],
  autoRotate = false,
  interactive = true,
  className,
  onInteract,
  onCameraUpdate,
  children,
  testId = 'stage',
  viewShift = 0,
  viewShiftX = 0,
}: StageProps) {
  const rig = useMemo(() => new InstructorRig(), []);
  const rigB = useMemo(() => new InstructorRig(), []);
  const rigRef = useRef(rig);
  const [auto, setAuto] = useState<Quality>(() => (typeof window !== 'undefined' && window.innerWidth < 700 ? 'medium' : 'high'));
  const q: Quality = quality === 'auto' ? auto : quality;
  const [dpr, setDpr] = useState(() => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1));

  useEffect(() => {
    onRig?.(rig);
  }, [rig, onRig]);
  useEffect(() => {
    if (compare) onCompareRig?.(rigB);
  }, [compare, rigB, onCompareRig]);
  useEffect(
    () => () => {
      rig.dispose();
      rigB.dispose();
    },
    [rig, rigB],
  );
  const getRig = useCallback(() => rigRef.current, []);

  return (
    <div className={`canvas-touch ${className ?? ''}`} data-testid={testId} data-rig-tag="">
      <Canvas
        shadows={q !== 'low' ? 'soft' : false}
        dpr={dpr}
        gl={{ antialias: q !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: true }}
        camera={{ fov: 40, near: 0.05, far: 900, position: [1.6, 1.3, 4.2] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
        }}
      >
        <PerformanceMonitor
          onDecline={() => {
            setDpr((d) => Math.max(1, d - 0.25));
            if (quality === 'auto') setAuto((a) => (a === 'high' ? 'medium' : 'low'));
          }}
          onIncline={() => setDpr((d) => Math.min(window.devicePixelRatio, d + 0.25, q === 'high' ? 2 : 1.5))}
        />
        <Suspense fallback={null}>
          <World envId={env} quality={q} />
        </Suspense>
        <Rig rig={rig} />
        {compare && <Rig rig={rigB} />}
        {compare && <SplitRenderer a={rig} b={rigB} />}
        {techMode && <TechOverlay rig={getRig} guides={guides} />}
        <CameraRig rig={getRig} request={camera} autoRotate={autoRotate} enabled={interactive} onInteract={onInteract} onUpdate={onCameraUpdate} viewShift={viewShift} viewShiftX={viewShiftX} />
        {children}
      </Canvas>
    </div>
  );
}
