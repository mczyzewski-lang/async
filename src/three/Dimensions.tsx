import { Line } from '@react-three/drei';
import { Labels, type LabelItem } from './Labels';
import { useMemo } from 'react';
import * as THREE from 'three';
import { computeDimensions, type DimSpec, type DimTone, type DimView } from '../engine/dimensions';
import { getAnalysis } from '../engine/solve';
import { useLayout } from '../store/derived';
import { useStore } from '../store/useStore';

const COLORS: Record<DimTone, string> = {
  room: '#6f6a62',
  stair: '#9a6b3c',
  clear: '#3f7d5a',
  warn: '#d1432f',
  opening: '#6d6496',
};

const coneGeo = new THREE.ConeGeometry(0.022, 0.075, 10);
coneGeo.translate(0, -0.0375, 0);

function Arrow({ at, dir, color }: { at: THREE.Vector3; dir: THREE.Vector3; color: string }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()), [dir]);
  return (
    <mesh geometry={coneGeo} position={at} quaternion={q} renderOrder={20}>
      <meshBasicMaterial color={color} depthTest={false} transparent />
    </mesh>
  );
}

function Dim({ d }: { d: DimSpec }) {
  const color = COLORS[d.tone];
  const a = new THREE.Vector3(d.a.x, d.a.y, d.a.z);
  const b = new THREE.Vector3(d.b.x, d.b.y, d.b.z);
  const o = new THREE.Vector3(d.offset.x, d.offset.y, d.offset.z);
  const a2 = a.clone().add(o);
  const b2 = b.clone().add(o);
  const dir = b2.clone().sub(a2);
  const len = dir.length();
  if (len < 0.02) return null;
  dir.normalize();
  const hasOffset = o.lengthSq() > 1e-6;
  const on = o.clone().normalize().multiplyScalar(0.06);
  return (
    <group>
      <Line points={[a2, b2]} color={color} lineWidth={1.15} depthTest={false} transparent opacity={0.95} renderOrder={19} />
      {hasOffset && (
        <>
          <Line points={[a, a2.clone().add(on)]} color={color} lineWidth={0.6} depthTest={false} transparent opacity={0.55} renderOrder={19} />
          <Line points={[b, b2.clone().add(on)]} color={color} lineWidth={0.6} depthTest={false} transparent opacity={0.55} renderOrder={19} />
        </>
      )}
      {len > 0.18 && (
        <>
          <Arrow at={a2} dir={dir.clone().negate()} color={color} />
          <Arrow at={b2} dir={dir} color={color} />
        </>
      )}
    </group>
  );
}

export function Dimensions() {
  const show = useStore((s) => s.view.showDims);
  const camera = useStore((s) => s.view.camera);
  const config = useStore((s) => s.config);
  const layout = useLayout();
  const view: DimView = camera === 'top' ? 'top' : camera === 'side' ? 'side' : 'persp';
  const dims = useMemo(() => computeDimensions(view, layout, getAnalysis(layout, config), config), [view, layout, config]);
  const visible = show && camera !== 'eye';
  const labels = useMemo<LabelItem[]>(
    () =>
      visible
        ? dims.map((d) => ({
            id: d.id,
            pos: new THREE.Vector3((d.a.x + d.b.x) / 2 + d.offset.x, (d.a.y + d.b.y) / 2 + d.offset.y, (d.a.z + d.b.z) / 2 + d.offset.z),
            text: d.label,
            className: 'dim-label',
            color: COLORS[d.tone],
          }))
        : [],
    [dims, visible],
  );
  return (
    <group>
      {visible && dims.map((d) => <Dim key={d.id} d={d} />)}
      <Labels items={labels} />
    </group>
  );
}
