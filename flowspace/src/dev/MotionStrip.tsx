import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { InstructorRig } from '@/three/rig/InstructorRig';
import { PoseDirector } from '@/three/director';
import { getPose } from '@/content/poses';

/**
 * Dev-only film strip of a transition: /dev/motion?from=half-forward-fold&to=bridge&n=8&yaw=90
 * Each instructor is the same movement advanced to a different moment (visual QA of transitions).
 */
function Strip({ from, to, n, yaw, spacing, settle }: { from: string; to: string; n: number; yaw: number; spacing: number; settle: boolean }) {
  const rigs = useMemo(() => {
    const out: InstructorRig[] = [];
    const a = getPose(from);
    const b = getPose(to);
    if (!a?.animation || !b?.animation) return out;
    // total length of the movement
    const probe = new InstructorRig();
    const pd = new PoseDirector(probe);
    pd.snapTo(a, a.animation.hold);
    const total = pd.playEntry(b);
    for (let i = 0; i < n; i++) {
      const rig = new InstructorRig();
      rig.settle = settle;
      rig.breathingAmount = 0;
      const d = new PoseDirector(rig);
      d.snapTo(a, a.animation.hold);
      for (let k = 0; k < 10; k++) rig.update(1 / 30);
      d.playEntry(b);
      const frames = Math.round(((total * i) / (n - 1)) * 30);
      for (let k = 0; k < frames; k++) rig.update(1 / 30);
      rig.group.position.x = (i - (n - 1) / 2) * spacing;
      rig.group.rotation.y = (yaw * Math.PI) / 180;
      rig.group.userData.t = ((total * i) / (n - 1)).toFixed(1);
      out.push(rig);
    }
    return out;
  }, [from, to, n, yaw, spacing, settle]);
  return (
    <>
      {rigs.map((r, i) => (
        <primitive key={i} object={r.group} />
      ))}
    </>
  );
}

function Cam({ width }: { width: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = size.width / width;
    cam.position.set(0, 0.75, 6);
    cam.lookAt(0, 0.6, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, width]);
  return null;
}

export default function MotionStrip() {
  const q = new URLSearchParams(location.search);
  const from = q.get('from') ?? 'half-forward-fold';
  const to = q.get('to') ?? 'bridge';
  const n = Number(q.get('n') ?? 8);
  const yaw = Number(q.get('yaw') ?? 90);
  const spacing = Number(q.get('sp') ?? 1.1);
  const settle = q.get('settle') !== '0';
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ece6da' }}>
      <div style={{ position: 'absolute', zIndex: 2, font: '12px sans-serif', padding: 6 }}>
        {from} → {to} {settle ? '' : '(no settle)'}
      </div>
      <Canvas orthographic camera={{ position: [0, 1.6, 6], near: 0.1, far: 50 }} shadows>
        <Cam width={n * spacing} />
        <hemisphereLight args={['#fff8ee', '#8c7a66', 1.1]} />
        <directionalLight position={[2, 5, 6]} intensity={2} />
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[60, 20]} />
          <meshStandardMaterial color="#cbbba3" />
        </mesh>
        <Strip from={from} to={to} n={n} yaw={yaw} spacing={spacing} settle={settle} />
      </Canvas>
    </div>
  );
}
