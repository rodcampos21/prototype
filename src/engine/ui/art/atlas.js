/**
 * The atlas's art (AtlasScreen.js): a cartographer's sheet painted pixel by pixel — the parchment
 * (mottled in three tones with an ordered dither, a torn and scorched edge, two fold creases, an old
 * cup ring), the sketch of the land in ink (the sea washed and scalloped with waves, the shore with
 * its ripple lines, the stream swelling toward its mouth, the dashed road, little trees, hills and
 * reeds inside their outlines, a wrecked boat, the Baiacu Rei drawn in the sea), the compass rose,
 * and the small pieces laid over it: a place's mark in each state, the selection ring and the route.
 *
 * Every sheet is deterministic (seeded noise: a sketch paints the same pixels each time) and painted
 * at one canvas pixel per art pixel. Colours are the parchment's own, not the UI palette's navy and
 * gold: the map is a thing in the world, laid on the window.
 */
import { pixelCanvas } from './painter.js';

/** @import { PixelPainter } from './painter.js' */

/** The parchment's inks and tones. */
export const INK = Object.freeze({
  paper0: '#f1e4bf', paper1: '#e3d09f', paper2: '#d2b980', burn: '#a27a46', scorch: '#6c4b27',
  ink: '#3a2814', faded: '#7d6443', sea: '#35566c', seaWash: '#9cb2ad', road: '#6e4b29',
  forest: '#3d4b25', leaf: '#b6bf86', hill: '#5b4630', reed: '#47603a', red: '#a8322a', redHi: '#d4584a',
  gold: '#c99a3e', goldHi: '#efd27e', label: '#3f2c17',
});

/** [r, g, b] of a #rrggbb colour. @param {string} hex */
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** A 32-bit hash of two integers and a seed, in [0, 1). */
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
function noise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

/** Two octaves of value noise. */
const fbm = (x, y, seed) => noise(x, y, seed) * 0.65 + noise(x * 2.1, y * 2.1, seed + 7) * 0.35;

/** The 4 × 4 Bayer matrix, in [0, 1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

/** Is (x, y) inside the polygon? (even–odd) @param {number[][]} poly */
function inPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The bounding box of points [minX, minY, maxX, maxY]. @param {number[][]} pts */
function bounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}

/**
 * A raster to paint on: alpha-blended pixels on RGBA bytes.
 */
class Sheet {
  /** @param {number} w @param {number} h */
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }

  /** Blend colour `c` ([r, g, b]) at (x, y) with opacity a (0–1). */
  put(x, y, c, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const d = this.d;
    // (only on the parchment: what the torn edge took stays empty)
    if (d[i + 3] === 0) return;
    d[i] += (c[0] - d[i]) * a;
    d[i + 1] += (c[1] - d[i + 1]) * a;
    d[i + 2] += (c[2] - d[i + 2]) * a;
  }

  /** A Bresenham line. */
  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.put(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Palette rows at (x, y) ('.' transparent). @param {string[]} rows @param {Record<string, [number[], number]>} pal char → [colour, alpha] */
  rows(x, y, rows, pal) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const p = pal[row[i]];
        if (p) this.put(x + i, y + j, p[0], p[1]);
      }
    });
  }

  /** The sheet on a canvas. */
  canvas() {
    return pixelCanvas(this.w, this.h, (p) => {
      p.ctx.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    });
  }
}

/**
 * Points along a polyline every `step` px, with the running length and the unit normal there.
 * @param {number[][]} pts px
 * @param {number} step
 * @returns {{ x: number, y: number, s: number, nx: number, ny: number, t: number }[]}
 */
function walk(pts, step = 0.5) {
  const out = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (!len) continue;
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let u = 0; u < len; u += step) {
      out.push({ x: ax + ((bx - ax) * u) / len, y: ay + ((by - ay) * u) / len, s: s + u, nx, ny, t: total ? (s + u) / total : 0 });
    }
    s += len;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// The glyphs drawn on the land (palette rows: o outline, f fill, s shade)
// ------------------------------------------------------------------------------------------------

const TREE = ['.ooo.', 'offso', 'offso', '.oso.', '..o..', '.ooo.'];
const PINE = ['..o..', '.ofo.', '.ofo.', 'offso', 'ooooo', '..o..'];
const REEDS = ['.o..o', '.o.o.', 'oo.o.', '.o.oo', '.o.o.'];
const WAVE = ['.oo.oo.', 'o..o..o'];
/** The wrecked boat on the beach, a red cross over it (r). */
const WRECK = [
  '....o.....',
  '...oo..r.r',
  '..o.o...r.',
  '.o..o..r.r',
  'oooooooo..',
  '.offfffo..',
  '..oooooo..',
];
/** The Baiacu Rei, puffed up, its spikes in gold (g), an eye (e). */
const FISH = [
  '......g..g..g......',
  '...g..ooooooo..g...',
  '.....o.......o.....',
  '..go..f.f.f.f..og..',
  '...o.f.f.f.f.f.o..o',
  'g.o..e..........o.oo',
  '..o..oo.f.f.f.f.oooo',
  'g.o.............o.oo',
  '...o.f.f.f.f.f.o..o',
  '..go..f.f.f.f..og..',
  '.....o.......o.....',
  '...g..ooooooo..g...',
  '......g..g..g......',
];

/**
 * The sheet of a sketch: the parchment and every feature in ink, `w` × `h` art px.
 * @param {import('../types.js').AtlasSheetSpec} spec
 * @returns {HTMLCanvasElement}
 */
export function atlasSheet(spec) {
  const { w, h, size, sketch } = spec;
  const seed = spec.seed ?? 7;
  const sh = new Sheet(w, h);
  const kx = w / size[0], ky = h / size[1];
  /** map units → px @param {number[]} p */
  const P = (p) => [p[0] * kx, p[1] * ky];
  const C = Object.fromEntries(Object.entries(INK).map(([k, v]) => [k, rgb(v)]));
  const tones = [C.paper0, C.paper1, C.paper2];
  const d = sh.d;
  // ---- the parchment: three tones dithered by mottled noise; the torn, scorched edge; creases ----
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const tear = fbm(x / 5, y / 5, seed + 11) * 4.2 + fbm(x / 23, y / 23, seed + 3) * 3;
      const i = (y * w + x) * 4;
      if (edge + 1.4 < tear) continue;
      const n = fbm(x / 34, y / 30, seed) * 0.7 + fbm(x / 7, y / 7, seed + 5) * 0.3;
      const k = Math.min(2, Math.max(0, Math.floor(n * 3.3 - 0.75 + bayer(x, y))));
      const c = tones[k];
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      // the scorch: darker toward the torn edge, dithered in two steps
      const burn = 1 - (edge - tear + 1.4) / 9;
      if (burn > 0) {
        const b = burn > bayer(x + 1, y) ? (burn > 0.72 + bayer(x, y) * 0.25 ? C.scorch : C.burn) : null;
        if (b) { d[i] = b[0]; d[i + 1] = b[1]; d[i + 2] = b[2]; }
      }
    }
  }
  // the folds: a crease down the middle and one across, a dark side and a lit side
  const fx = Math.round(w / 2), fy = Math.round(h / 2);
  for (let y = 0; y < h; y++) { sh.put(fx, y, C.burn, 0.32 + 0.12 * noise(y / 6, 1, seed)); sh.put(fx + 1, y, C.paper0, 0.5); }
  for (let x = 0; x < w; x++) { sh.put(x, fy, C.burn, 0.26 + 0.12 * noise(x / 6, 2, seed)); sh.put(x, fy + 1, C.paper0, 0.45); }
  // an old cup ring (top right) and a smaller blot of ink (bottom left)
  ring(sh, w * 0.83, h * 0.2, Math.round(Math.min(w, h) * 0.075), C.burn, seed);
  for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j * 2 < 9 - hash(i, j, seed) * 4) sh.put(w * 0.12 + i, h * 0.86 + j, C.ink, 0.22);

  // ---- the land ----
  const seas = sketch.filter((f) => f.kind === 'sea').map((f) => f.points.map(P));
  const inSea = (x, y) => seas.some((poly) => inPoly(poly, x, y));
  for (const f of sketch) {
    if (f.kind === 'sea') sea(sh, f.points.map(P), C, seed);
  }
  for (const f of sketch) {
    if (f.kind === 'forest') area(sh, f.points.map(P), C, seed, 'forest');
    else if (f.kind === 'hills') area(sh, f.points.map(P), C, seed, 'hills');
    else if (f.kind === 'reeds') area(sh, f.points.map(P), C, seed, 'reeds');
  }
  for (const f of sketch) {
    if (f.kind === 'coast') coast(sh, f.points.map(P), C, inSea);
    else if (f.kind === 'river') river(sh, f.points.map(P), C);
    else if (f.kind === 'road') road(sh, f.points.map(P), C);
  }
  for (const f of sketch) {
    if (!f.at) continue;
    const [x, y] = P(f.at);
    if (f.kind === 'wreck') sh.rows(Math.round(x - 5), Math.round(y - 4), WRECK, { o: [C.ink, 0.85], f: [C.burn, 0.6], r: [C.red, 0.95] });
    else if (f.kind === 'fish') sh.rows(Math.round(x - 10), Math.round(y - 6), FISH, { o: [C.sea, 0.9], f: [C.sea, 0.55], e: [C.ink, 1], g: [C.gold, 0.95] });
  }
  compass(sh, w - 24, h - 26, C);
  return sh.canvas();
}

/** A faint ring (a cup set down on the sheet once). */
function ring(sh, cx, cy, r, c, seed) {
  for (let y = -r - 2; y <= r + 2; y++) {
    for (let x = -r - 2; x <= r + 2; x++) {
      const dd = Math.hypot(x, y);
      const gap = noise(Math.atan2(y, x) * 2, 3, seed) < 0.28;
      if (Math.abs(dd - r) < 0.9 && !gap) sh.put(cx + x, cy + y, c, 0.3);
      else if (dd < r - 1) sh.put(cx + x, cy + y, c, 0.05);
    }
  }
}

/** The sea: a dithered wash, the waves in rows away from the shore. */
function sea(sh, poly, C, seed) {
  const [x0, y0, x1, y1] = bounds(poly).map(Math.round);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inPoly(poly, x + 0.5, y + 0.5)) continue;
      sh.put(x, y, C.seaWash, 0.34 + (bayer(x, y) > 0.5 ? 0.08 : 0));
    }
  }
  /** far enough from the shore for a wave: the glyph and a margin all inside */
  const clear = (x, y) => [[-3, -3], [9, -3], [-3, 5], [9, 5]].every(([a, b]) => inPoly(poly, x + a, y + b));
  for (let y = y0 + 4, row = 0; y < y1 - 2; y += 9, row++) {
    for (let x = x0 + 3 + (row % 2) * 7; x < x1 - 6; x += 14) {
      const jx = Math.round(hash(x, y, seed) * 3 - 1), jy = Math.round(hash(y, x, seed) * 2 - 1);
      if (clear(x + jx, y + jy)) sh.rows(x + jx, y + jy, WAVE, { o: [C.sea, 0.62] });
    }
  }
}

/** Glyphs inside an outline (trees, hills, reeds), the outline drawn faint and broken. */
function area(sh, poly, C, seed, kind) {
  const [x0, y0, x1, y1] = bounds(poly);
  // the outline: a light, broken ink line
  const pts = walk([...poly, poly[0]], 1);
  for (const q of pts) if (hash(Math.round(q.s), 1, seed) > 0.35) sh.put(q.x, q.y, kind === 'forest' ? C.forest : kind === 'reeds' ? C.reed : C.hill, 0.35);
  if (kind === 'forest') {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inPoly(poly, x, y) && (x + y) % 2 === 0) sh.put(x, y, C.leaf, 0.22);
  }
  const [sx, sy] = kind === 'hills' ? [13, 9] : kind === 'reeds' ? [8, 7] : [7, 6];
  for (let y = y0 + 1, row = 0; y < y1; y += sy, row++) {
    for (let x = x0 + 1 + (row % 2) * Math.floor(sx / 2); x < x1; x += sx) {
      const gx = Math.round(x + hash(x, y, seed + 2) * 2 - 1), gy = Math.round(y + hash(y, x, seed + 2) * 2 - 1);
      const [gw, gh] = kind === 'hills' ? [11, 6] : [5, 6];
      if (![[0, 0], [gw, 0], [0, gh], [gw, gh]].every(([a, b]) => inPoly(poly, gx + a, gy + b))) continue;
      if (kind === 'forest') {
        const pine = hash(gx, gy, seed + 9) < 0.4;
        sh.rows(gx, gy, pine ? PINE : TREE, { o: [C.forest, 0.92], f: [C.leaf, 0.85], s: [C.forest, 0.45] });
        sh.put(gx + 4, gy + 6, C.forest, 0.3);
      } else if (kind === 'reeds') {
        sh.rows(gx, gy, REEDS, { o: [C.reed, 0.85] });
      } else hill(sh, gx, gy, C);
    }
  }
}

/** A hill: two slopes up to a peak, hatched on the shaded (east) side. */
function hill(sh, x, y, C) {
  const px = x + 5, top = y;
  sh.line(x, y + 6, px, top, C.hill, 0.9);
  sh.line(px, top, x + 11, y + 6, C.hill, 0.9);
  for (let k = 1; k <= 3; k++) sh.line(px + k, top + 1 + k, px + k - 1, top + 3 + k, C.hill, 0.55);
}

/** The shore: the ink line, two dotted ripple lines on the sea side. */
function coast(sh, pts, C, inSea) {
  const path = walk(pts, 0.5);
  for (const q of path) sh.put(q.x, q.y, C.ink, 0.92);
  for (const q of path) {
    // (the ripples go toward the sea: the side the sea polygon is on)
    const side = inSea(q.x + q.nx * 4, q.y + q.ny * 4) ? 1 : inSea(q.x - q.nx * 4, q.y - q.ny * 4) ? -1 : 0;
    if (!side) continue;
    if (Math.round(q.s) % 2 === 0) sh.put(q.x + q.nx * 3 * side, q.y + q.ny * 3 * side, C.sea, 0.55);
    if (Math.round(q.s) % 4 === 0) sh.put(q.x + q.nx * 6 * side, q.y + q.ny * 6 * side, C.sea, 0.35);
  }
}

/** A stream: an ink line that winds a little and swells toward its last point. */
function river(sh, pts, C) {
  for (const q of walk(pts, 0.35)) {
    const wig = Math.sin(q.s / 4.5) * 0.9;
    const x = q.x + q.nx * wig, y = q.y + q.ny * wig;
    const r = 0.5 + q.t * 1.3;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= r * r + 0.2) sh.put(x + i, y + j, C.sea, 0.9);
  }
}

/** A road: short dashes, and footprints of dots between. */
function road(sh, pts, C) {
  for (const q of walk(pts, 0.5)) {
    const m = q.s % 7;
    if (m < 3.5) sh.put(q.x, q.y, C.road, 0.95);
    else if (Math.abs(m - 5.25) < 0.3) sh.put(q.x, q.y, C.road, 0.5);
  }
}

/** The compass rose: four points (the north in red), a dotted ring, an N above. */
function compass(sh, cx, cy, C) {
  for (let a = 0; a < 48; a++) {
    if (a % 2) continue;
    const t = (a / 48) * Math.PI * 2;
    sh.put(cx + Math.cos(t) * 7.5, cy + Math.sin(t) * 7.5, C.ink, 0.6);
  }
  // the arms: [dx, dy, length] — each a thin diamond, its left half inked, its right half light
  for (const [dx, dy, len] of [[0, -1, 11], [0, 1, 8], [1, 0, 8], [-1, 0, 8]]) {
    for (let s = 0; s <= len; s++) {
      const half = Math.max(0, Math.round(2.4 * (1 - s / len)));
      for (let o = -half; o <= half; o++) {
        const x = cx + dx * s + dy * o, y = cy + dy * s - dx * o;
        const north = dy === -1;
        const c = o < 0 ? (north ? C.red : C.ink) : o > 0 ? (north ? C.redHi : C.paper0) : C.ink;
        sh.put(x, y, c, o > 0 && !north ? 0.7 : 0.95);
      }
    }
  }
  sh.put(cx, cy, C.gold, 1);
  // N
  sh.rows(cx - 2, cy - 18, ['o...o', 'oo..o', 'o.o.o', 'o..oo', 'o...o'], { o: [C.ink, 0.95] });
}

// ------------------------------------------------------------------------------------------------
// The pieces over the sheet
// ------------------------------------------------------------------------------------------------

/** The icons, 11 × 11 (palette rows: o ink, f fill, r red, g gold, d dark). */
const ICONS = {
  camp: [
    '.....or....',
    '.....orr...',
    '.....or....',
    '.....o.....',
    '....ofo....',
    '...offfo...',
    '..offfffo..',
    '.offfdfffo.',
    'offffdffffo',
    'oooooooooooo',
    '...........',
  ],
  forest: [
    '...o.......',
    '..ofo..ooo.',
    '..ofo.offfo',
    '.offfoofffo',
    '.offfo.ofo.',
    'offfffo.o..',
    'ooooooo.o..',
    '...o...ooo.',
    '...o.......',
    '..ooo......',
    '...........',
  ],
  reeds: [
    '.d.....d...',
    '.o..d..o.d.',
    '.o..o.oo.o.',
    'oo..o..o.o.',
    '.o.oo..o.oo',
    '.o..o..o.o.',
    '.o..o..o.o.',
    'ffffffffff.',
    '.f.ff.ff.f.',
    'fff.fff.fff',
    '...........',
  ],
  quarry: [
    '......o....',
    '.....ofo...',
    '....offfo..',
    '...offdffo.',
    '..offfdfffo',
    '.offffffffo',
    'ooooooooooo',
    '.oo.....dd.',
    'offo...dffd',
    'ooooo..dddd',
    '...........',
  ],
  den: [
    '...ooooo...',
    '..offfffo..',
    '.offfffffo.',
    'offoddddffo',
    'ofoddddddfo',
    'ofoddddddfo',
    'ofoddddddfo',
    'ooodddddooo',
    '.....r.r...',
    '...........',
    '...........',
  ],
  ruin: [
    '...........',
    '.oo.....oo.',
    '.ff.....ff.',
    '.ff..o..ff.',
    '.ff.off.f..',
    '.ff..f..f..',
    '.ff..f.....',
    '.ff..f..oo.',
    'ooooooooooo',
    '...........',
    '...........',
  ],
};
/** A question mark, 5 × 7. */
const QUESTION = ['.ooo.', 'o...o', '....o', '...o.', '..o..', '.....', '..o..'];

/**
 * A place's mark, 19 × 19: a disc of clean parchment with the place's icon in ink inside a ring
 * (`known`), the same with a red wax seal (`explored`), the camp with its pennant in a double ring
 * (`home`), or a dashed pencil ring with a question mark (`rumor`).
 * @param {string} icon
 * @param {'rumor'|'known'|'explored'|'home'} state
 * @returns {HTMLCanvasElement}
 */
export function placeMark(icon, state) {
  return pixelCanvas(19, 19, (p) => {
    const cx = 9, cy = 9;
    const ink = state === 'rumor' ? INK.faded : INK.ink;
    // the disc and the ring
    for (let y = -8; y <= 8; y++) {
      for (let x = -8; x <= 8; x++) {
        const dd = Math.hypot(x, y);
        if (dd <= 6.6) p.px(cx + x, cy + y, state === 'rumor' ? 'rgba(241, 228, 191, 0.55)' : INK.paper0);
        if (Math.abs(dd - 7.2) < 0.6) {
          const ang = Math.round(((Math.atan2(y, x) + Math.PI) / (Math.PI * 2)) * 24);
          if (state !== 'rumor' || ang % 2 === 0) p.px(cx + x, cy + y, ink);
        }
        if (state === 'home' && Math.abs(dd - 8.6) < 0.5) p.px(cx + x, cy + y, INK.red);
      }
    }
    if (state === 'rumor') {
      p.rows(cx - 2, cy - 3, QUESTION, { o: INK.faded });
      return;
    }
    const rows = ICONS[icon] ?? ICONS.forest;
    p.rows(cx - 5, cy - 5, rows, { o: INK.ink, f: INK.leaf, r: INK.red, g: INK.gold, d: icon === 'den' ? INK.ink : INK.burn });
    if (icon === 'forest') p.rows(cx - 5, cy - 5, rows.map((r) => r.replace(/[^f]/g, '.')), { f: '#9aa86a' });
    if (state === 'explored') {
      // the seal: a red disc with a light rim and the King's spikes in gold
      const sx = cx + 5, sy = cy + 5;
      p.circle(sx, sy, 3, INK.red, true);
      p.px(sx - 1, sy - 2, INK.redHi);
      p.px(sx - 2, sy - 1, INK.redHi);
      p.px(sx, sy, INK.goldHi);
      for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) p.px(sx + dx, sy + dy, INK.gold);
    }
  });
}

/**
 * The selection ring, 27 × 27: the cartographer's red circle drawn round the place, two pixels
 * thick and broken at the four corners, with four ink ticks pointing in (red reads on the
 * parchment, where gilt would not).
 * @returns {HTMLCanvasElement}
 */
export function selectRing() {
  return pixelCanvas(27, 27, (p) => {
    const c = 13;
    for (let y = -13; y <= 13; y++) {
      for (let x = -13; x <= 13; x++) {
        const dd = Math.hypot(x, y);
        const diag = Math.abs(Math.abs(x) - Math.abs(y)) < 2.2;
        if (diag) continue;
        if (Math.abs(dd - 10.6) < 0.6) p.px(c + x, c + y, y < 0 ? INK.redHi : INK.red);
        else if (Math.abs(dd - 11.6) < 0.6) p.px(c + x, c + y, INK.red);
      }
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      for (let s = 9; s <= 13; s++) p.px(c + dx * s, c + dy * s, INK.ink);
    }
  });
}

/**
 * The route from the camp to the place chosen, `w` × `h` (the sheet's size): red dots along a
 * gentle curve, closer together toward the end, with an arrowhead short of the place's mark.
 * @param {number} w
 * @param {number} h
 * @param {[number, number]} from px
 * @param {[number, number]} to px
 * @param {boolean} dashed a rumour's way: sparser, fainter dots
 * @returns {HTMLCanvasElement}
 */
export function routeLine(w, h, from, to, dashed) {
  return pixelCanvas(w, h, (p) => {
    const [ax, ay] = from, [bx, by] = to;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 22) return;
    // a curve bowed to one side, from the edge of one mark to the edge of the other
    const mx = (ax + bx) / 2 - ((by - ay) / len) * len * 0.14, my = (ay + by) / 2 + ((bx - ax) / len) * len * 0.14;
    const at = (t) => [(1 - t) ** 2 * ax + 2 * (1 - t) * t * mx + t * t * bx, (1 - t) ** 2 * ay + 2 * (1 - t) * t * my + t * t * by];
    const t0 = 11 / len, t1 = 1 - 13 / len;
    const gap = dashed ? 4.5 : 3.2;
    let last = null;
    const col = dashed ? 'rgba(168, 50, 42, 0.75)' : INK.red;
    for (let t = t0; t <= t1; t += 0.002) {
      const q = at(t);
      if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < gap) continue;
      p.px(Math.round(q[0]), Math.round(q[1]), col);
      last = q;
    }
    // the arrowhead, along the curve's last direction
    const e = at(t1), f = at(t1 - 0.03);
    const ux = e[0] - f[0], uy = e[1] - f[1], ul = Math.hypot(ux, uy) || 1;
    const dx = ux / ul, dy = uy / ul;
    for (let s = 0; s <= 3; s++) {
      p.px(Math.round(e[0] - dx * s - dy * s), Math.round(e[1] - dy * s + dx * s), col);
      p.px(Math.round(e[0] - dx * s + dy * s), Math.round(e[1] - dy * s - dx * s), col);
    }
  });
}

/**
 * A scrap of clean parchment under a name on the sheet, `w` × `h`: the paper's lightest tone, its
 * corners clipped, a dithered fringe so it fades into the sheet.
 * @param {number} w
 * @param {number} h
 */
export function labelScrap(w, h) {
  return pixelCanvas(w, h, (p) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
        const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
        if (corner || (edge === 0 && (x + y) % 2)) continue;
        p.px(x, y, edge === 0 ? 'rgba(241, 228, 191, 0.55)' : 'rgba(241, 228, 191, 0.82)');
      }
    }
  });
}

/**
 * A state's small sign beside its word in the panel (9 × 9): a dashed ring, an inked ring, a red
 * seal, the camp's pennant.
 * @param {'rumor'|'known'|'explored'|'home'} state
 */
export function stateSign(state) {
  return pixelCanvas(9, 9, (/** @type {PixelPainter} */ p) => {
    if (state === 'explored') {
      p.circle(4, 4, 3, INK.red, true);
      p.px(3, 2, INK.redHi);
      p.px(4, 4, INK.goldHi);
      return;
    }
    if (state === 'home') {
      p.rows(1, 0, ['or...', 'orrr.', 'orr..', 'o....', 'o....', 'o....', 'o....', 'oo...', '.....'], { o: INK.goldHi, r: INK.redHi });
      return;
    }
    for (let y = -4; y <= 4; y++) {
      for (let x = -4; x <= 4; x++) {
        const dd = Math.hypot(x, y);
        if (Math.abs(dd - 3.4) < 0.6 && (state === 'known' || (x + y + 8) % 2 === 0)) p.px(4 + x, 4 + y, state === 'known' ? INK.goldHi : '#c6bda9');
      }
    }
  });
}
