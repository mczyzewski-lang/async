import { Environment, Lightformer } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useLayout } from '../store/derived';
import { useStore } from '../store/useStore';

/** Day / night lighting with a procedural environment (no external HDR files). */
export function Lighting() {
  const room = useStore((s) => s.config.room);
  const lighting = useStore((s) => s.config.lighting);
  const layout = useLayout();
  const night = lighting.mode === 'night';
  const sun = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  const cx = room.width / 2;
  const cz = room.depth / 2;
  const span = Math.max(room.width, room.depth, room.height) + 3;

  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(cx, 0, cz);
    scene.add(l.target);
    l.shadow.camera.left = -span;
    l.shadow.camera.right = span;
    l.shadow.camera.top = span;
    l.shadow.camera.bottom = -span;
    l.shadow.camera.near = 0.5;
    l.shadow.camera.far = span * 5;
    l.shadow.camera.updateProjectionMatrix();
    return () => {
      scene.remove(l.target);
    };
  }, [cx, cz, span, scene]);

  // warm LED glow lights: a few per flight (no shadows) to keep it cheap
  const ledLights = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (const f of layout.flights) {
      const k = Math.max(1, Math.round(f.run / 1.2));
      for (let i = 0; i < k; i++) {
        const t = ((i + 0.5) / k) * f.run;
        const y = f.baseY + (t / f.going) * f.riserHeight + 0.05;
        pts.push(new THREE.Vector3(f.start.x + f.dir.x * t, y, f.start.z + f.dir.z * t));
      }
    }
    return pts.slice(0, 8);
  }, [layout]);
  const ledColor = lighting.ledTemp === 'warm' ? '#ffb469' : '#fff0d6';
  const ledOn = lighting.led;

  return (
    <>
      <color attach="background" args={[night ? '#15171b' : '#f2f0eb']} />
      <hemisphereLight args={[night ? '#3a4150' : '#ffffff', night ? '#1a1612' : '#d9cfc2', night ? 0.08 : 0.55]} />
      <directionalLight
        ref={sun}
        position={[cx - span * 0.55, room.height + span * 0.9, cz + span * 0.75]}
        intensity={night ? 0.06 : 2.4}
        color={night ? '#9fb3ff' : '#fff4e2'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      />
      {/* soft fill from the opposite side */}
      <directionalLight position={[cx + span, room.height * 0.8, cz - span * 0.3]} intensity={night ? 0.03 : 0.35} color="#f1ece6" />
      {night && (
        <>
          <pointLight position={[cx, room.height - room.slabThickness - 0.25, cz]} intensity={2.2} distance={7} decay={1.6} color="#ffd8a8" />
          <pointLight position={[cx, room.height + 1.6, cz]} intensity={1.2} distance={6} decay={1.6} color="#ffd8a8" />
        </>
      )}
      {ledOn &&
        ledLights.map((p, i) => (
          <pointLight key={i} position={p} intensity={(night ? 1.6 : 0.5) * lighting.ledIntensity} distance={1.6} decay={1.8} color={ledColor} />
        ))}
      <Environment resolution={256} frames={1} environmentIntensity={night ? 0.12 : 0.85}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#fff3e2" position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#eef2ff" position={[6, 2, -2]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#ffffff" position={[0, 3, 7]} scale={3} />
        <mesh scale={30}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#d9d4cc" side={THREE.BackSide} />
        </mesh>
      </Environment>
    </>
  );
}
