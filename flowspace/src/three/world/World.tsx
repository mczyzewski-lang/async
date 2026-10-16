import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ENVIRONMENTS, type EnvironmentDef, type EnvironmentId } from './environments';
import { gravelTexture, groundTexture, matTexture, radialTexture, rng, woodDeckTexture } from './textures';

export type Quality = 'low' | 'medium' | 'high';

const windUniform = { value: 0 };

/** Adds gentle wind sway to a standard material (displacement grows with height). */
function addWind(mat: THREE.MeshStandardMaterial, strength = 0.06) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 wp = (instanceMatrix * vec4(position, 1.0)).xyz;
#else
vec3 wp = position;
#endif
float sway = max(0.0, position.y) * ${strength.toFixed(3)};
transformed.x += sin(uWind * 1.3 + wp.x * 0.35 + wp.z * 0.2) * sway;
transformed.z += cos(uWind * 1.1 + wp.z * 0.3) * sway * 0.6;`,
      );
  };
  mat.customProgramCacheKey = () => `wind${strength}`;
  return mat;
}

// ------------------------------------------------------------------ sky

function Sky({ env }: { env: EnvironmentDef }) {
  const mat = useMemo(() => {
    const sun = new THREE.Vector3(...env.sunDir).normalize();
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(env.skyTop) },
        horizon: { value: new THREE.Color(env.skyHorizon) },
        bottom: { value: new THREE.Color(env.skyBottom) },
        sunColor: { value: new THREE.Color(env.sunColor) },
        sunDir: { value: sun },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir;
        void main(){
          float h = vDir.y;
          vec3 col = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.85, h), 0.7)) : mix(horizon, bottom, smoothstep(0.0, 0.25, -h));
          float s = max(0.0, dot(normalize(vDir), sunDir));
          col += sunColor * (pow(s, 600.0) * 1.2 + pow(s, 24.0) * 0.25 + pow(s, 4.0) * 0.08);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }, [env]);
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}

// ------------------------------------------------------------------ mountains

function Mountains({ env }: { env: EnvironmentDef }) {
  const meshes = useMemo(
    () =>
      env.mountains.map((m) => {
        const r = rng(m.seed);
        const seg = 160;
        const pos: number[] = [];
        const idx: number[] = [];
        const phases = [r() * 6, r() * 6, r() * 6, r() * 6];
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * Math.PI * 2;
          const n =
            0.55 +
            0.25 * Math.sin(a * 3 + phases[0]) +
            0.15 * Math.sin(a * 7 + phases[1]) +
            0.08 * Math.sin(a * 17 + phases[2]) +
            0.04 * Math.sin(a * 37 + phases[3]);
          const peak = Math.pow(Math.max(0.05, n), 1.6) * m.height;
          const x = Math.sin(a) * m.radius;
          const z = Math.cos(a) * m.radius;
          pos.push(x, -2, z, x * 1.02, peak, z * 1.02);
          if (i < seg) {
            const b = i * 2;
            idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const mat = new THREE.MeshBasicMaterial({ color: m.color, side: THREE.DoubleSide, fog: true });
        return { g, mat };
      }),
    [env],
  );
  return (
    <>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.g} material={m.mat} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ ground

function Ground({ env, quality }: { env: EnvironmentDef; quality: Quality }) {
  const waterMat = useRef<THREE.ShaderMaterial | null>(null);
  const mat = useMemo(() => {
    if (env.ground === 'water') {
      const m = new THREE.ShaderMaterial({
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uTime: { value: 0 },
            deep: { value: new THREE.Color(env.groundColor) },
            shallow: { value: new THREE.Color(env.groundAccent) },
            sky: { value: new THREE.Color(env.skyHorizon) },
            sunDir: { value: new THREE.Vector3(...env.sunDir).normalize() },
            sunColor: { value: new THREE.Color(env.sunColor) },
          },
        ]),
        vertexShader: `
          uniform float uTime; varying vec3 vWorld; varying vec3 vN;
          #include <fog_pars_vertex>
          void main(){
            vec3 p = position;
            float w = sin(p.x*0.22 + uTime*0.8)*0.12 + sin(p.y*0.31 + uTime*0.6)*0.1 + sin((p.x+p.y)*0.6 + uTime*1.3)*0.04;
            p.z += w;
            vec4 wp = modelMatrix * vec4(p,1.0);
            vWorld = wp.xyz;
            float dx = cos(p.x*0.22 + uTime*0.8)*0.026 + cos((p.x+p.y)*0.6 + uTime*1.3)*0.024;
            float dy = cos(p.y*0.31 + uTime*0.6)*0.031 + cos((p.x+p.y)*0.6 + uTime*1.3)*0.024;
            vN = normalize(vec3(-dx, 1.0, dy));
            vec4 mvPosition = viewMatrix * wp;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform vec3 deep; uniform vec3 shallow; uniform vec3 sky; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vWorld; varying vec3 vN;
          #include <fog_pars_fragment>
          void main(){
            vec3 V = normalize(cameraPosition - vWorld);
            float fres = pow(1.0 - max(dot(V, vN), 0.0), 3.0);
            vec3 col = mix(deep, shallow, 0.25);
            col = mix(col, sky, fres*0.75);
            vec3 H = normalize(V + sunDir);
            col += sunColor * pow(max(dot(vN, H), 0.0), 220.0) * 1.4;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`,
      });
      waterMat.current = m;
      return m;
    }
    waterMat.current = null;
    const map = env.ground === 'gravel' ? gravelTexture() : groundTexture(env.groundColor, env.groundAccent, env.ground === 'moss' ? 9 : 5);
    return new THREE.MeshStandardMaterial({ map, roughness: 1, color: env.ground === 'gravel' ? '#ffffff' : '#ffffff' });
  }, [env]);
  useFrame((_, dt) => {
    if (waterMat.current) waterMat.current.uniforms.uTime.value += dt;
  });
  const isWater = env.ground === 'water';
  const seg = isWater ? (quality === 'low' ? 60 : 140) : 1;
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={isWater ? -1.4 : -0.16} receiveShadow={!isWater} material={mat}>
      <planeGeometry args={[600, 600, seg, seg]} />
    </mesh>
  );
}

// ------------------------------------------------------------------ deck, mat, pavilion

function Deck({ env, quality }: { env: EnvironmentDef; quality: Quality }) {
  const size = env.ground === 'water' ? 7 : 6;
  const top = useMemo(() => {
    const t = woodDeckTexture(env.deckColor).clone();
    t.repeat.set(size / 3, size / 3);
    t.needsUpdate = true;
    return t;
  }, [env, size]);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(env.deckColor).multiplyScalar(0.55), roughness: 0.85 }), [env]);
  const shadowTex = radialTexture('rgba(30,20,10,0.35)');
  return (
    <group>
      <mesh position-y={-0.08} receiveShadow castShadow={quality !== 'low'}>
        <boxGeometry args={[size, 0.16, size]} />
        <meshStandardMaterial attach="material-0" color={env.deckColor} roughness={0.8} />
        <meshStandardMaterial attach="material-1" color={env.deckColor} roughness={0.8} />
        <meshStandardMaterial attach="material-2" map={top} roughness={0.72} />
        <meshStandardMaterial attach="material-3" color={env.deckColor} roughness={0.8} />
        <meshStandardMaterial attach="material-4" color={env.deckColor} roughness={0.8} />
        <meshStandardMaterial attach="material-5" color={env.deckColor} roughness={0.8} />
      </mesh>
      {/* supporting beams / stilts */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (size / 2 - 0.25), env.ground === 'water' ? -1.6 : -0.6, sz * (size / 2 - 0.25)]} material={dark}>
            <boxGeometry args={[0.22, env.ground === 'water' ? 3 : 0.9, 0.22]} />
          </mesh>
        )),
      )}
      {/* soft ambient-occlusion blob under the mat */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
        <planeGeometry args={[1.6, 2.8]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

export function YogaMat({ color }: { color: string }) {
  const map = matTexture(color);
  const geom = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 0.61;
    const l = 1.83;
    const r = 0.03;
    shape.moveTo(-w / 2 + r, -l / 2);
    shape.lineTo(w / 2 - r, -l / 2);
    shape.quadraticCurveTo(w / 2, -l / 2, w / 2, -l / 2 + r);
    shape.lineTo(w / 2, l / 2 - r);
    shape.quadraticCurveTo(w / 2, l / 2, w / 2 - r, l / 2);
    shape.lineTo(-w / 2 + r, l / 2);
    shape.quadraticCurveTo(-w / 2, l / 2, -w / 2, l / 2 - r);
    shape.lineTo(-w / 2, -l / 2 + r);
    shape.quadraticCurveTo(-w / 2, -l / 2, -w / 2 + r, -l / 2);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    // UVs from the shape (x,y) → 0..1
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + l / 2) / l);
    return g;
  }, []);
  return (
    <mesh geometry={geom} position-y={0.002} receiveShadow>
      <meshStandardMaterial map={map} roughness={0.95} />
    </mesh>
  );
}

function Pavilion({ env }: { env: EnvironmentDef }) {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(env.deckColor).multiplyScalar(0.62), roughness: 0.75 }), [env]);
  const roof = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a524a', roughness: 0.9 }), []);
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1e8d6', roughness: 1, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), []);
  const h = 3.05;
  const s = 2.85;
  return (
    <group>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`p${sx}${sz}`} position={[sx * s, h / 2, sz * s]} material={wood} castShadow>
            <boxGeometry args={[0.16, h, 0.16]} />
          </mesh>
        )),
      )}
      {/* top beams */}
      {[-1, 1].map((sz) => (
        <mesh key={`bx${sz}`} position={[0, h - 0.06, sz * s]} material={wood} castShadow>
          <boxGeometry args={[s * 2 + 0.5, 0.16, 0.18]} />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={`bz${sx}`} position={[sx * s, h - 0.06, 0]} material={wood} castShadow>
          <boxGeometry args={[0.18, 0.16, s * 2 + 0.5]} />
        </mesh>
      ))}
      {/* thin roof with slight overhang */}
      <mesh position={[0, h + 0.12, 0]} material={roof} castShadow>
        <boxGeometry args={[s * 2 + 1.4, 0.1, s * 2 + 1.4]} />
      </mesh>
      <mesh position={[0, h + 0.22, 0]} material={roof} castShadow>
        <boxGeometry args={[s * 2 + 0.6, 0.1, s * 2 + 0.6]} />
      </mesh>
      {/* shoji screen panel at the back */}
      <group position={[0, 1.25, -s]}>
        <mesh material={paper}>
          <planeGeometry args={[2.4, 2.2]} />
        </mesh>
        {[-1.2, -0.6, 0, 0.6, 1.2].map((x) => (
          <mesh key={x} position={[x, 0, 0.01]} material={wood}>
            <boxGeometry args={[0.035, 2.2, 0.03]} />
          </mesh>
        ))}
        {[-1.1, -0.55, 0, 0.55, 1.1].map((y) => (
          <mesh key={y} position={[0, y, 0.01]} material={wood}>
            <boxGeometry args={[2.4, 0.035, 0.03]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ vegetation

function Trees({ env, quality }: { env: EnvironmentDef; quality: Quality }) {
  const data = useMemo(() => {
    const r = rng(env.id.length * 97 + 13);
    const scale = quality === 'low' ? 0.5 : quality === 'medium' ? 0.8 : 1;
    const nMaple = Math.round(env.trees.maple * scale);
    const nPine = Math.round(env.trees.pine * scale);
    const trunks: THREE.Matrix4[] = [];
    const blobs: Array<{ m: THREE.Matrix4; c: THREE.Color }> = [];
    const cones: Array<{ m: THREE.Matrix4; c: THREE.Color }> = [];
    const place = () => {
      // keep the view toward the camera (+Z) open
      for (let tries = 0; tries < 20; tries++) {
        const a = r() * Math.PI * 2;
        const d = env.trees.radiusMin + r() * (env.trees.radiusMax - env.trees.radiusMin);
        const x = Math.sin(a) * d;
        const z = Math.cos(a) * d;
        if (z > 3 && Math.abs(x) < 9) continue;
        return [x, z] as const;
      }
      return [20, -20] as const;
    };
    const q = new THREE.Quaternion();
    const tmp = new THREE.Vector3();
    const mapleBase = new THREE.Color(env.trees.mapleColor);
    for (let i = 0; i < nMaple; i++) {
      const [x, z] = place();
      const h = 2.2 + r() * 1.8;
      trunks.push(new THREE.Matrix4().compose(tmp.set(x, h / 2 - 0.2, z), q.identity(), new THREE.Vector3(0.12, h, 0.12)));
      const n = 12 + Math.floor(r() * 6);
      for (let k = 0; k < n; k++) {
        const a = r() * Math.PI * 2;
        const rr = r() * 1.5;
        const s = 0.45 + r() * 0.45;
        const c = mapleBase.clone().offsetHSL((r() - 0.5) * 0.05, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
        blobs.push({ m: new THREE.Matrix4().compose(tmp.set(x + Math.sin(a) * rr, h + r() * 1.0 - 0.1, z + Math.cos(a) * rr), q.identity(), new THREE.Vector3(s * 1.2, s * 0.75, s * 1.2)), c });
      }
    }
    const pineBase = new THREE.Color('#3f5a3c');
    for (let i = 0; i < nPine; i++) {
      const [x, z] = place();
      const h = 3.5 + r() * 4;
      trunks.push(new THREE.Matrix4().compose(tmp.set(x, h / 2 - 0.2, z), q.identity(), new THREE.Vector3(0.16, h, 0.16)));
      const tiers = 4 + Math.floor(r() * 2);
      for (let k = 0; k < tiers; k++) {
        const t = k / tiers;
        const s = (1 - t * 0.7) * (1.1 + r() * 0.4);
        const c = pineBase.clone().offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.06 + t * 0.05);
        cones.push({ m: new THREE.Matrix4().compose(tmp.set(x, h * (0.32 + t * 0.62), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s, s * 1.5, s)), c });
      }
    }
    return { trunks, blobs, cones };
  }, [env, quality]);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const blobRef = useRef<THREE.InstancedMesh>(null);
  const coneRef = useRef<THREE.InstancedMesh>(null);
  const coneGeom = useMemo(() => new THREE.ConeGeometry(1, 1.4, 9, 1).translate(0, 0.2, 0), []);
  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a3a2e', roughness: 0.95 }), []);
  const blobMat = useMemo(() => addWind(new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: false }), 0.07), []);
  const blobGeom = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  useEffect(() => {
    data.trunks.forEach((m, i) => trunkRef.current?.setMatrixAt(i, m));
    data.blobs.forEach((b, i) => {
      blobRef.current?.setMatrixAt(i, b.m);
      blobRef.current?.setColorAt(i, b.c);
    });
    data.cones.forEach((b, i) => {
      coneRef.current?.setMatrixAt(i, b.m);
      coneRef.current?.setColorAt(i, b.c);
    });
    if (coneRef.current) {
      coneRef.current.instanceMatrix.needsUpdate = true;
      if (coneRef.current.instanceColor) coneRef.current.instanceColor.needsUpdate = true;
    }
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true;
    if (blobRef.current) {
      blobRef.current.instanceMatrix.needsUpdate = true;
      if (blobRef.current.instanceColor) blobRef.current.instanceColor.needsUpdate = true;
    }
  }, [data]);
  if (!data.trunks.length) return null;
  return (
    <group>
      <instancedMesh key={`t${data.trunks.length}`} ref={trunkRef} args={[undefined, trunkMat, data.trunks.length]} castShadow={quality === 'high'}>
        <cylinderGeometry args={[0.6, 1, 1, 7]} />
      </instancedMesh>
      {data.blobs.length > 0 && <instancedMesh key={`b${data.blobs.length}`} ref={blobRef} args={[blobGeom, blobMat, data.blobs.length]} castShadow={quality === 'high'} />}
      {data.cones.length > 0 && <instancedMesh key={`c${data.cones.length}`} ref={coneRef} args={[coneGeom, blobMat, data.cones.length]} castShadow={quality === 'high'} />}
    </group>
  );
}

function Rocks({ env }: { env: EnvironmentDef }) {
  const items = useMemo(() => {
    const r = rng(env.id.length * 7 + 1);
    const list: Array<{ p: [number, number, number]; s: [number, number, number]; rot: number; c: string }> = [];
    const n = env.ground === 'gravel' ? 9 : env.ground === 'water' ? 0 : 7;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = 4.2 + r() * 6;
      const x = Math.sin(a) * d;
      const z = Math.cos(a) * d;
      if (z > 2.5 && Math.abs(x) < 4) continue;
      const s = 0.3 + r() * 0.7;
      list.push({ p: [x, -0.12 + s * 0.15, z], s: [s * 1.4, s * 0.7, s], rot: r() * 6, c: r() < 0.5 ? '#8c877c' : '#76736a' });
    }
    return list;
  }, [env]);
  const geom = useMemo(() => new THREE.DodecahedronGeometry(1, 1), []);
  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} geometry={geom} position={it.p} scale={it.s} rotation-y={it.rot} castShadow receiveShadow>
          <meshStandardMaterial color={it.c} roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}

function StoneLantern() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a857a', roughness: 0.95 }), []);
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f6e2b5', emissive: '#f2c06a', emissiveIntensity: 0.5 }), []);
  return (
    <group position={[-3.8, -0.16, -2.2]}>
      <mesh position-y={0.15} material={mat} castShadow><cylinderGeometry args={[0.28, 0.32, 0.3, 8]} /></mesh>
      <mesh position-y={0.6} material={mat} castShadow><cylinderGeometry args={[0.09, 0.11, 0.6, 8]} /></mesh>
      <mesh position-y={1.0} material={mat} castShadow><boxGeometry args={[0.42, 0.18, 0.42]} /></mesh>
      <mesh position-y={1.2} material={glow}><boxGeometry args={[0.24, 0.22, 0.24]} /></mesh>
      <mesh position-y={1.42} material={mat} castShadow><coneGeometry args={[0.42, 0.28, 4]} /></mesh>
    </group>
  );
}

function Particles({ color, quality }: { color: string; quality: Quality }) {
  const ref = useRef<THREE.Points>(null);
  const n = quality === 'low' ? 30 : 80;
  const { geom, base } = useMemo(() => {
    const r = rng(42);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (r() - 0.5) * 12;
      arr[i * 3 + 1] = r() * 4;
      arr[i * 3 + 2] = (r() - 0.5) * 12;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return { geom: g, base: arr.slice() };
  }, [n]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pa = geom.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      pa.setXYZ(
        i,
        base[i * 3] + Math.sin(t * 0.13 + i) * 0.6,
        ((base[i * 3 + 1] + t * 0.05 * (0.5 + (i % 5) * 0.1)) % 4) + 0.1,
        base[i * 3 + 2] + Math.cos(t * 0.11 + i * 1.7) * 0.6,
      );
    }
    pa.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial color={color} size={0.035} transparent opacity={0.55} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// ------------------------------------------------------------------ lights & world

function Lights({ env, quality }: { env: EnvironmentDef; quality: Quality }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const dir = useMemo(() => new THREE.Vector3(...env.sunDir).normalize().multiplyScalar(12), [env]);
  useEffect(() => {
    const l = sun.current;
    if (!l) return;
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = -3.5;
    cam.right = 3.5;
    cam.top = 3.5;
    cam.bottom = -3.5;
    cam.near = 1;
    cam.far = 30;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.02;
  }, [quality]);
  const mapSize = quality === 'high' ? 2048 : 1024;
  return (
    <>
      <hemisphereLight args={[env.hemiSky, env.hemiGround, env.hemiIntensity]} />
      <directionalLight
        ref={sun}
        position={dir.toArray()}
        intensity={env.sunIntensity}
        color={env.sunColor}
        castShadow={quality !== 'low'}
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
      />
      {/* soft fill from the camera side keeps the instructor readable */}
      <directionalLight position={[2, 3, 8]} intensity={0.45} color="#fff8ee" />
    </>
  );
}

export function World({ envId, quality }: { envId: EnvironmentId; quality: Quality }) {
  const env = ENVIRONMENTS[envId];
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog(env.fog, env.fogNear, env.fogFar);
    scene.background = new THREE.Color(env.skyHorizon);
    gl.toneMappingExposure = env.exposure;
    return () => {
      scene.fog = null;
    };
  }, [env, scene, gl]);
  useFrame((_, dt) => {
    windUniform.value += dt;
  });
  return (
    <group>
      <Sky env={env} />
      <Lights env={env} quality={quality} />
      <Mountains env={env} />
      <Ground env={env} quality={quality} />
      <Deck env={env} quality={quality} />
      <YogaMat color={env.matColor} />
      {env.pavilion && <Pavilion env={env} />}
      {env.pavilion && <StoneLantern />}
      <Rocks env={env} />
      <Trees env={env} quality={quality} />
      {quality !== 'low' && <Particles color={env.particles} quality={quality} />}
    </group>
  );
}

