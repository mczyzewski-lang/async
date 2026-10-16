import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CameraPreset, JointId } from '@/content/types';
import type { InstructorRig } from './rig/InstructorRig';

export interface CameraRequest {
  preset: CameraPreset;
  /** Pose facing direction in degrees (0 = toward +Z). */
  facing: number;
  /** Changing nonce re-triggers the same preset. */
  nonce: number;
  /** Seconds for the transition (0 = cut). */
  duration?: number;
}

const BODY_JOINTS: JointId[] = ['head', 'pelvis', 'handL', 'handR', 'ankleL', 'ankleR', 'kneeL', 'kneeR', 'chest'];
const _v = new THREE.Vector3();

/** Computes the world target point for a preset from the live skeleton. */
export function presetTarget(rig: InstructorRig, target: CameraPreset['target'], out = new THREE.Vector3()) {
  if (target === 'center') {
    const box = new THREE.Box3();
    for (const j of BODY_JOINTS) box.expandByPoint(rig.getJointWorld(j, _v));
    box.getCenter(out);
    out.y = Math.max(out.y, 0.35);
    return out;
  }
  if (target === 'feet') {
    rig.getJointWorld('ankleL', out);
    out.add(rig.getJointWorld('ankleR', _v)).multiplyScalar(0.5);
    out.y += 0.05;
    return out;
  }
  return rig.getJointWorld(target, out);
}

/** Horizontal half-extent of the body, used to frame wide poses on narrow screens. */
function bodyExtent(rig: InstructorRig) {
  const box = new THREE.Box3();
  for (const j of BODY_JOINTS) box.expandByPoint(rig.getJointWorld(j, _v));
  const size = box.getSize(new THREE.Vector3());
  return { w: Math.max(size.x, size.z), h: size.y };
}

interface Props {
  rig: () => InstructorRig | null;
  request: CameraRequest | null;
  autoRotate?: boolean;
  minDistance?: number;
  maxDistance?: number;
  enabled?: boolean;
  onInteract?: () => void;
  /** Report camera state for the dev inspector. */
  onUpdate?: (cam: THREE.Camera, target: THREE.Vector3) => void;
  /** Shifts the rendered image up by this fraction of the height (room for bottom UI panels). */
  viewShift?: number;
}

export function CameraRig({ rig, request, autoRotate, minDistance = 0.8, maxDistance = 9, enabled = true, onInteract, onUpdate, viewShift = 0 }: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const anim = useRef<{ fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number; dur: number } | null>(null);
  const follow = useRef<CameraRequest | null>(null);

  useEffect(() => {
    if (!request) return;
    const r = rig();
    const c = controls.current;
    if (!r || !c) return;
    follow.current = request;
    const target = presetTarget(r, request.preset.target);
    const p = request.preset;
    const az = THREE.MathUtils.degToRad(request.facing + p.azimuth);
    const el = THREE.MathUtils.degToRad(p.elevation);
    const aspect = size.width / Math.max(1, size.height);
    let dist = p.distance;
    if (p.target === 'center') {
      // Fit both body height and width (portrait phones need more distance for wide poses).
      const { w, h } = bodyExtent(r);
      const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
      const fitH = (Math.max(h, 0.6) * 0.62) / Math.tan(fov / 2);
      const fitW = (Math.max(w, 0.6) * 0.62) / (Math.tan(fov / 2) * aspect);
      dist = Math.max(p.distance * 0.75, fitH, fitW);
    } else {
      // Focus views: keep roughly 1.1 m of the body visible horizontally (narrow portrait screens).
      const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
      dist = Math.max(p.distance, 0.55 / (Math.tan(fov / 2) * Math.min(1, aspect)));
    }
    const pos = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(target);
    pos.y = Math.max(pos.y, 0.25);
    const dur = request.duration ?? 1.4;
    if (dur <= 0) {
      camera.position.copy(pos);
      c.target.copy(target);
      c.update();
      anim.current = null;
    } else {
      anim.current = { fromPos: camera.position.clone(), toPos: pos, fromT: c.target.clone(), toT: target, t: 0, dur };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce, request?.preset.id, request?.facing]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    // A slightly wider lens on portrait phones keeps whole poses legible.
    cam.fov = size.width < size.height ? 48 : 40;
    if (viewShift > 0) cam.setViewOffset(size.width, size.height, 0, size.height * viewShift, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, size, viewShift]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const a = anim.current;
    if (a) {
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = a.t < 0.5 ? 4 * a.t * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 3) / 2;
      // Arc through spherical interpolation around the target for a cinematic move.
      const tgt = _v.copy(a.fromT).lerp(a.toT, e);
      const s0 = new THREE.Spherical().setFromVector3(a.fromPos.clone().sub(a.fromT));
      const s1 = new THREE.Spherical().setFromVector3(a.toPos.clone().sub(a.toT));
      let dTheta = s1.theta - s0.theta;
      if (dTheta > Math.PI) dTheta -= Math.PI * 2;
      if (dTheta < -Math.PI) dTheta += Math.PI * 2;
      const s = new THREE.Spherical(
        THREE.MathUtils.lerp(s0.radius, s1.radius, e),
        THREE.MathUtils.lerp(s0.phi, s1.phi, e),
        s0.theta + dTheta * e,
      );
      camera.position.setFromSpherical(s).add(tgt);
      c.target.copy(tgt);
      if (a.t >= 1) anim.current = null;
    } else if (follow.current && follow.current.preset.target !== 'center') {
      // Gently keep focus targets centred as the body moves.
      const r = rig();
      if (r) {
        const t = presetTarget(r, follow.current.preset.target, new THREE.Vector3());
        const delta = t.sub(c.target).multiplyScalar(Math.min(1, dt * 2));
        c.target.add(delta);
        camera.position.add(delta);
      }
    }
    c.update();
    onUpdate?.(camera, c.target);
  });

  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enabled={enabled}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      enablePan={false}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI * 0.55}
      autoRotate={autoRotate}
      autoRotateSpeed={0.35}
      onStart={() => {
        anim.current = null;
        follow.current = null;
        onInteract?.();
      }}
    />
  );
}
