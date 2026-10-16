import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Instructor } from '@/three/Instructor';
import type { InstructorRig } from '@/three/rig/InstructorRig';
import { neutralState, pose } from '@/content/poseState';

declare global {
  interface Window { __rig?: InstructorRig; __pose?: typeof pose; __neutral?: typeof neutralState }
}

import PoseGrid from '@/dev/PoseGrid';

export function App() {
  if (location.search.includes('grid=')) return <PoseGrid />;
  return (
    <div style={{ height: '100%' }}>
      <Canvas shadows camera={{ position: [1.2, 1.2, 3.2], fov: 35 }}>
        <color attach="background" args={['#ece6da']} />
        <hemisphereLight args={['#fff8ee', '#8c7a66', 0.9]} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} castShadow />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#cbbba3" />
        </mesh>
        <Instructor onReady={(r) => { window.__rig = r; window.__pose = pose; window.__neutral = neutralState; }} />
        <OrbitControls target={[0, 0.9, 0]} />
      </Canvas>
    </div>
  );
}
