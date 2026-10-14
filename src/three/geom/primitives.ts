/**
 * Geometry primitives & a part collector that merges geometry per material key.
 * Pure three.js — no React, testable in Node.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MatKey } from '../materials';

const Y = new THREE.Vector3(0, 1, 0);

export class Parts {
  private groups = new Map<MatKey, THREE.BufferGeometry[]>();
  /** counters of logical members — used by tests and the quantities module */
  counts: Record<string, number> = {};

  add(key: MatKey, g: THREE.BufferGeometry, m?: THREE.Matrix4) {
    if (m) g.applyMatrix4(m);
    let ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    for (const name of Object.keys(ng.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') ng.deleteAttribute(name);
    }
    if (!ng.attributes.uv) {
      const n = ng.attributes.position.count;
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    if (!ng.attributes.normal) ng.computeVertexNormals();
    ng.clearGroups();
    const arr = this.groups.get(key) ?? [];
    arr.push(ng);
    this.groups.set(key, arr);
    ng = ng as THREE.BufferGeometry;
  }

  count(name: string, n = 1) {
    this.counts[name] = (this.counts[name] ?? 0) + n;
  }

  merge(): Partial<Record<MatKey, THREE.BufferGeometry>> {
    const out: Partial<Record<MatKey, THREE.BufferGeometry>> = {};
    for (const [k, list] of this.groups) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) {
        merged.computeBoundingSphere();
        out[k] = merged;
      }
    }
    return out;
  }

  keys() {
    return [...this.groups.keys()];
  }
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Axis aligned box (in the current local frame) centred at c */
export function box(w: number, h: number, d: number, cx: number, cy: number, cz: number) {
  const g = new THREE.BoxGeometry(Math.max(w, 1e-4), Math.max(h, 1e-4), Math.max(d, 1e-4));
  g.translate(cx, cy, cz);
  return g;
}

export function roundedBox(w: number, h: number, d: number, r: number, cx: number, cy: number, cz: number) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, h / 2 - 1e-4, d / 2 - 1e-4));
  g.translate(cx, cy, cz);
  return g;
}

/** Box-projected UVs in metres divided by tile size; grain (u) runs along local x */
export function boxUV(g: THREE.BufferGeometry, tileU: number, tileV: number, offU = 0, offV = 0) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u: number, v: number;
    if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else if (nz >= nx) {
      u = x;
      v = y;
    } else {
      u = z;
      v = y;
    }
    uv[i * 2] = u / tileU + offU;
    uv[i * 2 + 1] = v / tileV + offV;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Rectangular beam between two points; width is horizontal across, height perpendicular in the vertical plane */
export function beam(a: THREE.Vector3, b: THREE.Vector3, width: number, height: number) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  let X = new THREE.Vector3().crossVectors(Y, dir);
  if (X.lengthSq() < 1e-8) X = new THREE.Vector3(1, 0, 0);
  X.normalize();
  const Yb = new THREE.Vector3().crossVectors(dir, X).normalize();
  const g = new THREE.BoxGeometry(width, height, Math.max(len, 1e-4));
  const m = new THREE.Matrix4().makeBasis(X, Yb, dir);
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}

/** Cylinder between two points */
export function cyl(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 10) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, Math.max(len, 1e-4), seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize());
  g.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

export function sphere(p: THREE.Vector3, r: number) {
  const g = new THREE.SphereGeometry(r, 12, 8);
  g.translate(p.x, p.y, p.z);
  return g;
}

/**
 * Side-profile polygon in a flight frame: points are (z, y); extruded across x
 * with thickness t, centred on xCenter.
 */
export function profile(points: [number, number][], thickness: number, xCenter: number) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  const m = new THREE.Matrix4().makeBasis(v3(0, 0, 1), v3(0, 1, 0), v3(-1, 0, 0));
  m.setPosition(xCenter + thickness / 2, 0, 0);
  g.applyMatrix4(m);
  return g;
}

/**
 * Vertical panel between plan points a→b (shape X along the segment, Y up),
 * built from a 2D outline (u along segment, y absolute) and extruded across by thickness.
 */
export function panel(a: THREE.Vector3, b: THREE.Vector3, outline: [number, number][], thickness: number) {
  const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const across = new THREE.Vector3().crossVectors(d, Y).normalize();
  const shape = new THREE.Shape(outline.map(([u, y]) => new THREE.Vector2(u, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  const m = new THREE.Matrix4().makeBasis(d, Y, across);
  m.setPosition(a.x - across.x * thickness / 2, 0, a.z - across.z * thickness / 2);
  g.applyMatrix4(m);
  return g;
}

/** Thin double-sided quad panel with UVs in metres / tile */
export function quadPanel(a: THREE.Vector3, b: THREE.Vector3, outline: [number, number][], tile: number) {
  const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const pts = outline.map(([u, y]) => new THREE.Vector3(a.x + d.x * u, y, a.z + d.z * u));
  const pos: number[] = [];
  const uv: number[] = [];
  const tri = (i: number, j: number, k: number) => {
    for (const n of [i, j, k]) {
      pos.push(pts[n].x, pts[n].y, pts[n].z);
      uv.push(outline[n][0] / tile, outline[n][1] / tile);
    }
  };
  tri(0, 1, 2);
  tri(0, 2, 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Vertical member with faces aligned to plan direction d (X along d, Z across) */
export function orientedBox(along: number, height: number, across: number, base: THREE.Vector3, d: THREE.Vector3) {
  const dd = new THREE.Vector3(d.x, 0, d.z).normalize();
  const Z = new THREE.Vector3().crossVectors(dd, Y);
  const g = new THREE.BoxGeometry(along, height, across);
  const m = new THREE.Matrix4().makeBasis(dd, Y, Z);
  m.setPosition(base.x, base.y + height / 2, base.z);
  g.applyMatrix4(m);
  return g;
}

export function flightMatrix(x: number, y: number, z: number, yaw: number) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, yaw), new THREE.Vector3(1, 1, 1));
}
