import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useLayout, useRuns } from '../store/derived';
import { useStore } from '../store/useStore';
import { buildRailings } from './geom/railing';
import { buildStair } from './geom/stair';
import { getMaterials, setLed, setRailing, setSteel, setWood } from './materials';

function GeometryMeshes({ geometries, ledVisible }: { geometries: Partial<Record<string, THREE.BufferGeometry>>; ledVisible?: boolean }) {
  const mats = getMaterials() as unknown as Record<string, THREE.Material>;
  useEffect(() => () => Object.values(geometries).forEach((g) => g?.dispose()), [geometries]);
  return (
    <>
      {Object.entries(geometries).map(([k, g]) =>
        g ? (
          <mesh
            key={k}
            geometry={g}
            material={mats[k]}
            castShadow={k !== 'led'}
            receiveShadow={k !== 'led'}
            visible={k === 'led' ? !!ledVisible : true}
          />
        ) : null,
      )}
    </>
  );
}

/** Steel structure, wooden treads and landings — rebuilt only when geometry inputs change. */
export function Staircase() {
  const layout = useLayout();
  const room = useStore((s) => s.config.room);
  const type = useStore((s) => s.config.structure.type);
  const risers = useStore((s) => s.config.structure.risers);
  const landingSupport = useStore((s) => s.config.structure.landingSupport);
  const edge = useStore((s) => s.config.treads.edge);
  const t = useStore((s) => s.config.stair.treadThickness);
  const nos = useStore((s) => s.config.stair.nosing);
  const led = useStore((s) => s.config.lighting.led);
  const geo = useMemo(
    () => buildStair({ layout, room, structure: { type, risers, landingSupport }, treads: { edge }, treadThickness: t, nosing: nos }),
    [layout, room, type, risers, landingSupport, edge, t, nos],
  );
  return <GeometryMeshes geometries={geo.geometries} ledVisible={led} />;
}

export function Railings() {
  const runs = useRuns();
  const r = useStore((s) => s.config.railing);
  const geo = useMemo(
    () =>
      buildRailings(runs, {
        type: r.type,
        height: r.height,
        profile: r.profile,
        spacing: r.spacing,
        handrailStyle: r.handrailStyle,
        handrailMaterial: r.handrailMaterial,
      }),
    [runs, r.type, r.height, r.profile, r.spacing, r.handrailStyle, r.handrailMaterial],
  );
  return <GeometryMeshes geometries={geo.geometries} />;
}

/** Keeps shared materials in sync with the configuration (no geometry rebuilds). */
export function MaterialSync() {
  const steelColor = useStore((s) => s.config.structure.steelColor);
  const steelFinish = useStore((s) => s.config.structure.steelFinish);
  const railColor = useStore((s) => s.config.railing.color);
  const railFinish = useStore((s) => s.config.railing.finish);
  const wood = useStore((s) => s.config.treads.wood);
  const lighting = useStore((s) => s.config.lighting);
  useEffect(() => setSteel(steelColor, steelFinish), [steelColor, steelFinish]);
  useEffect(() => setRailing(railColor, railFinish), [railColor, railFinish]);
  useEffect(() => setWood(wood), [wood]);
  useEffect(() => setLed(lighting.led, lighting.ledTemp, lighting.ledIntensity, lighting.mode === 'night'), [lighting]);
  return null;
}
