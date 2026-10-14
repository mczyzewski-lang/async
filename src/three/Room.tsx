/**
 * Room & slab geometry: walls with thickness, oak floors, upper slab with the stair opening.
 * Wall visibility (auto cutaway towards camera, hidden, ghost, cutaway section) is handled per frame
 * without React re-renders.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Rect, RoomConfig } from '../engine/types';
import { useLayout } from '../store/derived';
import { useStore, type WallKey } from '../store/useStore';
import { boxUV } from './geom/primitives';
import { getMaterials } from './materials';
import { FLOOR_TILE } from './textures';

export const OPEN_EXT = 1.4;
const CUT_H = 1.05;

interface WallDef {
  key: WallKey;
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** outward test: camera beyond this wall */
  beyond: (p: THREE.Vector3) => boolean;
}

function wallDefs(room: RoomConfig): WallDef[] {
  const { width: W, depth: D, height: H, wallThickness: t } = room;
  const all: WallDef[] = [
    { key: 'back', min: new THREE.Vector3(-t, 0, -t), max: new THREE.Vector3(W + t, H, 0), beyond: (p) => p.z < -0.01 },
    { key: 'front', min: new THREE.Vector3(-t, 0, D), max: new THREE.Vector3(W + t, H, D + t), beyond: (p) => p.z > D + 0.01 },
    { key: 'left', min: new THREE.Vector3(-t, 0, 0), max: new THREE.Vector3(0, H, D), beyond: (p) => p.x < -0.01 },
    { key: 'right', min: new THREE.Vector3(W, 0, 0), max: new THREE.Vector3(W + t, H, D), beyond: (p) => p.x > W + 0.01 },
  ];
  return all.filter((w) => room.walls[w.key]);
}

/** slab outer rectangle: covers walls, extends into open-plan sides */
export function slabRect(room: RoomConfig): Rect {
  const t = room.wallThickness;
  const w = room.walls;
  return {
    minX: w.left ? -t : -OPEN_EXT,
    maxX: w.right ? room.width + t : room.width + OPEN_EXT,
    minZ: w.back ? -t : -OPEN_EXT,
    maxZ: w.front ? room.depth + t : room.depth + OPEN_EXT,
  };
}

/** floor rectangle (oak) */
function floorRect(room: RoomConfig): Rect {
  const w = room.walls;
  return {
    minX: w.left ? 0 : -OPEN_EXT,
    maxX: w.right ? room.width : room.width + OPEN_EXT,
    minZ: w.back ? 0 : -OPEN_EXT,
    maxZ: w.front ? room.depth : room.depth + OPEN_EXT,
  };
}

/** Subtract an opening from a rectangle → up to 4 rectangles */
export function rectMinus(S: Rect, O: Rect): Rect[] {
  if (!isFinite(O.minX) || O.maxX <= O.minX || O.maxZ <= O.minZ) return [S];
  const out: Rect[] = [];
  const o = { minX: Math.max(O.minX, S.minX), maxX: Math.min(O.maxX, S.maxX), minZ: Math.max(O.minZ, S.minZ), maxZ: Math.min(O.maxZ, S.maxZ) };
  if (o.minZ > S.minZ) out.push({ minX: S.minX, maxX: S.maxX, minZ: S.minZ, maxZ: o.minZ });
  if (o.maxZ < S.maxZ) out.push({ minX: S.minX, maxX: S.maxX, minZ: o.maxZ, maxZ: S.maxZ });
  if (o.minX > S.minX) out.push({ minX: S.minX, maxX: o.minX, minZ: o.minZ, maxZ: o.maxZ });
  if (o.maxX < S.maxX) out.push({ minX: o.maxX, maxX: S.maxX, minZ: o.minZ, maxZ: o.maxZ });
  return out.filter((r) => r.maxX - r.minX > 1e-4 && r.maxZ - r.minZ > 1e-4);
}

function rectBox(r: Rect, y0: number, y1: number, tile?: number) {
  const g = new THREE.BoxGeometry(r.maxX - r.minX, y1 - y0, r.maxZ - r.minZ);
  g.translate((r.minX + r.maxX) / 2, (y0 + y1) / 2, (r.minZ + r.maxZ) / 2);
  if (tile) boxUV(g, tile, tile);
  return g;
}

function Wall({ def, mode, hidden, cut }: { def: WallDef; mode: string; hidden: boolean; cut: boolean }) {
  const mats = getMaterials();
  const solid = useRef<THREE.Mesh>(null);
  const outline = useRef<THREE.LineSegments>(null);
  const size = def.max.clone().sub(def.min);
  const center = def.min.clone().add(def.max).multiplyScalar(0.5);
  const h = cut ? Math.min(CUT_H, size.y) : size.y;
  const geo = useMemo(() => new THREE.BoxGeometry(size.x, h, size.z), [size.x, h, size.z]);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), [size.x, size.y, size.z]);
  useFrame(({ camera }) => {
    if (!solid.current || !outline.current) return;
    let visible = true;
    const beyond = def.beyond(camera.position);
    if (mode === 'custom') visible = !hidden;
    else if (mode === 'auto' || mode === 'cutaway') visible = !beyond;
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera && beyond) visible = false;
    solid.current.visible = visible;
    outline.current.visible = !visible || mode === 'transparent' || cut;
  });
  return (
    <group>
      <mesh
        ref={solid}
        geometry={geo}
        position={[center.x, cut ? h / 2 : center.y, center.z]}
        material={mode === 'transparent' ? mats.wallGhost : mats.wall}
        castShadow={mode !== 'transparent'}
        receiveShadow
      />
      <lineSegments ref={outline} geometry={edges} position={center}>
        <lineBasicMaterial color="#9b958b" transparent opacity={0.55} />
      </lineSegments>
    </group>
  );
}

export function Room() {
  const room = useStore((s) => s.config.room);
  const view = useStore((s) => s.view);
  const layout = useLayout();
  const mats = getMaterials();
  const H = room.height;
  const T = room.slabThickness;
  const opening = layout.opening.rect;

  const defs = useMemo(() => wallDefs(room), [room]);
  const floorGeo = useMemo(() => rectBox(floorRect(room), -0.02, 0, FLOOR_TILE), [room]);
  const slab = useMemo(() => {
    const parts = rectMinus(slabRect(room), opening);
    const body = parts.map((r) => rectBox(r, H - T, H - 0.015));
    const finish = parts.map((r) => rectBox(r, H - 0.015, H, FLOOR_TILE));
    const outline = new THREE.EdgesGeometry(rectBox(slabRect(room), H - T, H));
    const openOutline = isFinite(opening.minX) ? new THREE.EdgesGeometry(rectBox(opening, H - T, H)) : null;
    return { body, finish, outline, openOutline };
  }, [room, opening, H, T]);

  const isOrthoTop = view.camera === 'top';
  const wallMode = view.camera === 'cutaway' ? 'cutaway' : view.wallMode;
  const cut = wallMode === 'cutaway';
  const slabVisible = view.showSlab && !isOrthoTop && !cut;
  const slabGhost = wallMode === 'transparent';

  return (
    <group>
      {/* ground */}
      <mesh rotation-x={-Math.PI / 2} position={[room.width / 2, -0.021, room.depth / 2]} receiveShadow material={mats.ground}>
        <planeGeometry args={[80, 80]} />
      </mesh>
      <mesh geometry={floorGeo} material={mats.floor} receiveShadow />
      {defs.map((d) => (
        <Wall key={d.key + room.width + room.depth + room.height + room.wallThickness + (cut ? 'c' : '')} def={d} mode={wallMode} hidden={view.hiddenWalls[d.key]} cut={cut} />
      ))}
      {/* upper slab */}
      <group visible={slabVisible}>
        {slab.body.map((g, i) => (
          <mesh key={'b' + i} geometry={g} material={slabGhost ? mats.wallGhost : mats.slab} castShadow={!slabGhost} receiveShadow />
        ))}
        {slab.finish.map((g, i) => (
          <mesh key={'f' + i} geometry={g} material={slabGhost ? mats.wallGhost : mats.upperFloor} receiveShadow />
        ))}
      </group>
      {/* slab ghost outline when hidden */}
      {!slabVisible && (
        <group>
          <lineSegments geometry={slab.outline}>
            <lineBasicMaterial color="#9b958b" transparent opacity={0.45} />
          </lineSegments>
          {slab.openOutline && (
            <lineSegments geometry={slab.openOutline}>
              <lineBasicMaterial color="#9a6b3c" transparent opacity={0.8} />
            </lineSegments>
          )}
        </group>
      )}
    </group>
  );
}
