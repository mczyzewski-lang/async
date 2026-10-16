import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { InstructorRig } from '@/three/rig/InstructorRig';
import { ALL_STATES } from '@/content/poses/allStates';

/** Dev-only contact sheet: renders many pose states side by side (used for visual validation). */
function Rigs({ names, yaw, spacing }: { names: string[]; yaw: number; spacing: number }) {
  const rigs = useMemo(() => names.map(() => new InstructorRig()), [names]);
  useEffect(() => {
    rigs.forEach((r, i) => {
      const s = ALL_STATES[names[i]];
      if (s) r.setPose(s, 0);
      r.group.position.x = (i - (names.length - 1) / 2) * spacing;
      r.group.rotation.y = (yaw * Math.PI) / 180;
      r.breathingAmount = 0;
      r.update(0.016);
    });
  }, [rigs, names, yaw, spacing]);
  useFrame((_, dt) => rigs.forEach((r) => r.update(dt)));
  return (
    <>
      {rigs.map((r, i) => (
        <primitive key={i} object={r.group} />
      ))}
    </>
  );
}

function Cam({ width }: { width: number }) {
  const q = new URLSearchParams(location.search);
  const z = Number(q.get('z') ?? 1);
  const cy = Number(q.get('cy') ?? 0.8);
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = (size.width / width) * z;
    cam.position.set(0, cy + 0.15, 6);
    cam.lookAt(0, cy, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, width, z, cy]);
  return null;
}

export default function PoseGrid() {
  const params = new URLSearchParams(location.search);
  const names = (params.get('grid') ?? '').split(',').filter(Boolean);
  const yaw = Number(params.get('yaw') ?? 0);
  const spacing = Number(params.get('sp') ?? 1.9);
  const width = names.length * spacing;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ece6da' }}>
      <div style={{ position: 'absolute', zIndex: 2, display: 'flex', width: '100%', font: '11px sans-serif' }}>
        {names.map((n) => (
          <div key={n} style={{ flex: 1, textAlign: 'center', padding: 4 }}>{n}</div>
        ))}
      </div>
      {[yaw, yaw - 90].map((y) => (
        <div key={y} style={{ height: '50%' }}>
          <Canvas orthographic camera={{ position: [0, 1.6, 6], near: 0.1, far: 50 }}>
            <Cam width={width} />
            <hemisphereLight args={['#fff8ee', '#8c7a66', 1.1]} />
            <directionalLight position={[2, 5, 6]} intensity={2} />
            <mesh rotation-x={-Math.PI / 2}>
              <planeGeometry args={[60, 20]} />
              <meshStandardMaterial color="#cbbba3" />
            </mesh>
            <Rigs names={names} yaw={y} spacing={spacing} />
          </Canvas>
        </div>
      ))}
    </div>
  );
}
