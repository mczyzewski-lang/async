/**
 * Shared material registry. Materials are created once and updated in place,
 * so changing colours or wood species never rebuilds geometry or remounts the scene.
 */
import * as THREE from 'three';
import type { SteelFinish, WoodId } from '../engine/types';
import { getBrushedTexture, getFloorTexture, getMeshAlpha, getPerforationAlpha, getPlasterTexture, getWoodTextures } from './textures';

export type MatKey = 'steel' | 'wood' | 'railing' | 'railPerf' | 'railMesh' | 'led' | 'handWood';

let mats: Record<string, THREE.Material> | null = null;

export function getMaterials() {
  if (mats) return mats as {
    steel: THREE.MeshPhysicalMaterial;
    wood: THREE.MeshPhysicalMaterial;
    handWood: THREE.MeshPhysicalMaterial;
    railing: THREE.MeshPhysicalMaterial;
    railPerf: THREE.MeshPhysicalMaterial;
    railMesh: THREE.MeshPhysicalMaterial;
    led: THREE.MeshBasicMaterial;
    wall: THREE.MeshStandardMaterial;
    wallGhost: THREE.MeshStandardMaterial;
    floor: THREE.MeshStandardMaterial;
    slab: THREE.MeshStandardMaterial;
    upperFloor: THREE.MeshStandardMaterial;
    ground: THREE.MeshStandardMaterial;
    conflict: THREE.MeshBasicMaterial;
    footprint: THREE.MeshBasicMaterial;
    section: THREE.MeshStandardMaterial;
  };
  const steel = new THREE.MeshPhysicalMaterial({ color: '#1b1b1c', roughness: 0.7, metalness: 0.2 });
  const wood = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.58, clearcoat: 0.12, clearcoatRoughness: 0.6, bumpScale: 0.6 });
  const railing = new THREE.MeshPhysicalMaterial({ color: '#1b1b1c', roughness: 0.7, metalness: 0.2 });
  const railPerf = new THREE.MeshPhysicalMaterial({ color: '#1b1b1c', roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide, alphaTest: 0.35, alphaToCoverage: true });
  railPerf.alphaMap = getPerforationAlpha();
  const railMesh = new THREE.MeshPhysicalMaterial({ color: '#1b1b1c', roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide, alphaTest: 0.35, alphaToCoverage: true });
  railMesh.alphaMap = getMeshAlpha();
  const led = new THREE.MeshBasicMaterial({ color: '#ffc58a', toneMapped: false });
  const plaster = getPlasterTexture();
  const wall = new THREE.MeshStandardMaterial({ color: '#f1ece4', roughness: 0.95, bumpMap: plaster, bumpScale: 0.25 });
  const wallGhost = new THREE.MeshStandardMaterial({ color: '#f1ece4', roughness: 0.95, transparent: true, opacity: 0.22, depthWrite: false });
  const floorTex = getFloorTexture();
  const floor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.62, color: '#ffffff' });
  const upperFloor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.62, color: '#ffffff' });
  const slab = new THREE.MeshStandardMaterial({ color: '#ebe6dd', roughness: 0.92 });
  const ground = new THREE.MeshStandardMaterial({ color: '#efede8', roughness: 1 });
  const conflict = new THREE.MeshBasicMaterial({ color: '#e0412f', transparent: true, opacity: 0.28, depthWrite: false });
  const footprint = new THREE.MeshBasicMaterial({ color: '#9a6b3c', transparent: true, opacity: 0.16, depthWrite: false });
  const section = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.9 });
  mats = { steel, wood, handWood: wood, railing, railPerf, railMesh, led, wall, wallGhost, floor, slab, upperFloor, ground, conflict, footprint, section };
  setWood('oak-natural');
  return getMaterials();
}

export function finishParams(finish: SteelFinish) {
  switch (finish) {
    case 'matte':
      return { metalness: 0.08, roughness: 0.78, clearcoat: 0, envMapIntensity: 0.6 };
    case 'satin':
      return { metalness: 0.45, roughness: 0.45, clearcoat: 0.2, envMapIntensity: 0.9 };
    case 'metallic':
      return { metalness: 0.88, roughness: 0.3, clearcoat: 0.35, envMapIntensity: 1.2 };
    case 'brushed':
      return { metalness: 0.95, roughness: 0.36, clearcoat: 0, envMapIntensity: 1.2 };
  }
}

function applySteel(m: THREE.MeshPhysicalMaterial, color: string, finish: SteelFinish) {
  const p = finishParams(finish);
  m.color.set(color);
  m.metalness = p.metalness;
  m.roughness = p.roughness;
  m.clearcoat = p.clearcoat;
  m.envMapIntensity = p.envMapIntensity;
  const wantMap = finish === 'brushed' ? getBrushedTexture() : null;
  if (m.roughnessMap !== wantMap) {
    m.roughnessMap = wantMap;
    m.needsUpdate = true;
  }
}

export function setSteel(color: string, finish: SteelFinish) {
  applySteel(getMaterials().steel, color, finish);
}

export function setRailing(color: string, finish: SteelFinish) {
  const m = getMaterials();
  applySteel(m.railing, color, finish);
  applySteel(m.railPerf, color, finish);
  applySteel(m.railMesh, color, finish);
}

export function setWood(id: WoodId) {
  const m = getMaterials().wood;
  const t = getWoodTextures(id);
  const hadMap = !!m.map;
  m.map = t.map;
  m.bumpMap = t.bump;
  m.roughness = id === 'walnut' || id === 'oak-black' ? 0.5 : 0.6;
  if (!hadMap) m.needsUpdate = true;
}

export function setLed(on: boolean, temp: 'warm' | 'neutral', intensity: number, night: boolean) {
  const m = getMaterials().led;
  const base = new THREE.Color(temp === 'warm' ? '#ffb46b' : '#fff1dc');
  const k = on ? (night ? 2.2 : 1.3) * intensity : 0.15;
  m.color.copy(base).multiplyScalar(k);
}
