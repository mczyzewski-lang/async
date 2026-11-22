/**
 * Real 2D potential flow around a Joukowski airfoil (Kutta condition applied).
 * This is textbook inviscid aerodynamics, so the streamlines, the faster flow over
 * the top and the downward-turned wake are computed, not drawn by hand.
 *
 * Frame: freestream moves +x at speed 1, chord ~= 1, wing is pitched nose-up by alpha.
 * Simplification (declared in the episode data): 2D, inviscid, incompressible.
 */

const C = 0.25;

export interface FlowParams {
  alphaDeg: number;
  camber?: number;
  thickness?: number;
}

export interface Streamline {
  /** x,y pairs sampled at uniform time steps of `dt`. */
  pts: Float32Array;
  /** local speed at each sample (freestream = 1) */
  speed: Float32Array;
  n: number;
  y0: number;
  /** passes above (1) or below (-1) the wing */
  side: 1 | -1;
}

export interface FlowField {
  alpha: number;
  outline: [number, number][];
  lines: Streamline[];
  dt: number;
  xMin: number;
  xMax: number;
  /** velocity (u,v) at a point; returns false inside the wing */
  velocity: (x: number, y: number, out: [number, number]) => boolean;
  /** pressure coefficient Cp = 1 - |V|^2 ; NaN inside the wing */
  cp: (x: number, y: number) => number;
}

/** Airfoil outline in its own frame (chord along x, leading edge at -x). */
export function airfoilOutline(n = 120, camber = 0.08, thickness = 0.08): [number, number][] {
  const mx = -thickness * C;
  const my = camber * C;
  const R = Math.hypot(C - mx, my);
  const beta = Math.asin(my / R);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const th = -beta + (i / n) * Math.PI * 2;
    const zx = mx + R * Math.cos(th);
    const zy = my + R * Math.sin(th);
    const d = zx * zx + zy * zy;
    pts.push([zx + (C * C * zx) / d, zy - (C * C * zy) / d]);
  }
  return pts;
}

export function buildFlow({ alphaDeg, camber = 0.08, thickness = 0.08 }: FlowParams, opts?: { lines?: number; spread?: number }): FlowField {
  const alpha = (alphaDeg * Math.PI) / 180;
  const mx = -thickness * C;
  const my = camber * C;
  const R = Math.hypot(C - mx, my);
  const beta = Math.asin(my / R);
  const gamma = 4 * Math.PI * R * Math.sin(alpha + beta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  const xMin = -2.4;
  const xMax = 3.4;

  // velocity in the zeta plane -> returns d(zeta)/dt and physical velocity
  const tmp = { zx: 0, zy: 0, u: 0, v: 0 };
  const step = (zx: number, zy: number) => {
    const px = zx - mx;
    const py = zy - my;
    const r2 = px * px + py * py;
    // 1/p and 1/p^2
    const ix = px / r2;
    const iy = -py / r2;
    const i2x = ix * ix - iy * iy;
    const i2y = 2 * ix * iy;
    // W = e^{-ia} - R^2 e^{ia} / p^2 + i*gamma/(2pi p)
    const g = gamma / (2 * Math.PI);
    const wx = ca - R * R * (ca * i2x - sa * i2y) - g * iy;
    const wy = -sa - R * R * (ca * i2y + sa * i2x) + g * ix;
    // dz/dzeta = 1 - c^2/zeta^2
    const z2 = zx * zx + zy * zy;
    const jx = zx / z2;
    const jy = -zy / z2;
    const dx = 1 - C * C * (jx * jx - jy * jy);
    const dy = -C * C * (2 * jx * jy);
    const dd = dx * dx + dy * dy;
    // Wz = W / D ; physical velocity = conj(Wz)
    const wzx = (wx * dx + wy * dy) / dd;
    const wzy = (wy * dx - wx * dy) / dd;
    tmp.u = wzx;
    tmp.v = -wzy;
    // dzeta/dt = conj(Wz) / D
    tmp.zx = (tmp.u * dx + tmp.v * dy) / dd;
    tmp.zy = (tmp.v * dx - tmp.u * dy) / dd;
  };
  const toZ = (zx: number, zy: number): [number, number] => {
    const d = zx * zx + zy * zy;
    const x = zx + (C * C * zx) / d;
    const y = zy - (C * C * zy) / d;
    return [x * ca + y * sa, -x * sa + y * ca]; // rotate by -alpha
  };
  // inverse map: physical (rotated) point -> zeta outside the circle
  const toZeta = (xr: number, yr: number): [number, number, boolean] => {
    const x = xr * ca - yr * sa;
    const y = xr * sa + yr * ca;
    // sqrt(z^2 - 4c^2)
    const ax = x * x - y * y - 4 * C * C;
    const ay = 2 * x * y;
    const m = Math.hypot(ax, ay);
    let sx = Math.sqrt((m + ax) / 2);
    let sy = Math.sqrt(Math.max(0, (m - ax) / 2));
    if (ay < 0) sy = -sy;
    const a1x = (x + sx) / 2, a1y = (y + sy) / 2;
    const a2x = (x - sx) / 2, a2y = (y - sy) / 2;
    const d1 = Math.hypot(a1x - mx, a1y - my);
    const d2 = Math.hypot(a2x - mx, a2y - my);
    return d1 >= d2 ? [a1x, a1y, d1 >= R] : [a2x, a2y, d2 >= R];
  };

  const velocity = (x: number, y: number, out: [number, number]) => {
    const [zx, zy, ok] = toZeta(x, y);
    if (!ok) return false;
    step(zx, zy);
    // rotate velocity by -alpha
    out[0] = tmp.u * ca + tmp.v * sa;
    out[1] = -tmp.u * sa + tmp.v * ca;
    return true;
  };
  const v2: [number, number] = [0, 0];
  const cp = (x: number, y: number) => (velocity(x, y, v2) ? 1 - (v2[0] * v2[0] + v2[1] * v2[1]) : NaN);

  const outline = airfoilOutline(140, camber, thickness).map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca] as [number, number]);

  const nLines = opts?.lines ?? 30;
  const spread = opts?.spread ?? 1.15;
  const h = 0.004;
  const keep = 3;
  const dt = h * keep;
  const lines: Streamline[] = [];
  for (let i = 0; i < nLines; i++) {
    // denser near the wing
    const f = (i + 0.5) / nLines - 0.5;
    const y0 = Math.sign(f) * Math.pow(Math.abs(f) * 2, 1.35) * spread - 0.16;
    let [zx, zy] = toZeta(xMin, y0);
    const xs: number[] = [];
    const sp: number[] = [];
    let minDy = 1e9;
    let side: 1 | -1 = 1;
    for (let k = 0; k < 6000; k++) {
      step(zx, zy);
      const k1x = tmp.zx, k1y = tmp.zy;
      const speed = Math.hypot(tmp.u, tmp.v);
      if (k % keep === 0) {
        const [x, y] = toZ(zx, zy);
        xs.push(x, y);
        sp.push(speed);
        if (Math.abs(x) < minDy) {
          minDy = Math.abs(x);
          side = y > 0 ? 1 : -1;
        }
        if (x > xMax) break;
      }
      step(zx + k1x * h * 0.5, zy + k1y * h * 0.5);
      zx += tmp.zx * h;
      zy += tmp.zy * h;
    }
    lines.push({ pts: new Float32Array(xs), speed: new Float32Array(sp), n: sp.length, y0, side });
  }
  return { alpha, outline, lines, dt, xMin, xMax, velocity, cp };
}

/** Position on a streamline at flow-time tau (seconds of flow, freestream = 1 chord/s). */
export function sampleLine(line: Streamline, dt: number, tau: number, out: { x: number; y: number; speed: number }) {
  const f = Math.min(line.n - 1.001, Math.max(0, tau / dt));
  const i = Math.floor(f);
  const p = f - i;
  out.x = line.pts[i * 2] * (1 - p) + line.pts[i * 2 + 2] * p;
  out.y = line.pts[i * 2 + 1] * (1 - p) + line.pts[i * 2 + 3] * p;
  out.speed = line.speed[i] * (1 - p) + line.speed[i + 1] * p;
}

/** Pressure field as RGBA pixels (for a CanvasTexture). `color` maps Cp -> rgba. */
export function pressureImage(
  flow: FlowField,
  w: number,
  h: number,
  bounds: { x0: number; x1: number; y0: number; y1: number },
  color: (cp: number) => [number, number, number, number],
): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = bounds.x0 + ((i + 0.5) / w) * (bounds.x1 - bounds.x0);
      const y = bounds.y1 - ((j + 0.5) / h) * (bounds.y1 - bounds.y0);
      const cp = flow.cp(x, y);
      const o = (j * w + i) * 4;
      if (Number.isNaN(cp)) continue;
      const c = color(cp);
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = c[3];
    }
  ctx.putImageData(img, 0, 0);
  return cv;
}
