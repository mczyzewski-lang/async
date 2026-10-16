import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { getPose } from '@/content/poses';
import type { JointId } from '@/content/types';
import { InstructorRig } from './rig/InstructorRig';

/**
 * Renders real 3D snapshots of the instructor for pose cards (one shared offscreen renderer).
 * These are actual renders of the rig in the authored skeletal configuration, not illustrations.
 */
const SIZE = 320;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let rig: InstructorRig;
let floor: THREE.Mesh;
const cache = new Map<string, string>();
const waiting = new Map<string, Array<(url: string) => void>>();
const queue: string[] = [];
let busy = false;

function init() {
  if (renderer) return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  } catch {
    return false;
  }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  scene.add(new THREE.HemisphereLight('#fff6ea', '#9c8a73', 1.25));
  const sun = new THREE.DirectionalLight('#ffe6c4', 2.2);
  sun.position.set(-3, 5, 4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#ffffff', 0.5);
  fill.position.set(3, 2, 3);
  scene.add(fill);
  floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.06 }),
  );
  scene.add(floor);
  rig = new InstructorRig();
  rig.breathingAmount = 0;
  scene.add(rig.group);
  return true;
}

const FRAME_JOINTS: JointId[] = ['head', 'pelvis', 'handL', 'handR', 'ankleL', 'ankleR', 'kneeL', 'kneeR', 'toesL', 'toesR'];

function renderKey(key: string): string | null {
  const [poseId, kfId] = key.split('|');
  const pose = getPose(poseId);
  const anim = pose?.animation;
  if (!anim) return null;
  const kf = anim.keyframes.find((k) => k.id === (kfId || anim.hold)) ?? anim.keyframes[anim.keyframes.length - 1];
  rig.setPose(kf.state, 0);
  for (let i = 0; i < 3; i++) rig.update(0.016);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const j of FRAME_JOINTS) box.expandByPoint(rig.getJointWorld(j, v));
  box.expandByScalar(0.12);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  floor.position.set(center.x, 0.002, center.z);
  const az = THREE.MathUtils.degToRad(anim.facing + (kf.base === 'standing' ? 30 : 62));
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.95;
  const el = THREE.MathUtils.degToRad(12);
  camera.position.set(center.x + Math.sin(az) * Math.cos(el) * dist, center.y + Math.sin(el) * dist, center.z + Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(center);
  renderer!.render(scene, camera);
  return renderer!.domElement.toDataURL('image/webp', 0.85);
}

function pump() {
  if (busy) return;
  busy = true;
  const step = () => {
    const key = queue.shift();
    if (!key) {
      busy = false;
      return;
    }
    let url = cache.get(key) ?? null;
    if (!url && init()) url = renderKey(key);
    if (url) cache.set(key, url);
    waiting.get(key)?.forEach((cb) => cb(url ?? ''));
    waiting.delete(key);
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(step, { timeout: 120 });
    else setTimeout(step, 16);
  };
  step();
}

export function requestThumb(poseId: string, keyframe = '', cb: (url: string) => void) {
  const key = `${poseId}|${keyframe}`;
  const hit = cache.get(key);
  if (hit) {
    cb(hit);
    return () => undefined;
  }
  const list = waiting.get(key) ?? [];
  list.push(cb);
  waiting.set(key, list);
  if (!queue.includes(key)) queue.push(key);
  pump();
  return () => {
    const l = waiting.get(key);
    if (l) waiting.set(key, l.filter((x) => x !== cb));
  };
}

export function usePoseThumb(poseId: string, keyframe = '', enabled = true) {
  const [url, setUrl] = useState<string | null>(() => cache.get(`${poseId}|${keyframe}`) ?? null);
  useEffect(() => {
    if (!enabled) return;
    return requestThumb(poseId, keyframe, (u) => setUrl(u || null));
  }, [poseId, keyframe, enabled]);
  return url;
}
