/** Procedural airliner. Nose points to -x, up is +y, wingspan along z. Length ~10 units. */
import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { airfoilOutline } from './flow';

export interface AirlinerMaterials {
  /** optional: draws a row of cabin windows along the fuselage */
  windows?: THREE.Material;
  body: THREE.Material;
  wing: THREE.Material;
  engine: THREE.Material;
  dark: THREE.Material;
  accent?: THREE.Material;
}

/** Wing lofted from real airfoil sections: root at origin, tip swept back (+x) and out (+z). */
export function wingGeometry(o: { span: number; root: number; tip: number; sweep: number; dihedral?: number; thickness?: number; sections?: number; twist?: number }) {
  const outline = airfoilOutline(40, 0.06, 0.1);
  const m = o.sections ?? 10;
  const n = outline.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= m; i++) {
    const s = i / m;
    const chord = o.root + (o.tip - o.root) * s;
    const tw = (o.twist ?? 0) * s;
    for (const [x, y] of outline) {
      const yy = y * (o.thickness ?? 1.2);
      const xr = x * Math.cos(tw) + yy * Math.sin(tw);
      const yr = -x * Math.sin(tw) + yy * Math.cos(tw);
      pos.push(xr * chord + o.sweep * s + chord * 0.5, yr * chord + (o.dihedral ?? 0) * s, o.span * s);
    }
  }
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      const a = i * n + j, b = i * n + ((j + 1) % n), c = a + n, d = b + n;
      idx.push(a, c, b, b, c, d);
    }
  // tip cap
  const tipC = pos.length / 3;
  let cx = 0, cy = 0;
  for (let j = 0; j < n; j++) { cx += pos[(m * n + j) * 3]; cy += pos[(m * n + j) * 3 + 1]; }
  pos.push(cx / n, cy / n, o.span);
  for (let j = 0; j < n; j++) idx.push(m * n + j, tipC, m * n + ((j + 1) % n));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const WING = { x: -1.55, y: -0.26, z: 0.36, span: 4.7, root: 2.5, tip: 0.62, sweep: 2.35, dihedral: 0.42 };
/** Where the engines hang (x of nacelle centre, y, |z|). */
export const ENGINES: [number, number, number][] = [[-0.55, -0.72, 1.75]];

export function useAirlinerGeometry() {
  return useMemo(() => {
    const prof: [number, number][] = [
      [0, 5.0], [0.1, 4.94], [0.22, 4.78], [0.34, 4.45], [0.43, 3.95], [0.475, 3.3], [0.49, 2.4], [0.49, -1.6],
      [0.465, -2.5], [0.39, -3.4], [0.27, -4.2], [0.15, -4.75], [0.07, -5.0], [0, -5.02],
    ];
    const fuselage = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40);
    fuselage.rotateZ(Math.PI / 2); // +y (nose) -> -x
    // slightly upswept tail
    const p = fuselage.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      if (x > 2) p.setY(i, p.getY(i) + Math.pow((x - 2) / 3, 2) * 0.28);
      if (x < -3.6) p.setY(i, p.getY(i) - Math.pow((-3.6 - x) / 1.4, 2) * 0.1);
    }
    fuselage.computeVertexNormals();
    const wing = wingGeometry({ span: WING.span, root: WING.root, tip: WING.tip, sweep: WING.sweep, dihedral: WING.dihedral, twist: -0.05 });
    const stab = wingGeometry({ span: 1.9, root: 1.15, tip: 0.45, sweep: 1.0, dihedral: 0.12, thickness: 0.9, sections: 4 });
    const fin = wingGeometry({ span: 1.55, root: 1.45, tip: 0.5, sweep: 1.25, thickness: 0.8, sections: 4 });
    const nacelle = new THREE.LatheGeometry(
      [[0.0, 0.62], [0.27, 0.62], [0.33, 0.5], [0.34, 0.1], [0.3, -0.35], [0.2, -0.62], [0.0, -0.62]].map(([r, y]) => new THREE.Vector2(r, y)),
      28,
    );
    nacelle.rotateZ(Math.PI / 2);
    const intake = new THREE.CircleGeometry(0.26, 28);
    intake.rotateY(-Math.PI / 2);
    const pylon = new THREE.BoxGeometry(0.75, 0.3, 0.06);
    // cockpit glass band
    const glass = new THREE.SphereGeometry(0.345, 24, 12, 0, Math.PI * 2, 0.95, 0.42);
    const windowGeo = new THREE.BoxGeometry(0.055, 0.075, 0.02);
    return { fuselage, wing, stab, fin, nacelle, intake, pylon, glass, windowGeo };
  }, []);
}

function Windows({ geo, mat }: { geo: THREE.BufferGeometry; mat: THREE.Material }) {
  const n = 46;
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++)
      for (const s of [1, -1]) {
        m.makeTranslation(-3.2 + (i / (n - 1)) * 5.2, 0.13, s * 0.466);
        ref.current!.setMatrixAt(i * 2 + (s > 0 ? 0 : 1), m);
      }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[geo, mat, n * 2]} />;
}

export const Airliner = forwardRef<THREE.Group, { mats: AirlinerMaterials; shadows?: boolean; children?: React.ReactNode }>(function Airliner({ mats, shadows, children }, ref) {
  const g = useAirlinerGeometry();
  const sh = { castShadow: shadows, receiveShadow: shadows };
  return (
    <group ref={ref}>
      <mesh geometry={g.fuselage} material={mats.body} {...sh} />
      <mesh geometry={g.glass} material={mats.dark} position={[-4.3, 0.1, 0]} rotation={[0, 0, Math.PI / 2 - 0.42]} scale={[1.02, 1, 1.12]} />
      {[1, -1].map((s) => (
        <group key={s} scale={[1, 1, s]}>
          <mesh geometry={g.wing} material={mats.wing} position={[WING.x, WING.y, WING.z]} {...sh} />
          <mesh geometry={g.stab} material={mats.wing} position={[3.35, 0.22, 0.2]} {...sh} />
          {ENGINES.map(([x, y, z], i) => (
            <group key={i} position={[x, y, z]}>
              <mesh geometry={g.nacelle} material={mats.engine} {...sh} />
              <mesh geometry={g.intake} material={mats.dark} position={[-0.6, 0, 0]} />
              <mesh geometry={g.pylon} material={mats.wing} position={[0.25, 0.36, 0]} />
            </group>
          ))}
        </group>
      ))}
      <mesh geometry={g.fin} material={mats.accent ?? mats.wing} position={[3.05, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]} {...sh} />
      {mats.windows && <Windows geo={g.windowGeo} mat={mats.windows} />}
      {children}
    </group>
  );
});
