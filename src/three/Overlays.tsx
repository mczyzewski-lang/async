import { useMemo } from 'react';
import * as THREE from 'three';
import { computeHeadroom } from '../engine/opening';
import { useAnalysis, useLayout } from '../store/derived';
import { useStore } from '../store/useStore';
import { Labels, type LabelItem } from './Labels';
import { getMaterials } from './materials';

function boxFrom(minX: number, maxX: number, y0: number, y1: number, minZ: number, maxZ: number) {
  const g = new THREE.BoxGeometry(Math.max(maxX - minX, 0.002), Math.max(y1 - y0, 0.002), Math.max(maxZ - minZ, 0.002));
  g.translate((minX + maxX) / 2, (y0 + y1) / 2, (minZ + maxZ) / 2);
  return g;
}

/** Bounding footprint overlay + visible 3D conflicts (room overflow, headroom). */
export function Overlays() {
  const analysis = useAnalysis();
  const layout = useLayout();
  const room = useStore((s) => s.config.room);
  const showFp = useStore((s) => s.view.showFootprint);
  const mats = getMaterials();
  const fp = analysis.footprint;
  const H = room.height;

  const fpGeo = useMemo(() => boxFrom(fp.minX, fp.maxX, 0.001, 0.004, fp.minZ, fp.maxZ), [fp]);
  const fpEdges = useMemo(() => new THREE.EdgesGeometry(boxFrom(fp.minX, fp.maxX, 0, H, fp.minZ, fp.maxZ)), [fp, H]);

  const conflicts = useMemo(() => {
    const o = analysis.overflow;
    const list: THREE.BufferGeometry[] = [];
    const W = room.width;
    const D = room.depth;
    if (o.left > 0.002) list.push(boxFrom(fp.minX, 0, 0, H, fp.minZ, fp.maxZ));
    if (o.right > 0.002) list.push(boxFrom(W, fp.maxX, 0, H, fp.minZ, fp.maxZ));
    if (o.back > 0.002) list.push(boxFrom(Math.max(fp.minX, 0), Math.min(fp.maxX, W), 0, H, fp.minZ, 0));
    if (o.front > 0.002) list.push(boxFrom(Math.max(fp.minX, 0), Math.min(fp.maxX, W), 0, H, D, fp.maxZ));
    return list;
  }, [analysis.overflow, fp, room.width, room.depth, H]);

  const headroom = useMemo(() => {
    const hr = computeHeadroom(layout, layout.opening, room);
    const slabBottom = room.height - room.slabThickness;
    return hr.violations.map((v) => ({ geo: boxFrom(v.rect.minX, v.rect.maxX, v.topY, slabBottom, v.rect.minZ, v.rect.maxZ), v }));
  }, [layout, room]);

  const camera = useStore((s) => s.view.camera);
  const planLines = useMemo(() => {
    const pts: number[] = [];
    const rect = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, y: number) => {
      const c = [
        [r.minX, r.minZ],
        [r.maxX, r.minZ],
        [r.maxX, r.maxZ],
        [r.minX, r.maxZ],
      ];
      for (let i = 0; i < 4; i++) pts.push(c[i][0], y, c[i][1], c[(i + 1) % 4][0], y, c[(i + 1) % 4][1]);
    };
    layout.flights.forEach((f) => f.treadRects.forEach((t) => rect(t.rect, t.topY + 0.002)));
    layout.landings.forEach((l) => rect(l.rect, l.topY + 0.002));
    // walking line arrow along each flight
    layout.flights.forEach((f) => {
      const y = f.topY + 0.01;
      pts.push(f.start.x, y, f.start.z, f.start.x + f.dir.x * f.run, y, f.start.z + f.dir.z * f.run);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [layout]);
  const showConflict = conflicts.length > 0;
  const labels = useMemo<LabelItem[]>(() => {
    const out: LabelItem[] = [];
    if (conflicts.length)
      out.push({ id: 'c', pos: new THREE.Vector3((fp.minX + fp.maxX) / 2, H + 0.25, (fp.minZ + fp.maxZ) / 2), text: 'Kolizja ze ścianą', className: 'conflict-label' });
    if (headroom.length) {
      const r = headroom[0].v.rect;
      out.push({
        id: 'h',
        pos: new THREE.Vector3((r.minX + r.maxX) / 2, room.height - room.slabThickness - 0.1, (r.minZ + r.maxZ) / 2),
        text: `Prześwit ${Math.round(headroom[0].v.headroom * 100)} cm`,
        className: 'conflict-label',
      });
    }
    return out;
  }, [conflicts.length, headroom, fp, H, room.height, room.slabThickness]);
  const showBox = showFp || showConflict;

  return (
    <group>
      {showBox && (
        <>
          <mesh geometry={fpGeo} material={showConflict ? mats.conflict : mats.footprint} renderOrder={5} />
          <lineSegments geometry={fpEdges} renderOrder={6} ref={(l) => void l?.computeLineDistances()}>
            <lineDashedMaterial color={showConflict ? '#d1432f' : '#9a6b3c'} transparent opacity={0.7} depthTest={false} dashSize={0.08} gapSize={0.05} />
          </lineSegments>
        </>
      )}
      {conflicts.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.conflict} renderOrder={7} />
      ))}
      {camera === 'top' && (
        <lineSegments geometry={planLines} renderOrder={8}>
          <lineBasicMaterial color="#3b3a37" transparent opacity={0.55} depthTest={false} />
        </lineSegments>
      )}
      <Labels items={labels} />
    </group>
  );
}

