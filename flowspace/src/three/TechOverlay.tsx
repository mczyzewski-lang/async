import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { JointId, TechnicalGuide } from '@/content/types';
import type { InstructorRig } from './rig/InstructorRig';
import { FLOOR_Y } from './rig/InstructorRig';

const MARKER_JOINTS: JointId[] = [
  'head', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR',
  'pelvis', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'chest',
];

const GOLD = new THREE.Color('#d8b46a');
const SAGE = new THREE.Color('#dfe8d2');

function overlayMat(color: THREE.Color, opacity = 0.95) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
}

/**
 * Subtle technical overlay: joints, alignment lines, pelvis/shoulder orientation,
 * floor contacts and an approximate balance marker. Context-dependent: only the guides
 * defined for the current pose are drawn.
 */
export function TechOverlay({ rig, guides, showJoints = true }: { rig: () => InstructorRig | null; guides: TechnicalGuide[]; showJoints?: boolean }) {
  const jointMesh = useRef<THREE.InstancedMesh>(null);
  const contactMesh = useRef<THREE.InstancedMesh>(null);
  const comRef = useRef<THREE.Group>(null);
    const lineGroup = useRef<THREE.Group>(null);
  const labelRefs = useRef<Array<THREE.Group | null>>([]);

  const jointGeom = useMemo(() => new THREE.SphereGeometry(0.018, 12, 8), []);
  const jointMat = useMemo(() => overlayMat(SAGE, 0.9), []);
  const ringGeom = useMemo(() => new THREE.RingGeometry(0.035, 0.05, 24).rotateX(-Math.PI / 2), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e7c98a', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }), []);

  const lineGuides = guides.filter((g) => g.kind === 'alignment' || g.kind === 'orientation' || g.kind === 'vertical');
  const arrowGuides = guides.filter((g) => g.kind === 'arrow');
  const showContacts = guides.some((g) => g.kind === 'contacts') || true;
  const showBalance = guides.some((g) => g.kind === 'balance');

  const lines = useMemo(
    () =>
      lineGuides.map((g) => {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(2, g.joints.length) * 3 + 6), 3));
        const mat = new THREE.LineDashedMaterial({ color: g.kind === 'orientation' ? '#f2e3c0' : GOLD, dashSize: 0.05, gapSize: 0.03, transparent: true, opacity: 0.95, depthTest: false });
        const line = new THREE.Line(geom, mat);
        line.renderOrder = 10;
        return { g, line };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guides],
  );
  const arrows = useMemo(
    () => arrowGuides.map((g) => ({ g, arrow: new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.35, 0xe7c98a, 0.08, 0.05) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guides],
  );
  arrows.forEach(({ arrow }) => {
    arrow.renderOrder = 10;
    (arrow.line.material as THREE.Material).depthTest = false;
    (arrow.cone.material as THREE.Material).depthTest = false;
  });

  const comLineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  }, []);

  const comLineObj = useMemo(
    () => new THREE.Line(comLineGeom, new THREE.LineDashedMaterial({ color: '#e0735a', dashSize: 0.04, gapSize: 0.03, depthTest: false })),
    [comLineGeom],
  );
  const m = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const v2 = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const r = rig();
    if (!r) return;
    if (jointMesh.current && showJoints) {
      MARKER_JOINTS.forEach((j, i) => {
        r.getJointWorld(j, v);
        jointMesh.current!.setMatrixAt(i, m.makeTranslation(v.x, v.y, v.z));
      });
      jointMesh.current.instanceMatrix.needsUpdate = true;
    }
    if (contactMesh.current) {
      const n = Math.min(r.contacts.length, 12);
      for (let i = 0; i < 12; i++) {
        if (i < n) contactMesh.current.setMatrixAt(i, m.makeTranslation(r.contacts[i].x, FLOOR_Y + 0.003, r.contacts[i].z));
        else contactMesh.current.setMatrixAt(i, m.makeScale(0, 0, 0));
      }
      contactMesh.current.instanceMatrix.needsUpdate = true;
    }
    lines.forEach(({ g, line }, i) => {
      const pa = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const pts = g.joints.map((j) => r.getJointWorld(j, new THREE.Vector3()));
      if (g.kind === 'vertical') {
        const top = pts[0];
        pa.setXYZ(0, top.x, top.y + 0.15, top.z);
        pa.setXYZ(1, top.x, FLOOR_Y, top.z);
        line.geometry.setDrawRange(0, 2);
      } else if (g.kind === 'orientation' && pts.length >= 2) {
        v.subVectors(pts[1], pts[0]);
        pa.setXYZ(0, pts[0].x - v.x * 0.45, pts[0].y - v.y * 0.45, pts[0].z - v.z * 0.45);
        pa.setXYZ(1, pts[1].x + v.x * 0.45, pts[1].y + v.y * 0.45, pts[1].z + v.z * 0.45);
        line.geometry.setDrawRange(0, 2);
      } else {
        pts.forEach((p, k) => pa.setXYZ(k, p.x, p.y, p.z));
        line.geometry.setDrawRange(0, pts.length);
      }
      pa.needsUpdate = true;
      line.computeLineDistances();
      const lbl = labelRefs.current[i];
      if (lbl && pts[0]) lbl.position.copy(pts[0]).add(v2.set(0, 0.12, 0));
    });
    arrows.forEach(({ g, arrow }) => {
      r.getJointWorld(g.joints[0], v);
      arrow.position.copy(v);
      r.bones.root.getWorldQuaternion(q);
      const d = v2.set(...(g.direction ?? [0, 1, 0])).normalize();
      // direction is given in the body frame of the pelvis (x = left, y = up, z = forward)
      d.applyQuaternion(q);
      arrow.setDirection(d);
    });
    if (comRef.current && showBalance) {
      const c = r.getCenterOfMass(v);
      comRef.current.position.set(c.x, FLOOR_Y + 0.004, c.z);
      const pa = comLineGeom.getAttribute('position') as THREE.BufferAttribute;
      pa.setXYZ(0, c.x, c.y, c.z);
      pa.setXYZ(1, c.x, FLOOR_Y, c.z);
      pa.needsUpdate = true;
      comLineObj.computeLineDistances();
    }
  });

  return (
    <group>
      {showJoints && <instancedMesh ref={jointMesh} args={[jointGeom, jointMat, MARKER_JOINTS.length]} renderOrder={11} frustumCulled={false} />}
      {showContacts && <instancedMesh ref={contactMesh} args={[ringGeom, ringMat, 12]} frustumCulled={false} />}
      <group ref={lineGroup}>
        {lines.map(({ line }, i) => (
          <primitive key={i} object={line} />
        ))}
        {arrows.map(({ arrow }, i) => (
          <primitive key={`a${i}`} object={arrow} />
        ))}
      </group>
      {lines.slice(0, 4).map(({ g }, i) => (
        <group key={`l${i}`} ref={(el) => { labelRefs.current[i] = el; }}>
          <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <span className="rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-paper">{g.labelPL}</span>
          </Html>
        </group>
      ))}
      {showBalance && (
        <>
          <group ref={comRef}>
            <mesh rotation-x={-Math.PI / 2} renderOrder={10}>
              <circleGeometry args={[0.045, 24]} />
              <meshBasicMaterial color="#e0735a" transparent opacity={0.85} depthTest={false} />
            </mesh>
          </group>
          <primitive object={comLineObj} />
        </>
      )}
    </group>
  );
}
