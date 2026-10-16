import * as THREE from 'three';

/** Procedural canvas textures (no external image assets required). */

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function finish(c: HTMLCanvasElement, repeat: [number, number], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
}

/** Warm hardwood deck planks. */
export function woodDeckTexture(base = '#a5774f', repeat: [number, number] = [1, 1]) {
  return cached(`deck${base}${repeat}`, () => {
    const { c, ctx } = canvas(1024, 1024);
    const r = rng(7);
    const planks = 8;
    const ph = 1024 / planks;
    const col = new THREE.Color(base);
    for (let i = 0; i < planks; i++) {
      const tint = col.clone().offsetHSL((r() - 0.5) * 0.02, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08);
      ctx.fillStyle = `#${tint.getHexString()}`;
      ctx.fillRect(0, i * ph, 1024, ph);
      // grain
      for (let g = 0; g < 70; g++) {
        const y = i * ph + r() * ph;
        ctx.strokeStyle = `rgba(${r() < 0.5 ? '60,35,20' : '255,235,200'},${0.04 + r() * 0.07})`;
        ctx.lineWidth = 0.6 + r() * 1.6;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= 1024; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.01 + g) * (1 + r() * 3));
        ctx.stroke();
      }
      // knots
      if (r() < 0.6) {
        const kx = r() * 1024;
        const ky = i * ph + ph * (0.3 + r() * 0.4);
        const grd = ctx.createRadialGradient(kx, ky, 1, kx, ky, 14);
        grd.addColorStop(0, 'rgba(60,35,20,0.45)');
        grd.addColorStop(1, 'rgba(60,35,20,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 26, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // gaps & butt joints
      ctx.fillStyle = 'rgba(40,24,14,0.55)';
      ctx.fillRect(0, i * ph, 1024, 3);
      const jx = r() * 1024;
      ctx.fillRect(jx, i * ph, 3, ph);
    }
    return finish(c, repeat);
  });
}

/** Woven cotton yoga mat. */
export function matTexture(color: string) {
  return cached(`mat${color}`, () => {
    const { c, ctx } = canvas(256, 512);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 512);
    const r = rng(3);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.05})`;
      ctx.fillRect(r() * 256, r() * 512, 1.5, 1.5);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 240, 496);
    return finish(c, [1, 1]);
  });
}

/** Raked zen gravel with concentric and parallel lines. */
export function gravelTexture() {
  return cached('gravel', () => {
    const { c, ctx } = canvas(1024, 1024);
    ctx.fillStyle = '#d9d1c2';
    ctx.fillRect(0, 0, 1024, 1024);
    const r = rng(11);
    for (let i = 0; i < 40000; i++) {
      const v = 150 + r() * 90;
      ctx.fillStyle = `rgba(${v},${v - 6},${v - 18},${0.35 + r() * 0.4})`;
      ctx.fillRect(r() * 1024, r() * 1024, 1 + r() * 2, 1 + r() * 2);
    }
    for (let y = 0; y < 1024; y += 16) {
      ctx.strokeStyle = 'rgba(120,108,90,0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,240,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 4);
      ctx.lineTo(1024, y + 4);
      ctx.stroke();
    }
    return finish(c, [90, 90]);
  });
}

/** Soft noisy ground (grass / moss / rock). */
export function groundTexture(base: string, accent: string, seed = 5) {
  return cached(`ground${base}${accent}`, () => {
    const { c, ctx } = canvas(512, 512);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    const r = rng(seed);
    for (let i = 0; i < 260; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const rad = 10 + r() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const a = new THREE.Color(accent);
      g.addColorStop(0, `rgba(${(a.r * 255) | 0},${(a.g * 255) | 0},${(a.b * 255) | 0},${0.12 + r() * 0.18})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 16000; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,240'},${r() * 0.06})`;
      ctx.fillRect(r() * 512, r() * 512, 2, 2);
    }
    return finish(c, [60, 60]);
  });
}

/** Radial soft blob used for contact shadows and glows. */
export function radialTexture(inner = 'rgba(0,0,0,0.5)', outer = 'rgba(0,0,0,0)') {
  return cached(`radial${inner}${outer}`, () => {
    const { c, ctx } = canvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
