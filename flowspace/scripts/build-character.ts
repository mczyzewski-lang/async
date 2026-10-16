/**
 * Precomputes the procedural instructor mesh and writes it as a compact binary asset,
 * so devices only decode it instead of running the surface generation at startup.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildCharacterGeometry } from '../src/three/rig/buildCharacter';
import { encodeCharacter } from '../src/three/rig/characterAsset';

const out = resolve(import.meta.dirname, '../public/models/instructor.bin');
const t = performance.now();
const g = buildCharacterGeometry();
const buf = encodeCharacter(g);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, new Uint8Array(buf));
console.log(
  `instructor.bin: ${g.getAttribute('position').count} vertices, ${g.getIndex()!.count / 3} triangles, ` +
    `${(buf.byteLength / 1024).toFixed(0)} KB, ${Math.round(performance.now() - t)} ms`,
);
