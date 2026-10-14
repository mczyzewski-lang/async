import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { captureRef } from '../store/useStore';
import { CameraRig } from './CameraRig';
import { Dimensions } from './Dimensions';
import { Lighting } from './Lighting';
import { Overlays } from './Overlays';
import { Room } from './Room';
import { MaterialSync, Railings, Staircase } from './Staircase';

function Capture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureRef.current = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    };
    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera]);
  return null;
}

export default function Scene() {
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      className="!absolute inset-0"
    >
      <Suspense fallback={null}>
        <MaterialSync />
        <Lighting />
        <Room />
        <Staircase />
        <Railings />
        <Overlays />
        <Dimensions />
        <CameraRig />
        <Capture />
      </Suspense>
    </Canvas>
  );
}
