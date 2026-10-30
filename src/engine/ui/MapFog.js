import { pal } from './art/palette.js';

/** '#rrggbb' → [r, g, b]. @param {string} hex */
const rgb = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * The fog of exploration over a level's maps (docs/specs/PIXEL_UI.md §5, Maps): which parts of the
 * level the player has seen. A grid of one cell per world unit holds how revealed each is (0 unseen …
 * 255 seen); `reveal(x, z)` uncovers a disc round the player with a soft rim. The HUD minimap and the
 * world map (`Minimap.setFog`, `WorldMap.setFog`) draw the unseen as a dark cover, dithered along its
 * edge (`paint`), and leave out the markers that lie in it (`seen`) — the way back excepted, which
 * the game keeps out of the fog anyway.
 *
 * `encode()` / `decode()` keep it in a save: 16 levels per cell, run-length coded (a short string).
 * `version` counts the changes (the maps paint the cover again when it moved).
 */

/** Cells revealed at least this much count as seen (markers drawn there). */
const SEEN = 128;
/** The 4 × 4 ordered dither the cover's edge is speckled with (thresholds 0 … 255). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) * 16);
/** The longest run a save may hold, and the most runs (a saved game is untrusted). */
const MAX_CELLS = 1 << 20;

export class MapFog {
  /**
   * @param {number} width  the level's width (world units = cells)
   * @param {number} depth  the level's depth
   * @param {{ radius?: number, soft?: number }} [o] radius: what a reveal uncovers fully (world
   *   units, 10); soft: the rim beyond it that fades out (3.5)
   */
  constructor(width, depth, { radius = 10, soft = 3.5 } = {}) {
    this.width = Math.max(1, Math.floor(width));
    this.depth = Math.max(1, Math.floor(depth));
    this.radius = radius;
    this.soft = soft;
    /** How revealed each cell is (0 … 255), row by row. */
    this.cells = new Uint8Array(this.width * this.depth);
    /** Bumped on every change (the maps repaint their cover when it moved). */
    this.version = 0;
    /** The cell the last reveal stood in (a reveal from the same cell does nothing). */
    this._lastCell = -1;
  }

  /**
   * Uncover a disc round (x, z): full within `radius`, fading over `soft` (a cell keeps the most it
   * was ever revealed). Returns whether anything changed.
   * @param {number} x
   * @param {number} z
   */
  reveal(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const W = this.width, D = this.depth;
    const cx = Math.floor(x), cz = Math.floor(z);
    const cell = cz * W + cx;
    if (cell === this._lastCell) return false;
    this._lastCell = cell;
    const R = this.radius + this.soft;
    let changed = false;
    for (let j = Math.max(0, Math.floor(z - R)); j <= Math.min(D - 1, Math.ceil(z + R)); j++) {
      for (let i = Math.max(0, Math.floor(x - R)); i <= Math.min(W - 1, Math.ceil(x + R)); i++) {
        const d = Math.hypot(i + 0.5 - x, j + 0.5 - z);
        if (d >= R) continue;
        const v = d <= this.radius ? 255 : Math.round(255 * (1 - (d - this.radius) / this.soft));
        const k = j * W + i;
        if (v > this.cells[k]) { this.cells[k] = v; changed = true; }
      }
    }
    if (changed) this.version++;
    return changed;
  }

  /**
   * Has the player seen (x, z) (world units)? Outside the level: no.
   * @param {number} x
   * @param {number} z
   */
  seen(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    if (i < 0 || j < 0 || i >= this.width || j >= this.depth) return false;
    return this.cells[j * this.width + i] >= SEEN;
  }

  /**
   * Has the player seen any of the rect (world units)? (A region's name shows once any of it is.)
   * @param {number} minX
   * @param {number} minZ
   * @param {number} maxX
   * @param {number} maxZ
   */
  seenAny(minX, minZ, maxX, maxZ) {
    for (let j = Math.max(0, Math.floor(minZ)); j < Math.min(this.depth, Math.ceil(maxZ)); j++) {
      for (let i = Math.max(0, Math.floor(minX)); i < Math.min(this.width, Math.ceil(maxX)); i++) {
        if (this.cells[j * this.width + i] >= SEEN) return true;
      }
    }
    return false;
  }

  /** The share of the level seen (0 … 1). */
  get explored() {
    let n = 0;
    for (let k = 0; k < this.cells.length; k++) if (this.cells[k] >= SEEN) n++;
    return n / this.cells.length;
  }

  /**
   * Paint the cover into `canvas` at `scale` art px per world unit (the canvas is sized to the map):
   * the unseen in the fog colour, its edge a dithered speckle — each art pixel reads the cells round
   * it (bilinear), so the rim is soft at any scale.
   * @param {HTMLCanvasElement} canvas
   * @param {number} scale
   */
  paint(canvas, scale) {
    const w = Math.max(1, Math.round(this.width * scale)), h = Math.max(1, Math.round(this.depth * scale));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    const img = ctx.createImageData(w, h);
    const k = pal();
    const [fr, fg, fb] = rgb(k['m-fog']);
    const [er, eg, eb] = rgb(k['m-fog2']);
    const W = this.width, D = this.depth, c = this.cells;
    const at = (i, j) => c[Math.min(D - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const fz = (y + 0.5) / scale - 0.5;
      const j = Math.floor(fz), tz = fz - j;
      for (let x = 0; x < w; x++) {
        const fx = (x + 0.5) / scale - 0.5;
        const i = Math.floor(fx), tx = fx - i;
        const v = (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - tz) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * tz;
        const th = BAYER[(y & 3) * 4 + (x & 3)];
        const o = (y * w + x) * 4;
        if (v >= th) continue; // seen: clear
        // (the outermost speckle of the rim a shade lighter, the rest the fog itself)
        const edge = v > 0 && v >= th * 0.5;
        d[o] = edge ? er : fr; d[o + 1] = edge ? eg : fg; d[o + 2] = edge ? eb : fb; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /**
   * The fog as a save keeps it: `<width>x<depth>:` then runs of `<level 0–f><count, base 36>` joined
   * by '.' (16 levels per cell).
   * @returns {string}
   */
  encode() {
    const c = this.cells;
    const runs = [];
    let k = 0;
    while (k < c.length) {
      const v = c[k] >> 4;
      let n = 1;
      while (k + n < c.length && c[k + n] >> 4 === v) n++;
      runs.push(v.toString(16) + n.toString(36));
      k += n;
    }
    return `${this.width}x${this.depth}:${runs.join('.')}`;
  }

  /**
   * Read a saved fog back (untrusted): kept only when it is this level's size and well formed.
   * Returns whether it was read.
   * @param {unknown} s
   */
  decode(s) {
    if (typeof s !== 'string') return false;
    const m = /^(\d+)x(\d+):([0-9a-z.]*)$/.exec(s);
    if (!m || +m[1] !== this.width || +m[2] !== this.depth) return false;
    const out = new Uint8Array(this.cells.length);
    let k = 0;
    for (const run of m[3] ? m[3].split('.') : []) {
      const v = parseInt(run[0], 16), n = parseInt(run.slice(1), 36);
      if (!(v >= 0 && v < 16) || !(n > 0 && n <= MAX_CELLS) || k + n > out.length) return false;
      out.fill(v === 15 ? 255 : v << 4, k, k + n);
      k += n;
    }
    if (k !== out.length) return false;
    this.cells = out;
    this._lastCell = -1;
    this.version++;
    return true;
  }
}
