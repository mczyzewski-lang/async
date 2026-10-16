import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { InstructorRig } from './rig/InstructorRig';

interface Props {
  onReady?: (rig: InstructorRig) => void;
  visible?: boolean;
}

/** Mounts an InstructorRig into the scene graph and advances it every frame (no React re-renders). */
export function Instructor({ onReady, visible = true }: Props) {
  const rig = useMemo(() => new InstructorRig(), []);
  useEffect(() => {
    onReady?.(rig);
    return () => rig.dispose();
  }, [rig, onReady]);
  useFrame((_, dt) => rig.update(Math.min(dt, 0.1)));
  return <primitive object={rig.group} visible={visible} />;
}
