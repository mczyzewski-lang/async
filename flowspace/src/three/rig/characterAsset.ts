import * as THREE from 'three';
import { buildCharacterGeometry, setCharacterGeometryCache } from './buildCharacter';

/**
 * Compact binary format for the precomputed instructor geometry ("FSC1").
 * Generated at build time by scripts/build-character.ts from the same procedural code,
 * so phones do not have to run the surface generation at startup.
 */
const MAGIC = 0x31435346; // "FSC1"

export function encodeCharacter(g: THREE.BufferGeometry): ArrayBuffer {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const si = g.getAttribute('skinIndex') as THREE.BufferAttribute;
  const sw = g.getAttribute('skinWeight') as THREE.BufferAttribute;
  const cl = g.getAttribute('aCloth') as THREE.BufferAttribute;
  const hr = g.getAttribute('aHair') as THREE.BufferAttribute;
  const index = g.getIndex()!;
  const n = pos.count;
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const header = { n, indices: index.count, min: bb.min.toArray(), size: size.toArray() };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const hLen = Math.ceil(headerBytes.length / 4) * 4;
  const idx32 = n > 65535;
  const parts = [n * 6, n * 3, n * 4, n * 4, n, n, index.count * (idx32 ? 4 : 2)].map((b) => Math.ceil(b / 4) * 4);
  const buf = new ArrayBuffer(8 + hLen + parts.reduce((a, b) => a + b, 0));
  const dv = new DataView(buf);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, headerBytes.length, true);
  new Uint8Array(buf, 8, headerBytes.length).set(headerBytes);
  let o = 8 + hLen;
  const qp = new Uint16Array(buf, o, n * 3);
  for (let i = 0; i < n; i++)
    for (let k = 0; k < 3; k++) qp[i * 3 + k] = Math.round(((pos.getComponent(i, k) - header.min[k]) / (header.size[k] || 1)) * 65535);
  o += parts[0];
  const qn = new Int8Array(buf, o, n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) qn[i * 3 + k] = Math.round(THREE.MathUtils.clamp(nor.getComponent(i, k), -1, 1) * 127);
  o += parts[1];
  const qi = new Uint8Array(buf, o, n * 4);
  for (let i = 0; i < n * 4; i++) qi[i] = si.array[i];
  o += parts[2];
  const qw = new Uint8Array(buf, o, n * 4);
  for (let i = 0; i < n; i++) {
    const w = [0, 1, 2, 3].map((k) => Math.round(sw.getComponent(i, k) * 255));
    w[0] += 255 - (w[0] + w[1] + w[2] + w[3]); // keep the sum exact
    for (let k = 0; k < 4; k++) qw[i * 4 + k] = Math.max(0, w[k]);
  }
  o += parts[3];
  const qc = new Uint8Array(buf, o, n);
  for (let i = 0; i < n; i++) qc[i] = Math.round(cl.getX(i) * 255);
  o += parts[4];
  const qh = new Uint8Array(buf, o, n);
  for (let i = 0; i < n; i++) qh[i] = Math.round(hr.getX(i) * 255);
  o += parts[5];
  const ix = idx32 ? new Uint32Array(buf, o, index.count) : new Uint16Array(buf, o, index.count);
  ix.set(index.array as ArrayLike<number>);
  return buf;
}

export function decodeCharacter(buf: ArrayBuffer): THREE.BufferGeometry {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('Invalid character asset');
  const hl = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl))) as { n: number; indices: number; min: number[]; size: number[] };
  const n = header.n;
  const idx32 = n > 65535;
  const parts = [n * 6, n * 3, n * 4, n * 4, n, n, header.indices * (idx32 ? 4 : 2)].map((b) => Math.ceil(b / 4) * 4);
  let o = 8 + Math.ceil(hl / 4) * 4;
  const qp = new Uint16Array(buf, o, n * 3);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = header.min[i % 3] + (qp[i] / 65535) * header.size[i % 3];
  o += parts[0];
  const nor = new Int8Array(buf, o, n * 3);
  o += parts[1];
  const si = new Uint8Array(buf, o, n * 4);
  o += parts[2];
  const sw = new Uint8Array(buf, o, n * 4);
  o += parts[3];
  const cl = new Uint8Array(buf, o, n);
  o += parts[4];
  const hr = new Uint8Array(buf, o, n);
  o += parts[5];
  const ix = idx32 ? new Uint32Array(buf, o, header.indices) : new Uint16Array(buf, o, header.indices);
  const g = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  g.setAttribute('position', posAttr);
  g.setAttribute('aBind', new THREE.BufferAttribute(pos.slice(), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
  g.setAttribute('aCloth', new THREE.BufferAttribute(cl, 1, true));
  g.setAttribute('aHair', new THREE.BufferAttribute(hr, 1, true));
  g.setIndex(new THREE.BufferAttribute(ix, 1));
  g.computeBoundingSphere();
  return g;
}

let loading: Promise<void> | null = null;
let ready = false;

/** Loads the precomputed instructor; falls back to generating it if the asset is unavailable. */
export function preloadCharacter(): Promise<void> {
  if (!loading) {
    loading = fetch(`${import.meta.env.BASE_URL}models/instructor.bin`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then((b) => setCharacterGeometryCache(decodeCharacter(b)))
      .catch(() => {
        buildCharacterGeometry();
      })
      .finally(() => {
        ready = true;
      });
  }
  return loading;
}

export function isCharacterReady() {
  return ready;
}
