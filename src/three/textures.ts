/**
 * Procedural textures (canvas based) — wood grain, oak floor planks, brushed steel,
 * perforated sheet and expanded-metal alpha maps. No external assets required.
 */
import * as THREE from 'three';
import { woodById } from '../engine/catalog';
import type { WoodId } from '../engine/types';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hexToRgb(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function shade(hex: string, k: number, alpha = 1) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgba(${f(r)},${f(g)},${f(b)},${alpha})`;
}

/** World size represented by one tile of the wood texture (metres) */
export const WOOD_TILE = { u: 2.0, v: 0.5 };

/** Draw glued-laminated wood with long grain along x */
function drawWood(ctx: CanvasRenderingContext2D, W: number, H: number, id: WoodId, seed: number, lamellas = true) {
  const p = woodById(id);
  const r = rng(seed);
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, W, H);
  // lamellas
  let y = 0;
  while (y < H) {
    const lh = lamellas ? 48 + r() * 46 : H;
    const tone = 0.9 + r() * 0.18;
    ctx.fillStyle = shade(p.base, tone, 0.75);
    ctx.fillRect(0, y, W, lh);
    // grain lines inside lamella
    const lines = 10 + Math.floor(r() * 16);
    for (let i = 0; i < lines; i++) {
      const y0 = y + r() * lh;
      const amp = 0.6 + r() * 3.5;
      const freq = (0.6 + r() * 2.2) / W * Math.PI * 2;
      const ph = r() * Math.PI * 2;
      const dark = r() < 0.3;
      ctx.strokeStyle = shade(dark ? p.dark : p.grain, 0.92 + r() * 0.16, (0.12 + r() * 0.35) * p.contrast + 0.05);
      ctx.lineWidth = 0.5 + r() * (dark ? 2.6 : 1.6);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const yy = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.7 + ph * 2) * amp * 0.25;
        if (yy < y || yy > y + lh) {
          ctx.moveTo(x, Math.min(Math.max(yy, y), y + lh));
          continue;
        }
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // occasional cathedral figure
    if (r() < 0.45) {
      const cx = r() * W;
      const cy = y + lh * (0.3 + r() * 0.4);
      const rings = 4 + Math.floor(r() * 5);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, W, lh);
      ctx.clip();
      for (let k = 0; k < rings; k++) {
        ctx.strokeStyle = shade(p.grain, 0.95, 0.12 * p.contrast + 0.06);
        ctx.lineWidth = 0.8 + r();
        ctx.beginPath();
        const len = 160 + k * 60 + r() * 60;
        const hh = 4 + k * 3.2;
        ctx.ellipse(cx, cy, len, hh, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    // pores & rays
    const pores = Math.floor(W * lh * 0.0016);
    for (let i = 0; i < pores; i++) {
      ctx.fillStyle = shade(p.dark, 1, 0.12 + r() * 0.12);
      ctx.fillRect(r() * W, y + r() * lh, 3 + r() * 9, 0.8);
    }
    if (id.startsWith('oak')) {
      for (let i = 0; i < pores * 0.08; i++) {
        ctx.fillStyle = shade(p.base, 1.18, 0.18);
        ctx.fillRect(r() * W, y + r() * lh, 6 + r() * 18, 1.2 + r() * 1.5);
      }
    }
    if (lamellas) {
      ctx.fillStyle = shade(p.dark, 1, 0.18);
      ctx.fillRect(0, y + lh - 1, W, 1);
    }
    y += lh;
  }
}

const woodCache = new Map<WoodId, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture; url: string }>();

export function getWoodTextures(id: WoodId) {
  const hit = woodCache.get(id);
  if (hit) return hit;
  const W = 2048;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  drawWood(ctx, W, H, id, 1234 + id.length * 77);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  // bump: grayscale of the colour texture
  const b = document.createElement('canvas');
  b.width = W / 2;
  b.height = H / 2;
  const bctx = b.getContext('2d')!;
  bctx.filter = 'grayscale(1) contrast(1.6)';
  bctx.drawImage(c, 0, 0, b.width, b.height);
  const bump = new THREE.CanvasTexture(b);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  // swatch for UI
  const s = document.createElement('canvas');
  s.width = 160;
  s.height = 160;
  s.getContext('2d')!.drawImage(c, 300, 40, 640, 400, 0, 0, 160, 160);
  const url = s.toDataURL('image/jpeg', 0.85);
  const entry = { map, bump, url };
  woodCache.set(id, entry);
  return entry;
}

/** Oak floor planks: one tile = 4 x 4 m */
export const FLOOR_TILE = 4;
let floorTex: THREE.CanvasTexture | null = null;
export function getFloorTexture() {
  if (floorTex) return floorTex;
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  const plankW = S / 20; // 20 cm planks
  const r = rng(99);
  const tmp = document.createElement('canvas');
  tmp.width = 1024;
  tmp.height = 128;
  const tctx = tmp.getContext('2d')!;
  for (let col = 0; col < 20; col++) {
    let x = -r() * S * 0.5;
    while (x < S) {
      const len = S * (0.35 + r() * 0.25);
      drawWood(tctx, 1024, 128, 'oak-white', Math.floor(r() * 1e6), false);
      ctx.save();
      ctx.translate(col * plankW + plankW, x);
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 1;
      ctx.drawImage(tmp, 0, 0, 1024, 128, 0, 0, len, plankW);
      ctx.fillStyle = `rgba(255,240,220,${0.05 + r() * 0.08})`;
      ctx.fillRect(0, 0, len, plankW);
      ctx.restore();
      ctx.fillStyle = 'rgba(80,60,40,0.35)';
      ctx.fillRect(col * plankW, x, plankW, 2);
      x += len;
    }
    ctx.fillStyle = 'rgba(80,60,40,0.3)';
    ctx.fillRect(col * plankW, 0, 1.5, S);
  }
  // warm it slightly towards natural oak
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#f3e3cc';
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
  floorTex = new THREE.CanvasTexture(c);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.anisotropy = 8;
  return floorTex;
}

let brushed: THREE.CanvasTexture | null = null;
export function getBrushedTexture() {
  if (brushed) return brushed;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(150,150,150)';
  ctx.fillRect(0, 0, 512, 512);
  const r = rng(7);
  for (let i = 0; i < 2600; i++) {
    const v = 100 + Math.floor(r() * 120);
    ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    ctx.fillRect(r() * 512, r() * 512, 40 + r() * 300, 1);
  }
  brushed = new THREE.CanvasTexture(c);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(2, 2);
  return brushed;
}

/** Perforated sheet: one tile = PERF_TILE metres */
export const PERF_TILE = 0.08;
let perf: THREE.CanvasTexture | null = null;
export function getPerforationAlpha() {
  if (perf) return perf;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#000';
  const step = S / 4;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0);
      const y = row * step;
      ctx.beginPath();
      ctx.arc(x, y, step * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  perf = new THREE.CanvasTexture(c);
  perf.wrapS = perf.wrapT = THREE.RepeatWrapping;
  perf.anisotropy = 8;
  return perf;
}

/** Expanded metal mesh: diamond lattice. One tile = MESH_TILE metres */
export const MESH_TILE = 0.05;
let mesh: THREE.CanvasTexture | null = null;
export function getMeshAlpha() {
  if (mesh) return mesh;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 9;
  ctx.beginPath();
  // two diamonds per tile vertically (elongated horizontally)
  for (const [ox, oy] of [
    [0, 0],
    [S / 2, S / 2],
    [-S / 2, S / 2],
    [S / 2, -S / 2],
    [-S / 2, -S / 2],
    [S, 0],
    [0, S],
    [S, S],
  ]) {
    ctx.moveTo(ox, oy + S / 2);
    ctx.lineTo(ox + S / 2, oy);
    ctx.lineTo(ox + S, oy + S / 2);
    ctx.lineTo(ox + S / 2, oy + S);
    ctx.closePath();
  }
  ctx.stroke();
  mesh = new THREE.CanvasTexture(c);
  mesh.wrapS = mesh.wrapT = THREE.RepeatWrapping;
  mesh.anisotropy = 8;
  return mesh;
}

/** Plaster wall subtle noise */
let plaster: THREE.CanvasTexture | null = null;
export function getPlasterTexture() {
  if (plaster) return plaster;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  const r = rng(3);
  for (let i = 0; i < 4000; i++) {
    const v = 110 + Math.floor(r() * 40);
    ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3);
  }
  plaster = new THREE.CanvasTexture(c);
  plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping;
  plaster.repeat.set(6, 6);
  return plaster;
}
