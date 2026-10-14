/**
 * Camera management: five view modes with smooth transitions.
 * Perspective-family modes (3D, cutaway, eye level) animate between poses;
 * orthographic modes (top, side) use a true orthographic camera.
 */
import { CameraControls, CameraControlsImpl, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { FullLayout } from '../engine/layout';
import { getLayout } from '../engine/solve';
import type { RoomConfig } from '../engine/types';
import { useStore, type CameraMode } from '../store/useStore';

const FOV = 36;
const { ACTION } = CameraControlsImpl;

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fit?: THREE.Box3;
}

function roomBox(room: RoomConfig, margin: number) {
  const t = room.wallThickness;
  return new THREE.Box3(new THREE.Vector3(-t - margin, 0, -t - margin), new THREE.Vector3(room.width + t + margin, room.height + 0.2, room.depth + t + margin));
}

export function stairBox(layout: FullLayout, room: RoomConfig) {
  const f = layout.footprint;
  return new THREE.Box3(new THREE.Vector3(f.minX - 0.1, 0, f.minZ - 0.1), new THREE.Vector3(f.maxX + 0.1, room.height + 1.0, f.maxZ + 0.1));
}

export function computePose(mode: CameraMode, layout: FullLayout, room: RoomConfig, eye: 'bottom' | 'top', sideFlip: boolean): Pose {
  const W = room.width;
  const D = room.depth;
  const H = room.height;
  const c = new THREE.Vector3(W / 2, H * 0.42, D / 2);
  const R = 0.5 * Math.sqrt(W * W + D * D + H * H) + 0.4;
  const dist = (R / Math.sin(((FOV / 2) * Math.PI) / 180)) * 1.02;
  switch (mode) {
    case 'perspective': {
      const dir = new THREE.Vector3(0.78, 0.52, 1).normalize();
      const t = c.clone().setY(H * 0.4);
      return { pos: t.clone().add(dir.multiplyScalar(dist)), target: t };
    }
    case 'cutaway': {
      const dir = new THREE.Vector3(-0.7, 0.95, 0.95).normalize();
      const t = c.clone().setY(H * 0.35);
      return { pos: t.clone().add(dir.multiplyScalar(dist * 0.95)), target: t };
    }
    case 'top': {
      const t = new THREE.Vector3(W / 2, 0, D / 2);
      return { pos: new THREE.Vector3(W / 2, H + 30, D / 2 + 0.0001), target: t, fit: roomBox(room, 0.9) };
    }
    case 'side': {
      const f = layout.flights[0];
      const n = new THREE.Vector3(f.right.x, 0, f.right.z).multiplyScalar(sideFlip ? -1 : 1);
      // look from the open side: prefer the side without a wall in front of the camera
      const t = new THREE.Vector3(W / 2, H / 2, D / 2);
      const box = roomBox(room, 0.6);
      box.min.y = -0.4;
      box.max.y = H + 1.2;
      return { pos: t.clone().add(n.multiplyScalar(30)), target: t, fit: box };
    }
    case 'eye': {
      if (eye === 'bottom') {
        const f = layout.flights[0];
        const back = 1.9;
        let px = f.start.x - f.dir.x * back;
        let pz = f.start.z - f.dir.z * back;
        px = Math.min(Math.max(px, -1.2), W + 1.2);
        pz = Math.min(Math.max(pz, -1.2), D + 1.2);
        const tgt = new THREE.Vector3(f.start.x + f.dir.x * f.run * 0.55, 1.45, f.start.z + f.dir.z * f.run * 0.55);
        return { pos: new THREE.Vector3(px - f.right.x * 0.35, 1.62, pz - f.right.z * 0.35), target: tgt };
      }
      const l = layout.flights[layout.flights.length - 1];
      const ex = l.start.x + l.dir.x * l.run;
      const ez = l.start.z + l.dir.z * l.run;
      const pos = new THREE.Vector3(ex + l.dir.x * 1.3, H + 1.62, ez + l.dir.z * 1.3);
      const tgt = new THREE.Vector3(ex - l.dir.x * 1.6, H * 0.45, ez - l.dir.z * 1.6);
      return { pos, target: tgt };
    }
  }
}

export function CameraRig() {
  const mode = useStore((s) => s.view.camera);
  const eye = useStore((s) => s.view.eye);
  const sideFlip = useStore((s) => s.view.sideFlip);
  const resetNonce = useStore((s) => s.view.resetNonce);
  const fitNonce = useStore((s) => s.view.fitNonce);
  const ortho = mode === 'top' || mode === 'side';
  const [persp, setPersp] = useState<THREE.PerspectiveCamera | null>(null);
  const [orthoCam, setOrthoCam] = useState<THREE.OrthographicCamera | null>(null);
  const [controls, setControls] = useState<CameraControlsImpl | null>(null);
  const lastControls = useRef<CameraControlsImpl | null>(null);
  const active = ortho ? orthoCam : persp;

  // apply view pose
  useEffect(() => {
    if (!controls) return;
    const { config, view } = useStore.getState();
    const layout = getLayout(config.room, config.stair);
    const pose = computePose(view.camera, layout, config.room, view.eye, view.sideFlip);
    const smooth = lastControls.current === controls;
    if (persp) {
      const fov = view.camera === 'eye' ? 58 : FOV;
      if (persp.fov !== fov) {
        persp.fov = fov;
        persp.updateProjectionMatrix();
      }
    }
    lastControls.current = controls;
    controls.mouseButtons.left = ortho ? ACTION.TRUCK : ACTION.ROTATE;
    controls.touches.one = ortho ? ACTION.TOUCH_TRUCK : ACTION.TOUCH_ROTATE;
    controls.minDistance = mode === 'eye' ? 0.05 : 0.5;
    controls.maxDistance = 60;
    controls.dollyToCursor = true;
    controls.setLookAt(pose.pos.x, pose.pos.y, pose.pos.z, pose.target.x, pose.target.y, pose.target.z, smooth);
    if (pose.fit) {
      controls.fitToBox(pose.fit, smooth, { paddingTop: 0.2, paddingBottom: 0.35, paddingLeft: 0.2, paddingRight: 0.2 });
    }
    // make sure ortho views keep the intended direction after fitting
  }, [controls, mode, eye, sideFlip, resetNonce, ortho, persp]);

  // fit staircase
  useEffect(() => {
    if (!controls || fitNonce === 0) return;
    const { config } = useStore.getState();
    const layout = getLayout(config.room, config.stair);
    const box = stairBox(layout, config.room);
    if (ortho) controls.fitToBox(box, true, { paddingTop: 0.4, paddingBottom: 0.4, paddingLeft: 0.4, paddingRight: 0.4 });
    else controls.fitToSphere(box.getBoundingSphere(new THREE.Sphere()), true);
  }, [fitNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PerspectiveCamera ref={setPersp} makeDefault={!ortho} fov={FOV} near={0.03} far={300} position={[8, 6, 9]} />
      <OrthographicCamera ref={setOrthoCam} makeDefault={ortho} near={0.1} far={400} position={[0, 40, 0]} zoom={60} />
      {active && <CameraControls key={ortho ? 'o' : 'p'} ref={setControls} camera={active} makeDefault smoothTime={0.42} draggingSmoothTime={0.12} />}
    </>
  );
}
