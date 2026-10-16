/**
 * Paints the instructor's yoga outfit (fitted sage tank top + charcoal 7/8 leggings) directly into
 * the skin texture. Every texel is rasterised from the body triangles in UV space, so the garment
 * edges are defined on the body itself (bind pose, metres) and stay crisp and skin-tight in any pose.
 * Also returns a roughness map (matte fabric, softer sheen on skin).
 */

export interface OutfitInput {
  rgba: Buffer;
  width: number;
  height: number;
  /** bind-pose positions (xyz per vertex, metres, A-pose, character faces +Z) */
  positions: number[];
  uvs: number[];
  indices: number[];
  /** 0..1 how much each vertex belongs to the arm (leaves arms bare) */
  armness: number[];
  /** 0..1 how much each vertex belongs to the head and neck */
  headness: number[];
}

const TOP = [124, 143, 118];
const TOP_TRIM = [104, 121, 99];
const LEGS = [52, 54, 60];
const LEGS_BAND = [44, 46, 51];

// Landmarks (source avatar, metres).
const WAIST = 1.035; // top of the high-waisted leggings
const BAND = 0.042; // waistband height
const HEM = 1.022; // tank top hem (overlaps the waistband)
const CUFF = 0.165; // 7/8 leggings end above the ankle

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const NECK_X = 0.07; // inner edge of the straps
const STRAP_X = 0.103; // outer edge of the straps
const ARMHOLE_Y = 1.345;
const neckline = (ax: number, front: boolean) => (front ? 1.33 + 0.06 * (ax / NECK_X) ** 2 : 1.37 + 0.03 * (ax / NECK_X) ** 2);

/** Signed distances (metres, positive inside) to the top and the leggings. */
function garment(x: number, y: number, z: number, arm: number, head: number) {
  const ax = Math.abs(x);
  const front = z > 0.02;
  const bare = Math.min((0.5 - arm) * 0.04, (0.3 - head) * 0.04);
  let ytop: number;
  let side = Infinity;
  if (ax < NECK_X) ytop = neckline(ax, front);
  else if (ax < STRAP_X) {
    ytop = 1.52;
    if (y > neckline(NECK_X, front)) side = Math.min(side, ax - NECK_X);
    if (y > ARMHOLE_Y) side = Math.min(side, STRAP_X - ax);
  } else ytop = ARMHOLE_Y - (ax - STRAP_X) * 3.2;
  const dTop = Math.min((ytop - y) / (ax >= STRAP_X ? 3.35 : 1), y - HEM, side, bare);
  const dLegs = Math.min(WAIST - y, y - CUFF, bare);
  return { dTop, dLegs };
}

export function paintOutfit(o: OutfitInput) {
  const { width: W, height: H } = o;
  const color = Buffer.from(o.rgba);
  const rough = Buffer.alloc(W * H * 4, 0);
  for (let i = 0; i < W * H; i++) {
    rough[i * 4] = 255;
    rough[i * 4 + 1] = 140; // skin roughness ≈ 0.55
    rough[i * 4 + 2] = 0;
    rough[i * 4 + 3] = 255;
  }
  const AA = 0.0018;

  const P = o.positions;
  const U = o.uvs;
  const covered = new Uint8Array(W * H);
  for (let t = 0; t < o.indices.length; t += 3) {
    const ids = [o.indices[t], o.indices[t + 1], o.indices[t + 2]];
    const px = ids.map((i) => U[i * 2] * W);
    const py = ids.map((i) => U[i * 2 + 1] * H);
    const minX = Math.max(0, Math.floor(Math.min(...px)) - 1);
    const maxX = Math.min(W - 1, Math.ceil(Math.max(...px)) + 1);
    const minY = Math.max(0, Math.floor(Math.min(...py)) - 1);
    const maxY = Math.min(H - 1, Math.ceil(Math.max(...py)) + 1);
    const det = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2]);
    if (Math.abs(det) < 1e-9) continue;
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const sx = xx + 0.5;
        const sy = yy + 0.5;
        let a = ((py[1] - py[2]) * (sx - px[2]) + (px[2] - px[1]) * (sy - py[2])) / det;
        let b = ((py[2] - py[0]) * (sx - px[2]) + (px[0] - px[2]) * (sy - py[2])) / det;
        let c = 1 - a - b;
        // small dilation so seams between UV islands get painted too
        const eps = -0.04;
        if (a < eps || b < eps || c < eps) continue;
        a = Math.max(0, a);
        b = Math.max(0, b);
        c = Math.max(0, c);
        const s = a + b + c;
        a /= s;
        b /= s;
        c /= s;
        const q = (k: number) => a * P[ids[0] * 3 + k] + b * P[ids[1] * 3 + k] + c * P[ids[2] * 3 + k];
        const arm = a * o.armness[ids[0]] + b * o.armness[ids[1]] + c * o.armness[ids[2]];
        const head = a * o.headness[ids[0]] + b * o.headness[ids[1]] + c * o.headness[ids[2]];
        if (c >= 0 && a >= 0 && b >= 0) covered[yy * W + xx] = 1;
        const y = q(1);
        const { dTop, dLegs } = garment(q(0), y, q(2), arm, head);
        const aTop = smooth(-AA, AA, dTop);
        const aLegs = smooth(-AA, AA, dLegs) * (1 - aTop);
        if (aTop + aLegs <= 0) continue;
        const topC = dTop < 0.005 ? TOP_TRIM : TOP;
        const legC = y > WAIST - BAND || y < CUFF + 0.016 ? LEGS_BAND : LEGS;
        // fine knit: subtle per-texel noise
        const n = 1 + (hash(xx, yy) - 0.5) * 0.045;
        const k = (yy * W + xx) * 4;
        const skin = 1 - aTop - aLegs;
        for (let ch = 0; ch < 3; ch++) color[k + ch] = Math.min(255, color[k + ch] * skin + (topC[ch] * aTop + legC[ch] * aLegs) * n);
        rough[k + 1] = 140 * skin + 222 * (aTop + aLegs); // matte fabric ≈ 0.87
      }
    }
  }
  // Pad UV islands: texels outside every triangle take the average of covered neighbours, so
  // texture filtering and mipmaps never pull unrelated colours across seams.
  for (let it = 0; it < 6; it++) {
    const next: number[] = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (covered[i]) continue;
        let n = 0;
        const sum = [0, 0, 0, 0];
        for (const d of [-1, 1, -W, W]) {
          if (!covered[i + d]) continue;
          n++;
          for (let k = 0; k < 3; k++) sum[k] += color[(i + d) * 4 + k];
          sum[3] += rough[(i + d) * 4 + 1];
        }
        if (!n) continue;
        for (let k = 0; k < 3; k++) color[i * 4 + k] = sum[k] / n;
        rough[i * 4 + 1] = sum[3] / n;
        next.push(i);
      }
    next.forEach((i) => (covered[i] = 1));
  }
  return { color, rough };
}
