/**
 * Builds public/models/instructor.glb from CC0 sources (see sources.ts):
 *
 * 1. downloads the sources into .avatar-cache/ (once)
 * 2. replaces the avatar's body with the complete reconstructed MakeHuman body (body.ts), so the
 *    yoga outfit can be skin-tight (MPFB removed the skin under the original T-shirt and jeans)
 * 3. paints the outfit (fitted top + 7/8 leggings) into the skin texture (garment.ts) and drops the
 *    original clothing mesh, teeth, tongue and strand eyelashes
 * 4. simplifies the eyebrow cards, re-encodes textures as WebP, quantizes and meshopt-compresses
 *
 * Usage: npm run avatar:build
 */
import { NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, simplifyPrimitive, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CACHE, fetchSources } from './sources';
import { readBaseObj, reconstructBody } from './body';
import { paintOutfit } from './garment';

const OUT = resolve(import.meta.dirname, '../../public/models/instructor.glb');
const DROP = ['teeth_base', 'tongue01', 'mind_eyelashes_02', 'female_casualsuit01'];

await fetchSources();
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(resolve(CACHE, 'mpfb.glb'));
const root = doc.getRoot();
const buffer = root.listBuffers()[0];

// ---------------------------------------------------------------- body reconstruction
const bodyMesh = root.listMeshes().find((m) => m.getName() === 'base')!;
const bodyPrim: Primitive = bodyMesh.listPrimitives()[0];
const P = bodyPrim.getAttribute('POSITION')!;
const UV = bodyPrim.getAttribute('TEXCOORD_0')!;
const J = bodyPrim.getAttribute('JOINTS_0')!;
const W = bodyPrim.getAttribute('WEIGHTS_0')!;
const skin = root.listSkins()[0];
const jointNames = skin.listJoints().map((j) => j.getName());

const obj = readBaseObj();
const uvKey = (u: number, v: number) => `${Math.round(u * 1e5)},${Math.round(v * 1e5)}`;
const vtToV = new Map<string, number>();
for (const f of obj.faces) f.t.forEach((t, i) => vtToV.set(uvKey(obj.VT[t][0], obj.VT[t][1]), f.v[i]));
const known = new Map<number, number[]>();
const knownSrc = new Map<number, number>();
for (let i = 0; i < P.getCount(); i++) {
  const uv = UV.getElement(i, []);
  const k = vtToV.get(uvKey(uv[0], 1 - uv[1]));
  if (k === undefined) continue;
  known.set(k, P.getElement(i, []));
  knownSrc.set(k, i);
}
const { pos, rms } = reconstructBody(obj, known);
console.log(`body: ${known.size} visible vertices matched, fit rms ${(rms * 1000).toFixed(1)} mm, ${pos.size - known.size} recovered`);

// Skin weights: original weights where the skin was exported, MPFB game-engine weights elsewhere
// (bone names mapped automatically by overlap on the shared vertices).
const ge = JSON.parse(readFileSync(resolve(CACHE, 'weights.game_engine.json'), 'utf8')).weights as Record<string, [number, number][]>;
const geW = new Map<number, Map<string, number>>();
for (const [bone, list] of Object.entries(ge))
  for (const [v, w] of list) {
    if (!geW.has(v)) geW.set(v, new Map());
    geW.get(v)!.set(bone, w);
  }
const srcWeights = (i: number) => {
  const j = J.getElement(i, []);
  const w = W.getElement(i, []);
  const m = new Map<string, number>();
  j.forEach((b, k) => w[k] > 0 && m.set(jointNames[b], (m.get(jointNames[b]) ?? 0) + w[k]));
  return m;
};
// MPFB game-engine bone names → the avatar's (Mixamo-style) names.
const side = (n: string) => (n.endsWith('_l') ? 'Left' : 'Right');
const boneMap = new Map<string, string>(
  Object.keys(ge).map((g) => {
    const base = g.replace(/_[lr]$/, '');
    const fixed: Record<string, string> = {
      Root: 'Hips', pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', head: 'Head',
    };
    if (fixed[g]) return [g, fixed[g]];
    const limb: Record<string, string> = {
      clavicle: 'Shoulder', upperarm: 'Arm', lowerarm: 'ForeArm', hand: 'Hand', thigh: 'UpLeg', calf: 'Leg', foot: 'Foot', ball: 'ToeBase',
    };
    if (limb[base]) return [g, side(g) + limb[base]];
    const m = /^(thumb|index|middle|ring|pinky)_0(\d)$/.exec(base);
    if (m) return [g, `${side(g)}Hand${m[1][0].toUpperCase()}${m[1].slice(1)}${m[2]}`];
    throw new Error(`unmapped bone ${g}`);
  }),
);
for (const n of boneMap.values()) if (!jointNames.includes(n)) throw new Error(`avatar has no bone ${n}`);
const fallbackBone = (v: number) => {
  // vertices without game-engine weights: copy the nearest exported vertex
  let best = -1;
  let bd = Infinity;
  const p = pos.get(v)!;
  for (const [k] of knownSrc) {
    const q = pos.get(k)!;
    const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return srcWeights(knownSrc.get(best)!);
};
const weightsOf = (v: number): Map<string, number> => {
  if (knownSrc.has(v)) return srcWeights(knownSrc.get(v)!);
  const m = new Map<string, number>();
  for (const [g, w] of geW.get(v) ?? []) {
    const n = boneMap.get(g);
    if (n) m.set(n, (m.get(n) ?? 0) + w);
  }
  return m.size ? m : fallbackBone(v);
};

// Fabric spans small surface details: the nipple and navel areas are replaced by a smooth membrane
// (harmonic fill from the surrounding ring), the way a fitted sports top lies over them.
{
  const nbr = new Map<number, Set<number>>();
  for (const f of obj.faces)
    f.v.forEach((a, k) => {
      const b = f.v[(k + 1) % f.v.length];
      (nbr.get(a) ?? nbr.set(a, new Set()).get(a)!).add(b);
      (nbr.get(b) ?? nbr.set(b, new Set()).get(b)!).add(a);
    });
  const all = [...pos.keys()];
  const P3 = (i: number) => pos.get(i)!;
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const membrane = (center: number[], radius: number) => {
    const free = all.filter((i) => dist(P3(i), center) < radius);
    for (let it = 0; it < 400; it++)
      for (const i of free) {
        const ns = [...nbr.get(i)!];
        pos.set(i, [0, 1, 2].map((a) => ns.reduce((s2, j) => s2 + P3(j)[a], 0) / ns.length));
      }
    return free.length;
  };
  const chest = all.filter((i) => P3(i)[1] > 1.17 && P3(i)[1] < 1.36 && Math.abs(P3(i)[0]) < 0.15);
  for (const sx of [-1, 1]) {
    const apex = chest.filter((i) => Math.sign(P3(i)[0]) === sx).reduce((a, b) => (P3(b)[2] > P3(a)[2] ? b : a));
    membrane([...P3(apex)], 0.028);
  }
  // navel: the centre-line point lying deepest below the straight line through its neighbours
  const line = all
    .filter((i) => Math.abs(P3(i)[0]) < 0.008 && P3(i)[1] > 0.98 && P3(i)[1] < 1.15 && P3(i)[2] > 0.02)
    .sort((a, b) => P3(a)[1] - P3(b)[1]);
  const zAt = (y: number) => {
    const c = line.reduce((a, b) => (Math.abs(P3(b)[1] - y) < Math.abs(P3(a)[1] - y) ? b : a));
    return P3(c)[2];
  };
  let navel = line[0];
  let depth = -Infinity;
  for (const i of line) {
    const [, y, z] = P3(i);
    const d = (zAt(y - 0.03) + zAt(y + 0.03)) / 2 - z;
    if (d > depth) {
      depth = d;
      navel = i;
    }
  }
  console.log(`navel at y=${P3(navel)[1].toFixed(3)} depth ${(depth * 1000).toFixed(1)} mm`);
  membrane([...P3(navel)], 0.03);
}

// Vertices = unique (position index, uv index) pairs; quads → triangles.
const vid = new Map<string, number>();
const positions: number[] = [];
const uvs: number[] = [];
const joints: number[] = [];
const weights: number[] = [];
const baseIdx: number[] = [];
const indices: number[] = [];
const vert = (v: number, t: number) => {
  const k = `${v}/${t}`;
  let id = vid.get(k);
  if (id !== undefined) return id;
  id = baseIdx.length;
  vid.set(k, id);
  baseIdx.push(v);
  positions.push(...pos.get(v)!);
  uvs.push(obj.VT[t][0], 1 - obj.VT[t][1]);
  const w = [...weightsOf(v).entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = w.reduce((s, [, x]) => s + x, 0) || 1;
  for (let k2 = 0; k2 < 4; k2++) {
    joints.push(w[k2] ? jointNames.indexOf(w[k2][0]) : 0);
    weights.push(w[k2] ? w[k2][1] / sum : 0);
  }
  return id;
};
for (const f of obj.faces) {
  const ids = f.v.map((v, i) => vert(v, f.t[i]));
  for (let k = 1; k + 1 < ids.length; k++) indices.push(ids[0], ids[k], ids[k + 1]);
}
// Smooth normals shared across UV seams.
const acc = new Map<number, number[]>();
for (let t = 0; t < indices.length; t += 3) {
  const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
  const pa = positions.slice(a * 3, a * 3 + 3);
  const pb = positions.slice(b * 3, b * 3 + 3);
  const pc = positions.slice(c * 3, c * 3 + 3);
  const u = pb.map((x, i) => x - pa[i]);
  const v = pc.map((x, i) => x - pa[i]);
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  for (const id of [a, b, c]) {
    const k = baseIdx[id];
    const s = acc.get(k) ?? [0, 0, 0];
    acc.set(k, s.map((x, i) => x + n[i]));
  }
}
const normals: number[] = [];
for (const k of baseIdx) {
  const n = acc.get(k)!;
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  normals.push(n[0] / l, n[1] / l, n[2] / l);
}

const acc32 = (type: 'VEC2' | 'VEC3' | 'VEC4' | 'SCALAR', arr: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>) =>
  doc.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
for (const t of bodyPrim.listTargets()) t.dispose();
bodyPrim
  .setAttribute('POSITION', acc32('VEC3', new Float32Array(positions)))
  .setAttribute('NORMAL', acc32('VEC3', new Float32Array(normals)))
  .setAttribute('TEXCOORD_0', acc32('VEC2', new Float32Array(uvs)))
  .setAttribute('JOINTS_0', acc32('VEC4', new Uint16Array(joints)))
  .setAttribute('WEIGHTS_0', acc32('VEC4', new Float32Array(weights)))
  .setIndices(acc32('SCALAR', new Uint32Array(indices)));
console.log(`body mesh: ${baseIdx.length} vertices, ${indices.length / 3} triangles`);

// ---------------------------------------------------------------- outfit painted into the skin texture
const bodyMat = bodyPrim.getMaterial()!;
const skinTex = bodyMat.getBaseColorTexture()!;
const img = sharp(Buffer.from(skinTex.getImage()!));
const meta = await img.metadata();
const rgba = await img.ensureAlpha().raw().toBuffer();
const armness = baseIdx.map((v) => {
  let a = 0;
  for (const [n, w] of weightsOf(v)) if (/Arm|Hand|Shoulder/.test(n)) a += /Shoulder/.test(n) ? w * 0.5 : w;
  return a;
});
const headness = baseIdx.map((v) => {
  let a = 0;
  for (const [n, w] of weightsOf(v)) if (/Head|Neck|Jaw|Eye|Orbicularis/.test(n)) a += w;
  return a;
});
const { color, rough } = paintOutfit({ rgba, width: meta.width!, height: meta.height!, positions, uvs, indices, armness, headness });
if (process.env.AVATAR_DEBUG) await sharp(color, { raw: { width: meta.width!, height: meta.height!, channels: 4 } }).png().toFile(resolve(CACHE, 'debug-skin.png'));
skinTex.setImage(await sharp(color, { raw: { width: meta.width!, height: meta.height!, channels: 4 } }).png().toBuffer()).setMimeType('image/png');
const roughTex = doc
  .createTexture('outfit_roughness')
  .setImage(await sharp(rough, { raw: { width: meta.width!, height: meta.height!, channels: 4 } }).resize(512, 512).png().toBuffer())
  .setMimeType('image/png');
bodyMat.setMetallicRoughnessTexture(roughTex).setRoughnessFactor(1).setMetallicFactor(0);

// ---------------------------------------------------------------- cleanup & compression
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (mesh && DROP.includes(mesh.getName())) node.dispose();
}
for (const mesh of root.listMeshes()) {
  mesh.setWeights([]);
  for (const prim of mesh.listPrimitives()) for (const t of prim.listTargets()) t.dispose();
}
for (const anim of root.listAnimations()) anim.dispose();
await doc.transform(prune(), dedup(), weld());
const brows = root.listMeshes().find((m) => m.getName() === 'mind_eyebrows_02');
for (const prim of brows?.listPrimitives() ?? []) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.3, error: 0.0004, lockBorder: true });
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 84, pattern: /lightskinned/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82, pattern: /^(?!.*lightskinned)/ }),
  prune(),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(OUT, doc);
console.log(`instructor.glb: ${(statSync(OUT).size / 1024).toFixed(0)} KB`);
