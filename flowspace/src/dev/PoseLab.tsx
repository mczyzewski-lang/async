import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import * as THREE from 'three';
import type { PoseState } from '@/content/types';
import { POSES_3D, getPose } from '@/content/poses';
import { flattenPose, lerpPose, mirrorPose, setPath } from '@/content/poseState';
import { Stage } from '@/three/Stage';
import type { CameraRequest } from '@/three/CameraRig';
import { PoseDirector } from '@/three/director';
import { FLOOR_Y, type InstructorRig } from '@/three/rig/InstructorRig';
import type { EnvironmentId } from '@/three/world/environments';

/** Debug helpers rendered inside the canvas. */
function Helpers({ rig, skeleton, axes }: { rig: () => InstructorRig | null; skeleton: boolean; axes: boolean }) {
  const group = useRef<THREE.Group>(null);
  const helper = useRef<THREE.SkeletonHelper | null>(null);
  const axesList = useRef<THREE.AxesHelper[]>([]);
  useEffect(() => {
    const r = rig();
    if (!r || !group.current) return;
    if (skeleton) {
      helper.current = new THREE.SkeletonHelper(r.group);
      (helper.current.material as THREE.LineBasicMaterial).depthTest = false;
      helper.current.renderOrder = 20;
      group.current.add(helper.current);
    }
    if (axes) {
      axesList.current = Object.values(r.bones).map((b) => {
        const a = new THREE.AxesHelper(0.08);
        (a.material as THREE.LineBasicMaterial).depthTest = false;
        a.renderOrder = 21;
        b.add(a);
        return a;
      });
    }
    return () => {
      if (helper.current) group.current?.remove(helper.current);
      helper.current = null;
      axesList.current.forEach((a) => a.parent?.remove(a));
      axesList.current = [];
    };
  }, [rig, skeleton, axes]);
  useFrame(() => helper.current?.updateMatrixWorld());
  return <group ref={group} />;
}

const GROUP_ORDER = ['root', 'spine', 'chest', 'neck', 'head', 'clav', 'shoulder', 'elbow', 'wrist', 'fingers', 'hip', 'knee', 'ankle', 'toes'];

export default function PoseLab() {
  const [poseId, setPoseId] = useState('downward-dog');
  const pose = getPose(poseId)!;
  const anim = pose.animation!;
  const [kfId, setKfId] = useState(anim.hold);
  const [mistakeId, setMistakeId] = useState('');
  const [side, setSide] = useState<'L' | 'R'>('L');
  const [state, setState] = useState<PoseState>(anim.keyframes.find((k) => k.id === anim.hold)!.state);
  const [tech, setTech] = useState(true);
  const [skeleton, setSkeleton] = useState(false);
  const [axes, setAxes] = useState(false);
  const [wire, setWire] = useState(false);
  const [ik, setIk] = useState(true);
  const [grounding, setGrounding] = useState(true);
  const [breath, setBreath] = useState(false);
  const [env, setEnv] = useState<EnvironmentId>('zen');
  const [filter, setFilter] = useState('');
  const [interp, setInterp] = useState({ a: anim.entry[0], b: anim.hold, t: 0 });
  const [speed, setSpeed] = useState(1);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const [info, setInfo] = useState({ cam: '', target: '', tag: '', status: '', contacts: 0, com: '' });
  const rigRef = useRef<InstructorRig | null>(null);
  const director = useRef<PoseDirector | null>(null);
  const nonce = useRef(1);
  const getRig = useCallback(() => rigRef.current, []);

  const apply = useCallback((s: PoseState, dur = 0) => {
    const r = rigRef.current;
    if (!r) return;
    r.setPose(side === 'R' ? mirrorPose(s) : s, dur, 'lab');
  }, [side]);

  useEffect(() => {
    const kf = anim.keyframes.find((k) => k.id === kfId) ?? anim.keyframes[anim.keyframes.length - 1];
    const m = pose.commonMistakes.find((x) => x.id === mistakeId);
    const s = m?.incorrectPoseState ?? kf.state;
    setState(s);
    apply(s, 0.8);
    rigRef.current?.setHighlights(m ? m.highlightedJoints : [], m ? 'error' : 'focus');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseId, kfId, mistakeId, side]);

  useEffect(() => {
    const r = rigRef.current;
    if (!r) return;
    r.enableIK = ik;
    r.grounding = grounding;
    r.breathingAmount = breath ? 1 : 0;
    r.speed = speed;
    r.material.wireframe = wire;
  }, [ik, grounding, breath, speed, wire]);

  useEffect(() => {
    const t = setInterval(() => {
      const r = rigRef.current;
      if (!r) return;
      const com = r.getCenterOfMass();
      setInfo((i) => ({ ...i, tag: r.currentTag, status: r.status, contacts: r.contacts.length, com: `${com.x.toFixed(2)}, ${com.y.toFixed(2)}, ${com.z.toFixed(2)}` }));
    }, 300);
    return () => clearInterval(t);
  }, []);

  const flat = useMemo(() => flattenPose(state), [state]);
  const keys = Object.keys(flat)
    .filter((k) => !filter || k.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => GROUP_ORDER.findIndex((g) => a.startsWith(g)) - GROUP_ORDER.findIndex((g) => b.startsWith(g)));

  const preset = (id: string) => {
    nonce.current++;
    setCamera({ preset: pose.cameraPresets.find((c) => c.id === id)!, facing: anim.facing, nonce: nonce.current, duration: 0.8 });
  };

  const onCameraUpdate = useCallback((cam: THREE.Camera, target: THREE.Vector3) => {
    if (Math.random() < 0.05) setInfo((i) => ({ ...i, cam: cam.position.toArray().map((v) => v.toFixed(2)).join(', '), target: target.toArray().map((v) => v.toFixed(2)).join(', ') }));
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-paper md:flex-row" data-testid="pose-lab">
      <div className="relative h-[52dvh] md:h-full md:flex-1">
        <Stage
          className="absolute inset-0"
          env={env}
          quality="medium"
          onRig={(r) => {
            rigRef.current = r;
            director.current = new PoseDirector(r);
            r.breathingAmount = 0;
            r.setPose(state, 0, 'lab');
            nonce.current++;
            setCamera({ preset: pose.cameraPresets.find((c) => c.id === 'side')!, facing: anim.facing, nonce: nonce.current, duration: 0 });
          }}
          camera={camera}
          techMode={tech}
          guides={pose.technicalGuides}
          onCameraUpdate={onCameraUpdate}
        >
          <Helpers rig={getRig} skeleton={skeleton} axes={axes} />
        </Stage>
        <div className="pointer-events-none absolute top-2 left-2 rounded-xl bg-ink/70 p-2 font-mono text-[10px] leading-tight text-paper">
          <div>tag: {info.tag} · {info.status}</div>
          <div>contacts: {info.contacts} · floor y={FLOOR_Y}</div>
          <div>COM: {info.com}</div>
          <div>cam: {info.cam}</div>
          <div>target: {info.target}</div>
        </div>
      </div>
      <aside className="h-[48dvh] overflow-y-auto border-t border-ink/10 p-3 text-sm md:h-full md:w-[380px] md:border-t-0 md:border-l">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-display text-xl">Pose Lab</h1>
          <Link to="/" className="text-xs underline">Aplikacja</Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="col-span-2 h-9 rounded-lg border px-2" value={poseId} onChange={(e) => { const p = getPose(e.target.value)!; setPoseId(p.id); setKfId(p.animation!.hold); setMistakeId(''); setInterp({ a: p.animation!.entry[0], b: p.animation!.hold, t: 0 }); }} aria-label="Pozycja">
            {POSES_3D.map((p) => <option key={p.id} value={p.id}>{p.namePL} ({p.id})</option>)}
          </select>
          <select className="h-9 rounded-lg border px-2" value={kfId} onChange={(e) => { setKfId(e.target.value); setMistakeId(''); }} aria-label="Klatka kluczowa">
            {anim.keyframes.map((k) => <option key={k.id} value={k.id}>{k.labelPL} [{k.base}]</option>)}
          </select>
          <select className="h-9 rounded-lg border px-2" value={mistakeId} onChange={(e) => setMistakeId(e.target.value)} aria-label="Błąd">
            <option value="">— poprawnie —</option>
            {pose.commonMistakes.filter((m) => m.incorrectPoseState).map((m) => <option key={m.id} value={m.id}>Błąd: {m.titlePL}</option>)}
          </select>
          <select className="h-9 rounded-lg border px-2" value={side} onChange={(e) => setSide(e.target.value as 'L' | 'R')} aria-label="Strona">
            <option value="L">Lewa (autorska)</option>
            <option value="R">Prawa (lustro)</option>
          </select>
          <select className="h-9 rounded-lg border px-2" value={env} onChange={(e) => setEnv(e.target.value as EnvironmentId)} aria-label="Otoczenie">
            {['zen', 'ocean', 'mountain', 'forest'].map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {[['Tryb techniczny', tech, setTech], ['Szkielet', skeleton, setSkeleton], ['Osie stawów', axes, setAxes], ['Siatka', wire, setWire], ['IK', ik, setIk], ['Uziemienie', grounding, setGrounding], ['Oddech', breath, setBreath]].map(([l, v, set]) => (
            <label key={l as string} className="flex items-center gap-1">
              <input type="checkbox" checked={v as boolean} onChange={(e) => (set as (b: boolean) => void)(e.target.checked)} /> {l as string}
            </label>
          ))}
        </div>

        <h2 className="mt-4 mb-1 font-semibold">Kamera</h2>
        <div className="flex flex-wrap gap-1">
          {pose.cameraPresets.map((c) => <button key={c.id} className="rounded-full border px-2 py-1 text-xs" onClick={() => preset(c.id)}>{c.labelPL}</button>)}
        </div>

        <h2 className="mt-4 mb-1 font-semibold">Animacja i interpolacja</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded-lg border px-2 py-1" onClick={() => director.current?.playEntry(pose, side)}>▶ Wejście</button>
          <button className="rounded-lg border px-2 py-1" onClick={() => director.current?.playExit(pose, side)}>◀ Wyjście</button>
          <label className="flex items-center gap-1">tempo
            <input type="range" min={0.1} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />{speed.toFixed(2)}
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select className="h-8 rounded-lg border px-1" value={interp.a} onChange={(e) => setInterp({ ...interp, a: e.target.value })}>{anim.keyframes.map((k) => <option key={k.id}>{k.id}</option>)}</select>
          <select className="h-8 rounded-lg border px-1" value={interp.b} onChange={(e) => setInterp({ ...interp, b: e.target.value })}>{anim.keyframes.map((k) => <option key={k.id}>{k.id}</option>)}</select>
          <label className="col-span-2 flex items-center gap-2">t
            <input
              className="flex-1"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={interp.t}
              onChange={(e) => {
                const t = Number(e.target.value);
                setInterp({ ...interp, t });
                const a = anim.keyframes.find((k) => k.id === interp.a)!.state;
                const b = anim.keyframes.find((k) => k.id === interp.b)!.state;
                apply(lerpPose(a, b, t), 0);
              }}
            />
            {interp.t.toFixed(2)}
          </label>
          <p className="col-span-2 text-[11px] text-ink-soft">Suwak interpoluje parametry anatomiczne (podgląd); odtwarzanie w aplikacji używa sferycznej interpolacji kwaternionów.</p>
        </div>

        <h2 className="mt-4 mb-1 flex items-center justify-between font-semibold">
          Parametry stawów
          <button className="rounded-lg border px-2 py-0.5 text-xs font-normal" onClick={() => navigator.clipboard?.writeText(JSON.stringify(state, null, 1))}>Kopiuj JSON</button>
        </h2>
        <input className="mb-2 h-8 w-full rounded-lg border px-2" placeholder="filtr (np. hipL)" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="space-y-1">
          {keys.map((k) => {
            const isPos = k === 'root.x' || k === 'root.z';
            const isUnit = k.startsWith('fingers');
            return (
              <label key={k} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 font-mono text-[11px]">
                <span className="truncate">{k}</span>
                <input
                  type="range"
                  min={isPos ? -1 : isUnit ? 0 : -180}
                  max={isPos ? 1 : isUnit ? 1 : 180}
                  step={isPos || isUnit ? 0.01 : 1}
                  value={flat[k]}
                  onChange={(e) => {
                    const s = setPath(state, k, Number(e.target.value));
                    setState(s);
                    apply(s, 0);
                  }}
                />
                <span className="text-right">{isPos || isUnit ? flat[k].toFixed(2) : Math.round(flat[k])}</span>
              </label>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
