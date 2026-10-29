/**
 * MonsterSprites.js — enemy sprite sheets for combat levels (COMBAT.md §10.3).
 *
 * `createEnemySheet(kind)` returns a SpriteSheet (the createCharacterSheet shape) plus
 * `{ kind, poses, spriteOptions }`: rows = DIRECTIONS (down, left, right, up, with a real `right`
 * row — the left drawing mirrored by `resolvePainter`), `idle_<d>` / `walk_<d>` / `run_<d>`
 * animations, and `poses` (pose name → column, aliases included) for the combat state machine's
 * `sprite.setFrame(poses[name], row)`. `spriteOptions` holds only Sprite3D option keys; the game
 * spreads it into the sprite options (`{ ...CHARACTER_SPRITE_OPTS, ...sheet.spriteOptions, combatFx: true }`).
 *
 * Art: the monsters (slime, bat, boar, wolf, fera, shark, dummy, golem) are painted like the creatures of
 * CharacterSprites.js — shaded parts in a (material, shade) label buffer, 5-tone ramps, the dark
 * plum silhouette outline, light from the upper left — through its `_painterKit`. The humanoids
 * (goblin, archer, shaman) are `createCharacterSheet(spec, { combat: true })` sheets. Glow texels
 * (magma cracks, crown embers, bat eyes, the shaman's gem) are painted with alpha 204 so a
 * `combatFx` sprite's `setGlow` lights exactly them. New material ids 35–39 (GEL, BONE, GLOW,
 * STONE, WING). Painting is RNG-free (fixed layouts and `hash2` lattice noise with fixed seeds).
 */
import { createCharacterSheet, COMBAT_POSE_NAMES, _painterKit } from './CharacterSprites.js';
import { PixelCanvas } from './PixelCanvas.js';
import { DIRECTIONS, PPU } from '../constants.js';
import { hash2 } from '../utils/math.js';

/** @import * as THREE from 'three' */

const { Painter, resolvePainter, M, blob, quadGait, quadLeg, rampForKind, finishTexture, glowTexel, OUTLINE } = _painterKit;

/**
 * Every enemy kind with a sheet (ObjectCatalog.ENEMY_KINDS, plus `wolf` — the Lobo-de-Capim of the
 * Ato I bestiary — `fera` — A Fera Maculada, the Ato I boss: a giant iguana corrupted by the Baiacu Rei — and
 * `shark` — the shark boss, a giant humanoid great white with an anchor — whose
 * sheets come before their gameplay: no ENEMY_DEFS entry or brain yet; the `kind` of
 * createEnemySheet).
 * @type {readonly ('slime'|'goblin'|'archer'|'shaman'|'bat'|'boar'|'dummy'|'golem'|'wolf'|'fera'|'shark')[]}
 */
export const ENEMY_SHEET_KINDS = Object.freeze(['slime', 'goblin', 'archer', 'shaman', 'bat', 'boar', 'dummy', 'golem', 'wolf', 'fera', 'shark']);

/** Columns 0–9 shared by the monster (non-humanoid) sheets. */
const COMMON = ['idle0', 'idle1', 'move0', 'move1', 'move2', 'move3', 'windup', 'attack', 'hurt', 'dead'];
/** Humanoid columns: the character combat sheet (plain 0–5 + COMBAT_POSE_NAMES 6–17). */
const HUMANOID = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', ...COMBAT_POSE_NAMES];
const HUMANOID_MOVE = { move0: 'walk0', move1: 'walk1', move2: 'walk2', move3: 'walk3' };

// ---------------------------------------------------------------------------
// Shared painting helpers
// ---------------------------------------------------------------------------

/** 40 material ramps from { materialId: colour spec | explicit 5-tone array }; the rest fall back to `fallback`. */
function makeRamps(spec, fallback) {
  const ramps = new Array(40).fill(null);
  for (const [id, v] of Object.entries(spec)) ramps[id] = Array.isArray(v) && Array.isArray(v[0]) ? v : rampForKind(v);
  ramps[M.LINE] = [OUTLINE, OUTLINE, OUTLINE, OUTLINE, OUTLINE];
  const fb = ramps[fallback];
  for (let i = 0; i < 40; i++) if (!ramps[i]) ramps[i] = fb;
  return ramps;
}

/** Explicit dark → light ramp of five hex colours. */
const ramp5 = (hexes) => rampForKind(hexes);

/** A glow ramp: the colours as glow texels (alpha 204). */
const glowRamp = (hexes) => rampForKind(hexes).map(glowTexel);

/** Eye ramp [outline, dark, iris, light, white]. */
function eyeRamp(iris, light) {
  const c = rampForKind([iris, iris, iris, light, '#ffffff']);
  return [OUTLINE, c[1], c[2], c[3], [255, 255, 255, 255]];
}

/** Fill a polygon (screen points) with a material; `shade(x, y)` gives each pixel's tone. */
function fillPoly(p, pts, mat, shade) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      if (!inPoly(x + 0.5, y + 0.5, pts)) continue;
      const s = typeof shade === 'function' ? shade(x, y) : shade;
      if (s != null) p.set(x, y, mat, s);
    }
  }
}

/** Crossing-number point-in-polygon test. */
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Thick line (`w` px) between two points with a shade function of t (0 → 1). */
function thickLine(p, x0, y0, x1, y1, w, mat, shade) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  const r = w / 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r * r + 0.01) continue;
        p.set(x, y, mat, typeof shade === 'function' ? shade(t, x, y) : shade);
      }
    }
  }
}

/**
 * Chiselled rock chunk: a jagged star polygon (facet vertices on an ellipse, radii jittered by a
 * fixed lattice hash) with a flat inner face and bevel facets shaded by their direction to the light
 * (upper left), a bright chipped rim on the lit side. `seed` picks the jitter (deterministic).
 */
function rock(p, cx, cy, rx, ry, mat, seed, { facets = 8, rot = 0.3, face = 0.55, faceShade = 2, lift = 0 } = {}) {
  const TAU = Math.PI * 2;
  const vx = new Float32Array(facets + 1), vy = new Float32Array(facets + 1), shadeK = new Int8Array(facets);
  for (let k = 0; k <= facets; k++) {
    const a = rot + ((k % facets) / facets) * TAU;
    const j = 1 - 0.16 * hash2(k % facets, 3, seed);
    vx[k] = Math.cos(a) * j; vy[k] = Math.sin(a) * j;
  }
  for (let k = 0; k < facets; k++) {
    const am = rot + ((k + 0.5) / facets) * TAU;
    const l = -(Math.cos(am) * 0.62 + Math.sin(am) * 0.78);
    shadeK[k] = l > 0.5 ? 3 : l > -0.05 ? 2 : l > -0.6 ? 1 : 0;
  }
  let sector = 0;
  // inside test of normalised (nx, ny): the ray's radius against the facet edge of its sector;
  // returns r / boundary (< 1 inside) and leaves the sector in `sector`
  const ratio = (nx, ny) => {
    const r = Math.sqrt(nx * nx + ny * ny);
    if (r < 1e-6) { sector = 0; return 0; }
    let u = (Math.atan2(ny, nx) - rot) / TAU;
    u -= Math.floor(u);
    const k = Math.min(facets - 1, (u * facets) | 0);
    sector = k;
    const ex = vx[k + 1] - vx[k], ey = vy[k + 1] - vy[k];
    const t = (vx[k] * ey - vy[k] * ex) / ((nx / r) * ey - (ny / r) * ex);
    return r / t;
  };
  const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    const ny = (y + 0.5 - cy) / ry;
    for (let x = x0; x <= x1; x++) {
      const q = ratio((x + 0.5 - cx) / rx, ny);
      if (q >= 1) continue;
      let s;
      if (q < face) s = faceShade + lift;
      else {
        const k = sector;
        s = shadeK[k] + lift;
        // chipped bright rim on the lit side (the upper-left neighbour lies outside)
        if (shadeK[k] >= 2 && ratio((x - 0.5 - cx) / rx, (y - 0.5 - cy) / ry) >= 1) s = 4 + Math.min(0, lift);
      }
      p.set(x, y, mat, s < 0 ? 0 : s > 4 ? 4 : s);
    }
  }
}

/** Jagged glowing crack along a polyline (glow texels; `s` = tone, 3 = hot). */
function crack(p, pts, s = 3, mat = M.GLOW) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    p.line2(x0, y0, x1, y1, mat, (t) => (t < 0.15 && i === 0 ? Math.min(4, s + 1) : s));
  }
}

/** Keep every frame inside a transparent 1 px margin (the outline needs the next pixel; SPR-04). */
function clipMargin(p) {
  const { w, h, mat } = p;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x > 1 && x < w - 2 && y > 1 && y < h - 1) continue;
      mat[y * w + x] = 0;
    }
  }
}

/** Shear the painted labels sideways about a base row: x' = x + round((base − y) · k). */
function shear(p, k, base) {
  const { w, h, mat, shade } = p;
  const m2 = new Uint8Array(w * h), s2 = new Int8Array(w * h);
  for (let y = 0; y < h; y++) {
    const dx = Math.round((base - y) * k);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mat[i]) continue;
      const tx = x + dx;
      if (tx < 0 || tx >= w) continue;
      m2[y * w + tx] = mat[i]; s2[y * w + tx] = shade[i];
    }
  }
  mat.set(m2); shade.set(s2);
}

// ---------------------------------------------------------------------------
// Slime — translucent teal gel with a moss tuft and a leaf sprout (20 × 16)
// ---------------------------------------------------------------------------

/** Body ellipse per pose: rx, ry (px), lift (px above the ground), lean (side view, − = forward), face. */
const SLIME_SHAPES = {
  idle0: { rx: 6.8, ry: 4.3 },
  idle1: { rx: 7.2, ry: 4.0 },
  move0: { rx: 7.6, ry: 3.6 },                         // crouch before the hop
  move1: { rx: 5.6, ry: 5.0, lean: -1 },               // launch, stretched
  move2: { rx: 6.2, ry: 4.6, lift: 1 },                // airborne (the arc itself is mesh.position.y)
  move3: { rx: 5.8, ry: 4.9, lean: 1 },                // falling, stretched
  windup: { rx: 7.8, ry: 3.3, face: 'fierce' },        // deep squash
  attack: { rx: 7.4, ry: 4.2, lift: 1, lean: -2, face: 'fierce', stretch: true }, // leap
  hurt: { rx: 7.1, ry: 3.9, face: 'hurt', dent: true },
  dead: { rx: 7.8, ry: 2.0, face: 'dead', splat: true },
  land: { rx: 7.8, ry: 3.5 },
};

function drawSlime(p, view, key, f) {
  const S = SLIME_SHAPES[key];
  const G = f.G;
  const side = view === 'side';
  const cx = 10 + (side ? (S.lean ?? 0) : 0);
  const rx = side && S.stretch ? S.rx + 0.4 : !side && S.stretch ? S.rx - 1.4 : S.rx;
  const ry = !side && S.stretch ? S.ry + 0.8 : S.ry;
  const lift = S.lift ?? 0;
  const cy = G + 1 - ry - lift;
  const bottom = G - lift;
  // splat droplets
  if (S.splat) {
    p.begin(null);
    for (const [x, y] of [[3, G], [4, G], [16, G - 1], [15, G]]) p.set(x, y, M.GEL, 2);
    p.end();
  }
  // trailing drop of the leap (side view, behind the body)
  if (side && S.stretch) {
    p.begin(null);
    blob(p, cx + rx - 0.5, cy + 1.5, 2.2, 1.6, M.GEL, { hi: 0.2, lo: -0.4 });
    p.end();
  }
  // gel body: flat base, rim light through the gel at the bottom, bright upper-left rim
  p.begin(null);
  for (let y = Math.floor(cy - ry); y <= bottom; y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      let dy = (y + 0.5 - cy) / ry;
      if (dy > 0) dy *= 0.72; // fuller, flatter base
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const l = -dx * 0.55 - dy * 0.8;
      let s = l > 0.45 ? 3 : l > -0.2 ? 2 : 1;
      if (d < 0.3 && dy > -0.2) s = Math.min(s, 2);                     // denser core
      if (y === bottom) s = 1;                                          // contact
      else if (y === bottom - 1 && Math.abs(dx) < 0.8) s = 3;           // light through the gel
      if (d > 0.62 && l > 0.25) s = 4;                                  // bright rim
      p.set(x, y, M.GEL, s);
    }
  }
  if (S.dent) { for (let x = Math.round(cx) - 1; x <= Math.round(cx) + 1; x++) p.erase(x, Math.floor(cy - ry)); }
  // specular highlight and a bubble
  const hx = Math.round(cx - rx * 0.45), hy = Math.round(cy - ry * 0.45);
  p.over(hx, hy, M.GEL, 4); p.over(hx + 1, hy, M.GEL, 4); p.over(hx, hy + 1, M.GEL, 4);
  p.over(Math.round(cx + rx * 0.35), Math.round(cy + ry * 0.15), M.GEL, 3);
  p.end();
  // face
  const face = S.face ?? 'calm';
  const ey = Math.round(cy - (S.splat ? 0.5 : 0.2));
  const eyes = view === 'down' ? [Math.round(cx - 3), Math.round(cx + 2)] : side ? [Math.round(cx - rx * 0.62)] : [];
  p.begin(null);
  for (const ex of eyes) {
    if (face === 'hurt') { p.set(ex - 1, ey, M.EYE, 0); p.set(ex, ey + 1, M.EYE, 0); p.set(ex + 1, ey, M.EYE, 0); continue; }
    if (face === 'dead') { p.set(ex, ey, M.EYE, 0); p.set(ex + 1, ey + 1, M.EYE, 0); p.set(ex + 1, ey, M.EYE, 1); p.set(ex, ey + 1, M.EYE, 1); continue; }
    p.set(ex, ey, M.EYE, 0); p.set(ex + 1, ey, M.EYE, 0); p.set(ex, ey + 1, M.EYE, 0); p.set(ex + 1, ey + 1, M.EYE, 0);
    p.set(ex, ey, M.EYE, 4); // catch light
    if (face === 'fierce') { p.set(ex - 1, ey - 1, M.GEL, 0); p.set(ex, ey - 1, M.GEL, 0); p.set(ex + 1, ey - 1, M.GEL, 0); }
  }
  if (view === 'down' && face !== 'dead') {
    const mx = Math.round(cx - 0.5), my = ey + 2;
    p.set(mx, my, M.EYE, 0); p.set(mx + 1, my, M.EYE, 0);
    if (face === 'fierce' || face === 'hurt') p.set(mx, my + 1, M.EYE, 1);
  } else if (side && face !== 'dead') p.set(eyes[0] - 1, ey + 2, M.EYE, 0);
  p.end();
  // moss tuft and leaf sprout on top (lying flat on the splat)
  const top = Math.floor(cy - ry) + (S.dent ? 1 : 0);
  const mx = Math.round(cx - (side ? -0.5 : 0.5));
  p.begin('below', 1);
  if (S.splat) {
    for (let x = mx - 2; x <= mx + 1; x++) p.set(x, top, M.FUR, x < mx ? 3 : 2);
    p.set(mx + 2, top, M.FUR2, 3); p.set(mx + 3, top, M.FUR2, 2);
  } else {
    for (let x = mx - 2; x <= mx + 2; x++) p.set(x, top, M.FUR, x < mx ? 3 : x === mx ? 2 : 1);
    for (let x = mx - 1; x <= mx + 1; x++) p.set(x, top - 1, M.FUR, x < mx + 1 ? 3 : 2);
    p.set(mx - 3, top + 1, M.FUR, 2); p.set(mx + 3, top + 1, M.FUR, 1); // drips of moss
    // sprout: short stem, two leaves (the leaf flips with the hop)
    const lean = key === 'move1' || key === 'attack' ? 1 : key === 'move3' ? -1 : 0;
    p.set(mx + lean, top - 2, M.FUR2, 1);
    p.set(mx + 1 + lean, top - 3, M.FUR2, 3); p.set(mx + 2 + lean, top - 3, M.FUR2, 4); p.set(mx + 2 + lean, top - 4, M.FUR2, 3);
    p.set(mx - 1 + lean, top - 3, M.FUR2, 2);
  }
  p.end();
}

// ---------------------------------------------------------------------------
// Bat — charcoal body and bones, ember-orange membranes, glowing eyes (20 × 20)
// ---------------------------------------------------------------------------

/** Wing shapes: wrist and three finger tips relative to the shoulder (screen-right wing, front view). */
const BAT_WINGS = {
  up: { wrist: [3, -5], tips: [[5, -8], [7, -6], [7, -2]] },
  mid: { wrist: [4, -2], tips: [[7, -3], [8, 0], [6, 3]] },
  down: { wrist: [3, 1], tips: [[7, 2], [6, 5], [3, 6]] },
  high: { wrist: [2, -6], tips: [[3, -9], [6, -8], [7, -4]] },
  swept: { wrist: [2, -3], tips: [[3, 2], [4, 4], [2, 5]] },
  crumple: { wrist: [3, 0], tips: [[4, 4], [6, 2], [2, 5]] },
  fold: { wrist: [1, -2], tips: [[1, 3], [2, 3], [0, 4]] },
};

/** Per pose: [screen-left wing, screen-right wing] shapes, eyes, body offset. */
const BAT_POSES = {
  idle0: { wings: ['up', 'up'] }, idle1: { wings: ['down', 'down'] },
  move0: { wings: ['up', 'up'] }, move1: { wings: ['mid', 'mid'] }, move2: { wings: ['down', 'down'], dy: 1 }, move3: { wings: ['mid', 'mid'], dy: -1 },
  windup: { wings: ['high', 'high'], eyes: 'wide', dy: -1 },
  attack: { wings: ['swept', 'swept'], eyes: 'wide', dy: 1 },
  hurt: { wings: ['crumple', 'up'], eyes: 'shut' },
  dead: { wings: ['fold', 'fold'], eyes: 'dead', dy: 2 },
};

/**
 * One wing: a membrane between the arm bone (shoulder → wrist) and three fingers (wrist → tips),
 * its trailing edge scalloped between the finger tips; bones drawn over it. `dir` = ±1 (outward),
 * `sx` = x scale (side views foreshorten the wing), `tone` = 0 (far / back) … 2 (lit).
 */
function batWing(p, x0, y0, shape, dir, tone, sx = 0.85) {
  const W = BAT_WINGS[shape];
  const pt = ([x, y]) => [x0 + x * dir * sx, y0 + y];
  const wrist = pt(W.wrist);
  const tips = W.tips.map(pt);
  const hip = [x0 + 0.5 * dir, y0 + 3.2];
  const scallop = (a, b) => {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return [m[0] + (wrist[0] - m[0]) * 0.38, m[1] + (wrist[1] - m[1]) * 0.38];
  };
  const poly = [[x0, y0 - 0.6], wrist, tips[0]];
  for (let i = 0; i + 1 < tips.length; i++) poly.push(scallop(tips[i], tips[i + 1]), tips[i + 1]);
  poly.push(scallop(tips[tips.length - 1], hip), hip);
  fillPoly(p, poly, M.WING, (x, y) => {
    // lit near the arm (the membrane is thin and glows ember-orange there), dark toward the trailing edge
    const d = Math.hypot(x + 0.5 - wrist[0], y + 0.5 - wrist[1]);
    return Math.max(0, (d < 2.4 ? 3 : d < 4.6 ? 2 : 1) + tone - 1);
  });
  const bone = Math.min(4, tone + 2);
  p.line2(x0, y0, wrist[0], wrist[1], M.FUR, Math.min(4, bone + 1));
  for (const t of tips) p.line2(wrist[0], wrist[1], t[0], t[1], M.FUR, bone);
  p.set(Math.round(wrist[0]), Math.round(wrist[1]) - 1, M.BONE, 2); // thumb claw
}

function drawBat(p, view, key) {
  const P = BAT_POSES[key];
  const dy = P.dy ?? 0;
  const cy = 11 + dy;
  const eyeS = P.eyes === 'wide' ? 4 : 3;
  if (view === 'side') {
    // facing left: both wings stroke behind the body (the far one darker, higher and further back,
    // outlined off the near one), so the body stays whole — a round, furry three-quarter profile
    // under a big head with a tall pointed ear, the snout, a glowing eye and a fang
    const [w0, w1] = P.wings;
    p.begin(null); batWing(p, 13, cy - 3, w1, 1, 0, 0.6); p.end();
    p.begin('all', 0); batWing(p, 11.5, cy - 2, w0, 1, 2, 0.85); p.end();
    p.begin('all', 0);
    blob(p, 11, cy + 0.8, 3.2, 3, M.FUR, { hi: 0.4, lo: -0.3 });
    for (let y = cy; y <= cy + 2; y++) { p.over(9, y, M.FUR, 3); p.over(10, y, M.FUR, 2); } // chest ruff
    p.set(11, cy + 4, M.FUR, 1); p.set(12, cy + 4, M.FUR, 0); // feet
    p.end();
    // the head, outlined off the body: a tall pointed ear (the far one behind it), the snout
    p.begin('all', 0);
    blob(p, 7.5, cy - 1.8, 3, 2.7, M.FUR, { hi: 0.3, lo: -0.3 });
    p.set(10, cy - 6, M.FUR, 1); p.set(10, cy - 5, M.FUR, 1); // far ear
    p.set(8, cy - 7, M.FUR, 4); p.set(8, cy - 6, M.FUR, 3); p.set(9, cy - 6, M.FUR, 2); p.set(8, cy - 5, M.FUR, 3); p.set(9, cy - 5, M.FUR, 2); // near ear
    p.set(9, cy - 5, M.WING, 2); // inner ear
    p.set(4, cy - 1, M.FUR, 3); p.set(4, cy, M.FUR, 2); p.set(5, cy, M.FUR, 1); // snout
    p.end();
    p.begin(null);
    if (P.eyes === 'shut' || P.eyes === 'dead') { p.set(6, cy - 2, M.EYE, 0); p.set(7, cy - 2, M.EYE, 0); }
    else { p.set(6, cy - 2, M.GLOW, eyeS); p.set(7, cy - 2, M.GLOW, eyeS - 1); if (P.eyes === 'wide') p.set(6, cy - 3, M.GLOW, 3); }
    p.set(5, cy + 1, M.BONE, 4); // fang
    p.end();
    return;
  }
  const back = view === 'up';
  const cx = 9.5;
  // wings (behind the body); the screen-left wing catches the light
  p.begin(null);
  batWing(p, cx - 1.5, cy - 2, P.wings[0], -1, back ? 0 : 1);
  batWing(p, cx + 1.5, cy - 2, P.wings[1], 1, 0);
  p.end();
  // body, head, ears
  p.begin(null);
  blob(p, cx, cy, 2.6, 3.1, M.FUR, { hi: 0.35, lo: -0.3 });
  if (!back) for (let y = cy - 1; y <= cy + 2; y++) { p.over(Math.floor(cx) - 1, y, M.FUR, 3); p.over(Math.floor(cx), y, M.FUR, 2); } // chest ruff
  blob(p, cx, cy - 4, 2.6, 2.2, M.FUR, { hi: 0.3, lo: -0.3 });
  const ex0 = Math.floor(cx) - 2, ex1 = Math.floor(cx) + 1;
  p.set(ex0 - 1, cy - 7, M.FUR, 3); p.set(ex0 - 1, cy - 6, M.FUR, 2); p.set(ex0, cy - 6, M.FUR, 2);
  p.set(ex1 + 1, cy - 7, M.FUR, 2); p.set(ex1 + 1, cy - 6, M.FUR, 1); p.set(ex1, cy - 6, M.FUR, 1);
  if (!back) { p.set(ex0 - 1, cy - 6, M.WING, 2); p.set(ex1 + 1, cy - 6, M.WING, 1); } // inner ears
  p.set(ex0 + 1, cy + 3, M.FUR, 1); p.set(ex1, cy + 3, M.FUR, 0); // feet
  p.end();
  if (!back) {
    p.begin(null);
    const ey = cy - 4;
    if (P.eyes === 'shut') { p.set(ex0, ey, M.EYE, 0); p.set(ex1, ey, M.EYE, 0); }
    else if (P.eyes === 'dead') { p.set(ex0, ey, M.EYE, 1); p.set(ex1, ey, M.EYE, 1); }
    else {
      p.set(ex0, ey, M.GLOW, eyeS); p.set(ex1, ey, M.GLOW, eyeS);
      if (P.eyes === 'wide') { p.set(ex0, ey - 1, M.GLOW, 3); p.set(ex1, ey - 1, M.GLOW, 3); }
    }
    p.set(ex0 + 1, ey + 2, M.BONE, 4); p.set(ex1 - 1, ey + 2, M.BONE, 3); // fangs
    p.end();
  }
}

// ---------------------------------------------------------------------------
// Boar — bristled iron-grey hide, bone tusks, plated forehead (32 × 24)
// ---------------------------------------------------------------------------

/** Per pose: head offset / drop, leg gait override, body drop, eye, extras. */
const BOAR_POSES = {
  idle0: {}, idle1: { head: [0, 1] },
  move0: { walk: 0 }, move1: { walk: 1, body: -1 }, move2: { walk: 2 }, move3: { walk: 3, body: -1 },
  windup: { head: [0, 2], paw: true, eye: 'angry' },
  attack: { head: [-1, -2], legs: [[-2, 0], [-1, 0], [2, 0], [1, 0]], eye: 'angry' },
  hurt: { head: [1, -1], body: 0, eye: 'shut', legs: [[1, 0], [0, 0], [1, 0], [0, 0]] },
  dead: { dead: true },
  charge0: { head: [-1, 2], body: 1, legs: [[-3, 1], [-2, 1], [3, 1], [2, 1]], eye: 'angry', flat: true },
  charge1: { head: [-1, 1], body: -1, legs: [[1, 2], [2, 2], [-1, 2], [-2, 2]], eye: 'angry', flat: true },
  stun: { head: [-1, 3], eye: 'dizzy', legs: [[-1, 0], [1, 0], [1, 0], [-1, 0]] },
};

/** Boar head (side view, facing left) at (hx, hy) = the head's centre. */
function boarHeadSide(p, hx, hy, eye) {
  p.begin(null);
  blob(p, hx, hy, 5.2, 4.2, M.FUR, { hi: 0.4, lo: -0.25 });
  // snout
  for (let y = hy; y <= hy + 3; y++) for (let x = hx - 7; x <= hx - 4; x++) {
    const tip = x === hx - 7;
    if (tip && (y === hy || y === hy + 3)) continue;
    p.set(x, y, tip ? M.NOSE : M.FUR, tip ? (y === hy + 1 ? 3 : 2) : y === hy ? 3 : y === hy + 3 ? 1 : 2);
  }
  p.set(hx - 7, hy + 1, M.NOSE, 1); // nostril
  // lower jaw shadow
  for (let x = hx - 5; x <= hx + 2; x++) p.over(x, hy + 3, M.FUR, 1);
  p.end();
  // plated forehead: an iron plate with a bright edge and a rivet
  p.begin('below', 0);
  const plate = [[-3, -4], [-2, -4], [-1, -4], [0, -4], [-4, -3], [-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [-5, -2], [-4, -2], [-3, -2], [-2, -2], [-1, -2]];
  for (const [dx, dy] of plate) p.set(hx + dx, hy + dy, M.METAL, dy === -4 ? 4 : dx < -2 ? 3 : 2);
  p.set(hx - 2, hy - 3, M.METAL, 4);
  p.end();
  // ear, eye, tusk
  p.begin(null);
  p.set(hx + 2, hy - 5, M.FUR, 3); p.set(hx + 3, hy - 5, M.FUR, 2); p.set(hx + 3, hy - 6, M.FUR, 3); p.set(hx + 2, hy - 4, M.FUR, 2);
  const ex = hx - 2, ey = hy - 1;
  if (eye === 'shut') { p.set(ex, ey, M.EYE, 0); p.set(ex + 1, ey, M.EYE, 0); }
  else if (eye === 'dizzy' || eye === 'dead') { p.set(ex, ey, M.EYE, 0); p.set(ex + 1, ey + 1, M.EYE, 0); p.set(ex + 1, ey - 1, M.EYE, 0); p.set(ex - 1, ey + 1, M.EYE, 0); }
  else { p.set(ex, ey, M.EYE, 2); p.set(ex + 1, ey, M.EYE, 0); if (eye === 'angry') p.set(ex, ey - 1, M.FUR, 0); }
  p.end();
  p.begin('all', 0);
  p.set(hx - 4, hy + 3, M.BONE, 3); p.set(hx - 5, hy + 2, M.BONE, 4); p.set(hx - 6, hy + 1, M.BONE, 4); p.set(hx - 6, hy, M.BONE, 3);
  p.end();
}

/** Boar from behind: haunches, spine ridge, ears peeking over, curly tail, hind legs with hooves. */
function drawBoarBack(p, P, G, bd) {
  const cx = 16;
  const walkL = P.walk === 0 || P.walk === 1 ? 1 : 0, walkR = P.walk === 2 || P.walk === 3 ? 1 : 0;
  const lift = [P.paw ? 1 : walkL, walkR];
  p.begin(null);
  // ears and the shoulder hump behind the rump
  p.set(cx - 7, 5 + bd, M.FUR, 3); p.set(cx - 7, 6 + bd, M.FUR, 2); p.set(cx - 6, 6 + bd, M.FUR, 2);
  p.set(cx + 6, 5 + bd, M.FUR, 2); p.set(cx + 6, 6 + bd, M.FUR, 1); p.set(cx + 5, 6 + bd, M.FUR, 1);
  blob(p, cx, 10 + bd, 7.5, 4, M.FUR, { hi: 0.4, lo: -0.1 });
  p.end();
  p.begin(null);
  for (const [k, lx] of [[0, 10], [1, 19]]) {
    for (let y = 16 + bd; y <= G - lift[k]; y++) {
      const hoof = y >= G - lift[k] - 1;
      for (let i = 0; i < 3; i++) p.set(lx + i, y, hoof ? M.FUR2 : M.FUR, hoof ? (i === 0 ? 3 : 1) : i === 0 ? 3 : i === 1 ? 2 : 1);
    }
  }
  p.end();
  p.begin('below', 1);
  blob(p, cx, 13.5 + bd, 9.4, 5.8, M.FUR, { hi: 0.45, lo: -0.25 });
  for (let x = cx - 8; x <= cx + 7; x++) if (x !== cx - 1 && x !== cx) p.over(x, 18 + bd, M.FUR3, x < cx ? 2 : 1);
  p.end();
  p.begin(null);
  // spine ridge running down to the tail, a darker cleft between the haunches
  for (let y = 6 + bd; y <= 15 + bd; y++) { p.set(cx - 1, y, M.FUR2, y & 1 ? 3 : 2); p.set(cx, y, M.FUR2, y & 1 ? 1 : 2); if ((y & 1) === 0) p.set(cx + (y % 4 ? 1 : -2), y - 1, M.FUR2, 2); }
  for (let y = 16 + bd; y <= 18 + bd; y++) p.set(cx, y, M.FUR, 0);
  p.set(cx - 1, 15 + bd, M.FUR, 3); p.set(cx - 2, 16 + bd, M.FUR, 3); p.set(cx - 2, 17 + bd, M.FUR, 2); p.set(cx - 1, 17 + bd, M.FUR, 1); // tail curl
  p.end();
}

/** Bristle ridge along the back: dark spikes following the body's top edge. */
function bristles(p, x0, x1, topAt, flat) {
  for (let x = x0; x <= x1; x++) {
    const y = topAt(x);
    if (y == null) continue;
    const k = (x - x0) % 3;
    p.set(x, y, M.FUR2, k === 0 ? 3 : 2);
    if (!flat && k === 0) p.set(x + 1, y - 1, M.FUR2, 2);
    if (flat && k === 0) p.set(x + 1, y, M.FUR2, 3);
  }
}

function drawBoar(p, view, key, f) {
  const P = BOAR_POSES[key];
  const G = f.G;
  const [hdx, hdy] = P.head ?? [0, 0];
  const bd = P.body ?? 0;
  if (view === 'side') {
    if (P.dead) {
      // keeled over on its side: flattened body, stiff legs sprawled toward the viewer, head on the ground
      p.begin(null);
      blob(p, 18.5, G - 3.2, 9.5, 3.8, M.FUR, { hi: 0.35, lo: -0.3 });
      for (let x = 12; x <= 25; x++) p.over(x, G - 5, M.FUR, 3);
      p.end();
      p.begin(null); bristles(p, 12, 25, () => G - 7, true); p.end();
      p.begin('all', 0);
      for (const lx of [12, 15, 21, 24]) { p.set(lx, G - 1, M.FUR, 2); p.set(lx + 1, G, M.FUR, 1); p.set(lx + 2, G, M.FUR2, 1); }
      p.end();
      boarHeadSide(p, 9, G - 3, 'dead');
      return;
    }
    const gait = P.legs ? P.legs.map(([dx, lift]) => ({ dx, lift })) : quadGait({ walk: P.walk ?? -1 });
    if (P.paw) { gait[0] = { dx: 1, lift: 2 }; }
    const bodyY = 13.5 + bd;
    // far legs
    p.begin(null);
    quadLeg(p, 12, 17 + bd, G, gait[1].lift, gait[1].dx, true, M.FUR2, M.FUR, 3);
    quadLeg(p, 24, 17 + bd, G, gait[3].lift, gait[3].dx, true, M.FUR2, M.FUR, 3);
    p.end();
    // body: a high shoulder hump sloping to the haunch, lighter belly, bristled hide, curly tail
    p.begin(null);
    blob(p, 22, bodyY + 0.8, 6.8, 5, M.FUR, { hi: 0.45, lo: -0.2 });
    blob(p, 15, bodyY - 0.4, 7, 6.2, M.FUR, { hi: 0.45, lo: -0.2 });
    for (let x = 11; x <= 26; x++) { p.over(x, Math.round(bodyY + 4.8), M.FUR3, 2); p.over(x, Math.round(bodyY + 5.6), M.FUR3, 1); }
    for (let y = Math.round(bodyY - 4); y <= Math.round(bodyY + 3); y++) {
      for (let x = 10; x <= 27; x++) if ((x * 2 + y * 3) % 7 === 0 && p.getShade(x, y) >= 2) p.over(x, y, M.FUR, p.getShade(x, y) - 1); // bristle strokes
    }
    p.set(28, Math.round(bodyY - 1), M.FUR, 2); p.set(29, Math.round(bodyY - 2), M.FUR, 2); p.set(29, Math.round(bodyY - 3), M.FUR, 1); p.set(28, Math.round(bodyY - 3), M.FUR, 1);
    p.end();
    const topAt = (x) => {
      const a = bodyY - 0.4 - 6.2 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 15) / 7) ** 2));
      const b = bodyY + 0.8 - 5 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 22) / 6.8) ** 2));
      return Math.round(Math.min(Math.abs(x + 0.5 - 15) < 7 ? a : 99, Math.abs(x + 0.5 - 22) < 6.8 ? b : 99)) - 1;
    };
    p.begin(null);
    bristles(p, 10, 26, topAt, P.flat);
    p.end();
    // near legs
    p.begin('sides', 1);
    quadLeg(p, 11, 17 + bd, G, gait[0].lift, gait[0].dx, false, M.FUR2, M.FUR, 3);
    quadLeg(p, 23, 17 + bd, G, gait[2].lift, gait[2].dx, false, M.FUR2, M.FUR, 3);
    p.end();
    boarHeadSide(p, 9 + hdx, 13 + hdy + bd, P.eye);
    return;
  }
  if (!P.dead && view === 'up') { drawBoarBack(p, P, G, bd); return; }
  const back = view === 'up';
  const cx = 16;
  if (P.dead) {
    p.begin(null);
    blob(p, cx, G - 3.2, 10, 3.8, M.FUR, { hi: 0.35, lo: -0.3 });
    for (let x = cx - 7; x <= cx + 6; x++) p.over(x, G - 6, M.FUR2, 2); // flattened bristle ridge
    p.end();
    p.begin('all', 0);
    for (const [lx, d] of [[5, -1], [7, -1], [25, 1], [27, 1]]) { p.set(lx, G - 1, M.FUR, 2); p.set(lx + d, G, M.FUR2, 1); }
    p.end();
    if (!back) {
      p.begin('all', 0);
      p.set(cx - 2, G - 4, M.EYE, 0); p.set(cx - 1, G - 3, M.EYE, 0); p.set(cx + 2, G - 4, M.EYE, 0); p.set(cx + 1, G - 3, M.EYE, 0);
      p.end();
    }
    return;
  }
  const walkL = P.walk === 0 || P.walk === 1 ? 1 : 0, walkR = P.walk === 2 || P.walk === 3 ? 1 : 0;
  const lift = [P.paw ? 2 : walkL, walkR];
  // legs
  p.begin(null);
  for (const [k, lx] of [[0, 10], [1, 19]]) {
    for (let y = 16 + bd; y <= G - lift[k]; y++) for (let i = 0; i < 3; i++) p.set(lx + i, y, y >= G - lift[k] - 1 ? M.FUR2 : M.FUR, y >= G - lift[k] - 1 ? (i === 0 ? 2 : 1) : i === 0 ? 3 : i === 1 ? 2 : 1);
  }
  p.end();
  // shoulders / rump
  p.begin(null);
  blob(p, cx, 13 + bd, 10, 6.2, M.FUR, { hi: 0.45, lo: -0.2 });
  p.end();
  p.begin(null);
  if (back) {
    // spine ridge and a curly tail
    for (let y = 7 + bd; y <= 17 + bd; y++) { p.set(cx - 1, y, M.FUR2, 2); p.set(cx, y, M.FUR2, y & 1 ? 3 : 1); }
    p.set(cx, 16 + bd, M.FUR, 3); p.set(cx + 1, 17 + bd, M.FUR, 2); p.set(cx, 18 + bd, M.FUR, 2);
    // ears peeking over the shoulders
    p.set(cx - 6, 6 + bd, M.FUR, 3); p.set(cx - 5, 6 + bd, M.FUR, 2); p.set(cx + 5, 6 + bd, M.FUR, 2); p.set(cx + 6, 6 + bd, M.FUR, 1);
  } else {
    bristles(p, cx - 7, cx + 6, (x) => Math.round(13 + bd - 6.2 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / 10) ** 2))) - 1, P.flat);
  }
  p.end();
  if (back) return;
  // head: front view with snout, tusks, forehead plate, ears, eyes
  const hy = 13 + hdy + bd;
  p.begin('all', 1);
  blob(p, cx, hy, 6.2, 5, M.FUR, { hi: 0.35, lo: -0.3 });
  p.set(cx - 7, hy - 4, M.FUR, 3); p.set(cx - 6, hy - 4, M.FUR, 2); p.set(cx - 7, hy - 5, M.FUR, 2); // ears
  p.set(cx + 6, hy - 4, M.FUR, 1); p.set(cx + 5, hy - 4, M.FUR, 2); p.set(cx + 6, hy - 5, M.FUR, 1);
  p.end();
  p.begin('below', 0);
  for (let x = cx - 3; x <= cx + 2; x++) { p.set(x, hy - 4, M.METAL, x < cx ? 4 : 3); p.set(x, hy - 3, M.METAL, x < cx - 1 ? 3 : 2); }
  p.set(cx - 2, hy - 2, M.METAL, 2); p.set(cx + 1, hy - 2, M.METAL, 1); p.set(cx - 1, hy - 3, M.METAL, 4);
  p.end();
  p.begin(null);
  const ey = hy - 1;
  if (P.eye === 'shut') { p.set(cx - 4, ey, M.EYE, 0); p.set(cx - 3, ey, M.EYE, 0); p.set(cx + 2, ey, M.EYE, 0); p.set(cx + 3, ey, M.EYE, 0); }
  else if (P.eye === 'dizzy') { for (const ex of [cx - 4, cx + 2]) { p.set(ex, ey, M.EYE, 0); p.set(ex + 1, ey + 1, M.EYE, 0); p.set(ex + 1, ey - 1, M.EYE, 0); } }
  else { p.set(cx - 4, ey, M.EYE, 2); p.set(cx - 3, ey, M.EYE, 0); p.set(cx + 3, ey, M.EYE, 2); p.set(cx + 2, ey, M.EYE, 0); if (P.eye === 'angry') { p.set(cx - 4, ey - 1, M.FUR, 0); p.set(cx + 3, ey - 1, M.FUR, 0); } }
  // snout disc with nostrils
  for (let y = hy + 1; y <= hy + 4; y++) for (let x = cx - 2; x <= cx + 1; x++) {
    if ((y === hy + 1 || y === hy + 4) && (x === cx - 2 || x === cx + 1)) continue;
    p.set(x, y, M.NOSE, y === hy + 1 ? 3 : x < cx ? 2 : 1);
  }
  p.set(cx - 1, hy + 3, M.NOSE, 0); p.set(cx, hy + 3, M.NOSE, 0);
  p.end();
  p.begin('all', 0);
  p.set(cx - 3, hy + 4, M.BONE, 3); p.set(cx - 4, hy + 3, M.BONE, 4); p.set(cx - 4, hy + 2, M.BONE, 4);
  p.set(cx + 2, hy + 4, M.BONE, 2); p.set(cx + 3, hy + 3, M.BONE, 3); p.set(cx + 3, hy + 2, M.BONE, 3);
  p.end();
}

// ---------------------------------------------------------------------------
// Wolf (Lobo-de-Capim) — a lean grass wolf whose pelt is overlapping leaves: a leaf mane along
// the neck and spine, a leafy brush of a tail, a straw belly and muzzle, amber eyes (32 × 24)
// ---------------------------------------------------------------------------

/** Per pose: head offset, body drop, leg gait override, mouth, ears flat, eye, tail lift. */
const WOLF_POSES = {
  idle0: { tail: 0 }, idle1: { head: [0, 1], tail: 1 },
  // (the walk's bob dips: a rise would push the ear tips out of the frame's top)
  move0: { walk: 0 }, move1: { walk: 1, body: 1, tail: 1 }, move2: { walk: 2 }, move3: { walk: 3, body: 1, tail: 1 },
  windup: { head: [1, 3], body: 1, ears: 'flat', mouth: 'snarl', eye: 'angry', tail: -1, legs: [[1, 0], [1, 0], [-1, 0], [-1, 0]] },
  attack: { head: [0, 1], body: 0, mouth: 'open', eye: 'angry', tail: 2, legs: [[-2, 1], [-1, 1], [2, 0], [1, 0]] },
  hurt: { head: [1, -1], ears: 'flat', eye: 'shut', tail: -1, legs: [[1, 0], [0, 0], [1, 0], [0, 0]] },
  dead: { dead: true },
};

/**
 * Leaf scales over what is painted: on a slanted lattice, a lit leaf tip and its dark lower edge,
 * so the pelt reads as overlapping leaves rather than fur.
 * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 */
function leafScales(p, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (p.get(x, y) !== M.FUR) continue;
      const k = (x + 2 * y) % 5;
      const s = p.getShade(x, y);
      if (k === 0) p.set(x, y, M.FUR, Math.min(4, s + 2));
      else if (k === 2 && s > 0) p.set(x, y, M.FUR2, Math.max(1, s - 1));
    }
  }
}

/** A pointed leaf rising from (x, y): base, mid and tip leaning back by `lean`, in the mane's tones. */
function maneLeaf(p, x, y, h, lean, tone) {
  for (let i = 0; i < h; i++) {
    const t = i / Math.max(1, h - 1);
    const xx = x + Math.round(lean * t);
    p.set(xx, y - i, i === h - 1 ? M.FUR : M.FUR2, i === h - 1 ? Math.min(4, tone + 1) : tone);
    if (i === 0 && h > 2) p.set(xx + 1, y - i, M.FUR2, Math.max(0, tone - 1));
  }
}

/**
 * A wolf's leg in side view (facing left; toes forward = −x). Forelegs: a straight column with a
 * narrower wrist above the paw. Hind legs: the thigh angled forward to the stifle, the shank back
 * to the hock (the backward "knee"), then the straight metatarsal down to the paw. Every paw is a
 * 3 px foot with a dark toe split and a lit top; `lift` raises it, `dx` swings it (walk gait).
 * @param {number} x the leg's column at the body @param {number} top @param {number} ground
 * @param {number} lift @param {number} dx @param {boolean} far @param {boolean} hind
 */
function wolfLegSide(p, x, top, ground, lift, dx, far, hind) {
  const bottom = ground - lift;
  const n = Math.max(1, bottom - top);
  const off = (/** @type {number} */ y) => Math.round(dx * (y - top) / n);
  const tone = (/** @type {number} */ s) => Math.max(0, s - (far ? 1 : 0));
  const knee = top + Math.round(n * 0.35), hock = top + Math.round(n * 0.65);
  for (let y = top; y < bottom; y++) {
    let cx = x + off(y);
    let w = 2;
    if (hind) {
      // the thigh (3 px, into the haunch), the shank easing back one pixel to the hock, the
      // straight metatarsal below it
      if (y <= knee) w = 3;
      else cx += y > hock ? 1 : Math.round((y - knee) / Math.max(1, hock - knee));
    } else if (y === bottom - 1) w = 1; // the wrist, narrower above the paw
    for (let i = 0; i < w; i++) p.set(cx + i, y, i === w - 1 ? M.FUR2 : M.FUR, tone(i === 0 ? 3 : i === w - 1 ? 2 : 2));
  }
  // the paw: toes forward with a dark split between them, lit on top
  const px = x + off(bottom) + (hind ? 1 : 0) - 1;
  p.set(px, bottom, M.FUR, tone(2)); p.set(px + 1, bottom, M.FUR2, tone(0)); p.set(px + 2, bottom, M.FUR, tone(1));
}

/**
 * A wolf's leg facing the camera or from behind: a 2 px column, a narrower wrist (forelegs) or a
 * hock bulging out (hind legs, from behind), and a 3 px paw with two dark toe splits.
 * @param {number} x @param {number} top @param {number} ground @param {number} lift
 * @param {-1|1} side which way the leg's outer edge faces @param {boolean} hind
 */
function wolfLegFront(p, x, top, ground, lift, side, hind) {
  const bottom = ground - lift;
  const hock = top + Math.round((bottom - top) * 0.55);
  for (let y = top; y < bottom; y++) {
    p.set(x, y, M.FUR, 3); p.set(x + 1, y, M.FUR, 1);
    if (hind && y === hock) p.set(side < 0 ? x - 1 : x + 2, y, M.FUR2, 1);
  }
  p.set(x - 1, bottom, M.FUR, 2); p.set(x, bottom, M.FUR2, 0); p.set(x + 1, bottom, M.FUR, 2); p.set(x + 2, bottom, M.FUR, 1);
}

/** Wolf head (side view, facing left), (hx, hy) = the skull's centre. */
function wolfHeadSide(p, hx, hy, P) {
  const flat = P.ears === 'flat';
  // ears: two leaf-shaped points (laid back when flat)
  p.begin(null);
  // laid back: the same leaf-shaped ears, lying along the skull with their tips toward the neck
  if (flat) { p.set(hx + 1, hy - 3, M.FUR, 3); p.set(hx + 2, hy - 3, M.FUR, 3); p.set(hx + 3, hy - 3, M.FUR, 4); p.set(hx + 4, hy - 2, M.FUR, 3); p.set(hx + 2, hy - 2, M.FUR2, 1); }
  else {
    // two tall leaf-shaped points, the near one in front
    for (const [x0, lit] of [[hx + 2, 4], [hx, 3]]) {
      p.set(x0, hy - 2, M.FUR2, 1); p.set(x0 + 1, hy - 2, M.FUR, lit - 1);
      p.set(x0, hy - 3, M.FUR, lit - 1); p.set(x0 + 1, hy - 3, M.FUR2, 1);
      p.set(x0 + 1, hy - 4, M.FUR, lit); p.set(x0 + 1, hy - 5, M.FUR, lit);
    }
  }
  p.end();
  p.begin(null);
  blob(p, hx, hy, 3.6, 3, M.FUR, { hi: 0.35, lo: -0.3 });
  // the long muzzle: straw on the underside, a dark nose at the tip
  const open = P.mouth === 'open', snarl = P.mouth === 'snarl';
  for (let x = hx - 5; x <= hx - 2; x++) {
    p.set(x, hy, M.FUR, x === hx - 5 ? 2 : 3);
    p.set(x, hy + 1, M.FUR, x === hx - 5 ? 1 : 2);
    if (!open && x > hx - 5) p.set(x, hy + 2, M.FUR3, x < hx - 3 ? 2 : 1); // the straw chin
  }
  p.set(hx - 6, hy, M.NOSE, 2); p.set(hx - 6, hy + 1, M.NOSE, 1);
  if (open) {
    // jaws apart: the dark mouth between the muzzle and the dropped lower jaw, two white fangs
    for (let x = hx - 5; x <= hx - 2; x++) { p.set(x, hy + 2, M.EYE, 0); p.set(x, hy + 3, M.FUR3, x < hx - 3 ? 2 : 1); }
    p.set(hx - 5, hy + 3, M.FUR3, 1);
    p.set(hx - 4, hy + 2, M.BONE, 4); p.set(hx - 2, hy + 2, M.BONE, 3);
  } else if (snarl) {
    p.set(hx - 4, hy + 2, M.BONE, 4); p.set(hx - 3, hy + 1, M.EYE, 0); p.set(hx - 2, hy + 1, M.EYE, 0);
  } else {
    // closed: the upper fang still shows over the lip (every pose, like the open jaws' fangs)
    p.set(hx - 4, hy + 2, M.BONE, 4);
  }
  // cheek ruff: two leaf tips at the jaw
  p.set(hx + 2, hy + 3, M.FUR2, 1); p.set(hx + 3, hy + 2, M.FUR2, 2); p.set(hx + 1, hy + 3, M.FUR, 2);
  p.end();
  // the amber eye under a leaf brow
  p.begin(null);
  const ex = hx - 2, ey = hy - 1;
  // (the eye sits in a lit socket so it reads on the dark pelt; shut and dead eyes are a pale
  // straw lid line, never dark on dark)
  p.set(ex - 1, ey, M.FUR, 3); p.set(ex, ey + 1, M.FUR, 3);
  if (P.eye === 'shut') { p.set(ex, ey, M.FUR3, 3); p.set(ex + 1, ey, M.FUR3, 2); }
  else if (P.eye === 'dead') { p.set(ex, ey, M.FUR3, 2); p.set(ex + 1, ey + 1, M.FUR3, 2); p.set(ex + 1, ey - 1, M.FUR3, 2); }
  else { p.set(ex, ey, M.EYE, 3); p.set(ex + 1, ey, M.EYE, 1); if (P.eye === 'angry') { p.set(ex, ey - 1, M.FUR2, 0); p.set(ex + 1, ey - 1, M.FUR2, 0); } }
  p.end();
}

/** The tail: a leafy brush, `lift` raising it (−1 tucked … 2 straight out), straw at the tip. */
function wolfTail(p, x, y, lift) {
  // a brush hanging back and down (lift 2: straight out; −1: tucked under), 3 px deep, leaves
  // sticking out of its top edge, straw at the tip
  const drop = lift >= 2 ? [0, 0, 0, -1, -1] : lift >= 1 ? [0, 1, 1, 1, 2] : lift >= 0 ? [0, 1, 2, 3, 4] : [1, 2, 3, 5, 6];
  for (let i = 0; i < drop.length; i++) {
    const tx = x + i, ty = y + drop[i];
    const tip = i === drop.length - 1;
    for (let k = 0; k < 3; k++) {
      if (tip && k === 2) continue;
      p.set(tx, ty + k, tip ? M.FUR3 : k === 2 ? M.FUR2 : M.FUR, tip ? 3 - k : k === 0 ? 3 : k === 1 ? 2 : 1);
    }
    if (i % 2 === 1 && !tip) p.set(tx, ty - 1, M.FUR, 4);
  }
}

function drawWolf(p, view, key, f) {
  const P = WOLF_POSES[key];
  const G = f.G;
  const [hdx, hdy] = P.head ?? [0, 0];
  const bd = P.body ?? 0;
  if (view === 'side') {
    if (P.dead) {
      // on its side: the body flat on the ground, legs out toward the viewer, tail limp
      p.begin(null);
      wolfTail(p, 25, G - 4, -1);
      blob(p, 17, G - 3, 8.5, 3, M.FUR, { hi: 0.35, lo: -0.3 });
      p.end();
      p.begin(null); leafScales(p, 9, G - 6, 26, G); for (let x = 11; x <= 22; x += 2) maneLeaf(p, x, G - 6, 2, 1, 2); p.end();
      p.begin('all', 0);
      for (const lx of [12, 15, 20, 23]) { p.set(lx, G - 1, M.FUR, 2); p.set(lx + 1, G, M.FUR2, 1); p.set(lx + 2, G, M.FUR2, 1); }
      p.end();
      wolfHeadSide(p, 8, G - 3, { eye: 'dead', ears: 'flat' });
      return;
    }
    const gait = P.legs ? P.legs.map(([dx, lift]) => ({ dx, lift })) : quadGait({ walk: P.walk ?? -1 });
    const bodyY = 11 + bd;
    // tail and far legs (long and thin: a wolf stands tall)
    p.begin(null);
    wolfTail(p, 26, Math.round(bodyY - 2), P.tail ?? 0);
    wolfLegSide(p, 12, 13 + bd, G, gait[1].lift, gait[1].dx, true, false);
    wolfLegSide(p, 23, 13 + bd, G, gait[3].lift, gait[3].dx, true, true);
    p.end();
    // body: a deep chest, a tucked waist, the haunch; the neck rising to the head; straw belly
    p.begin(null);
    blob(p, 13, bodyY, 4.4, 3.4, M.FUR, { hi: 0.45, lo: -0.2 });
    blob(p, 19.5, bodyY + 0.2, 5.5, 2.3, M.FUR, { hi: 0.45, lo: -0.2 });
    blob(p, 24, bodyY - 0.2, 3, 2.8, M.FUR, { hi: 0.45, lo: -0.2 });
    const hx = 7 + hdx, hy = Math.round(bodyY - 5) + hdy;
    for (let t = 0; t <= 1.0001; t += 0.125) {
      const nx = Math.round(12 + (hx + 2 - 12) * t), ny = Math.round(bodyY - 1 + (hy + 1 - (bodyY - 1)) * t);
      for (let k = -1; k <= 1; k++) p.set(nx + k, ny, M.FUR, k < 0 ? 3 : k === 0 ? 2 : 1);
      p.set(nx, ny + 1, M.FUR, 2);
    }
    for (let x = 10; x <= 25; x++) p.over(x, Math.round(bodyY + (x < 16 ? 3 : 2)), M.FUR3, x < 16 ? 2 : 1);
    for (let y = Math.round(bodyY - 1); y <= Math.round(bodyY + 2); y++) p.over(10, y, M.FUR3, 2); // the straw throat
    p.end();
    p.begin(null);
    leafScales(p, 8, Math.round(bodyY - 5), 28, Math.round(bodyY + 3));
    // the mane: leaves along the back of the neck (placed on the neck line, so they follow the
    // head in every pose and never climb onto it) and along the spine, longest at the shoulders
    for (const [t, h] of [[0.35, 2], [0.65, 2]]) {
      const nx = Math.round(13 + (hx + 3 - 13) * t), ny = Math.round(bodyY - 2 + (hy + 1 - (bodyY - 2)) * t);
      maneLeaf(p, nx + 1, ny, h, 1, 2);
    }
    for (const [x, h] of [[13, 3], [15, 2], [17, 2], [19, 2], [21, 1], [23, 1]]) {
      let y = Math.round(bodyY - 4);
      while (y < bodyY && !p.get(x, y)) y++;
      maneLeaf(p, x, y, h, 1, x < 15 ? 2 : 1);
    }
    p.end();
    // near legs
    p.begin('sides', 1);
    wolfLegSide(p, 11, 13 + bd, G, gait[0].lift, gait[0].dx, false, false);
    wolfLegSide(p, 22, 13 + bd, G, gait[2].lift, gait[2].dx, false, true);
    p.end();
    wolfHeadSide(p, hx, hy, P);
    return;
  }
  const cx = 16;
  const back = view === 'up';
  if (P.dead) {
    p.begin(null);
    blob(p, cx, G - 3, 9, 3, M.FUR, { hi: 0.35, lo: -0.3 });
    p.end();
    p.begin(null); leafScales(p, cx - 9, G - 6, cx + 9, G); for (let x = cx - 6; x <= cx + 5; x += 2) maneLeaf(p, x, G - 6, 2, 1, 2); p.end();
    p.begin('all', 0);
    for (const [lx, d] of [[6, -1], [8, -1], [24, 1], [26, 1]]) { p.set(lx, G - 1, M.FUR, 2); p.set(lx + d, G, M.FUR2, 1); }
    if (!back) { p.set(cx - 2, G - 4, M.FUR3, 2); p.set(cx - 1, G - 3, M.FUR3, 2); p.set(cx + 2, G - 4, M.FUR3, 2); p.set(cx + 1, G - 3, M.FUR3, 2); }
    p.end();
    return;
  }
  const walkL = P.walk === 0 || P.walk === 1 ? 1 : 0, walkR = P.walk === 2 || P.walk === 3 ? 1 : 0;
  const lift = [walkL, walkR];
  const spread = key === 'windup' ? 1 : 0;
  if (back) {
    // from behind: ears over the shoulders, the haunches, the leaf ridge down the spine, the tail
    p.begin(null);
    for (const sgn of [-1, 1]) { const ex = cx + sgn * 3 - (sgn > 0 ? 1 : 0); p.set(ex, 2 + bd, M.FUR, 4); p.set(ex, 3 + bd, M.FUR, 3); p.set(ex + sgn, 3 + bd, M.FUR2, 2); p.set(ex, 4 + bd, M.FUR2, 2); }
    blob(p, cx, 6.5 + bd, 3.6, 2.6, M.FUR, { hi: 0.4, lo: -0.1 });
    p.end();
    p.begin(null);
    wolfLegFront(p, 12, 15 + bd, G, lift[0], -1, true);
    wolfLegFront(p, 18, 15 + bd, G, lift[1], 1, true);
    p.end();
    p.begin('below', 1);
    blob(p, cx, 12 + bd, 5.6, 4.4, M.FUR, { hi: 0.45, lo: -0.25 });
    p.end();
    p.begin(null);
    leafScales(p, cx - 7, 4 + bd, cx + 7, 17 + bd);
    for (let y = 6 + bd; y <= 13 + bd; y += 2) maneLeaf(p, cx - 1 + ((y >> 1) & 1), y, 2, 0, 2);
    p.end();
    p.begin('all', 1);
    const tl = key === 'windup' || key === 'attack' || key === 'hurt' ? P.tail ?? 0 : 0;
    for (let i = 0; i < 6; i++) {
      const ty = 14 + bd + (tl < 0 ? i : tl >= 1 ? -i * 0.5 : i * 0.5);
      const tip = i >= 4;
      for (let k = -1; k <= 1; k++) p.set(cx + k, Math.round(ty), tip ? M.FUR3 : k === 1 ? M.FUR2 : M.FUR, tip ? 3 - (k + 1) : k < 0 ? 3 : 2);
    }
    p.end();
    return;
  }
  // facing the camera: long forelegs, a narrow chest with a straw bib, the head above on its neck
  p.begin(null);
  // (the haunches peek out wider behind the shoulders)
  blob(p, cx, 14 + bd, 6, 3, M.FUR, { hi: 0.3, lo: -0.4, maxShade: 2 });
  p.end();
  p.begin('sides', 1);
  wolfLegFront(p, 12 - spread, 14 + bd, G, lift[0], -1, false);
  wolfLegFront(p, 18 + spread, 14 + bd, G, lift[1], 1, false);
  p.end();
  p.begin(null);
  blob(p, cx, 13 + bd, 5.4, 4, M.FUR, { hi: 0.45, lo: -0.2 });
  p.end();
  p.begin(null); leafScales(p, cx - 8, 9 + bd, cx + 8, 17 + bd); p.end();
  const hy = 8 + hdy + bd;
  const hx = cx + Math.sign(hdx);
  // the ruff: leaf tips fanning round the throat
  p.begin(null);
  for (const [dx, dy, s] of [[-4, 2, 2], [-4, 3, 1], [-3, 4, 2], [4, 2, 1], [4, 3, 1], [3, 4, 1], [-2, 5, 2], [2, 5, 1]]) p.set(hx + dx, hy + dy, M.FUR2, s);
  p.end();
  p.begin('all', 1);
  blob(p, hx, hy, 3.3, 2.8, M.FUR, { hi: 0.35, lo: -0.3 });
  const flat = P.ears === 'flat';
  for (const sgn of [-1, 1]) {
    const ex = hx + sgn * 2 - (sgn > 0 ? 1 : 0);
    if (flat) { p.set(ex, hy - 3, M.FUR, sgn < 0 ? 3 : 2); p.set(ex + sgn, hy - 3, M.FUR, sgn < 0 ? 4 : 3); p.set(ex + sgn * 2, hy - 2, M.FUR, 2); }
    else { p.set(ex, hy - 3, M.FUR, sgn < 0 ? 3 : 2); p.set(ex, hy - 4, M.FUR, 3); p.set(ex, hy - 5, M.FUR, 4); p.set(ex + sgn, hy - 3, M.FUR2, 1); p.set(ex + sgn, hy - 2, M.FUR, 2); }
  }
  p.end();
  p.begin(null);
  leafScales(p, hx - 3, hy - 2, hx + 3, hy);
  // the muzzle toward the viewer: straw, a dark nose, the mouth
  for (let y = hy + 1; y <= hy + 3; y++) for (let x = hx - 2; x <= hx + 1; x++) {
    if (y === hy + 3 && (x === hx - 2 || x === hx + 1)) continue;
    p.set(x, y, y === hy + 1 ? M.FUR : M.FUR3, y === hy + 1 ? 3 : x < hx ? 2 : 1);
  }
  p.set(hx - 1, hy + 1, M.NOSE, 2); p.set(hx, hy + 1, M.NOSE, 1);
  // straw cheeks either side of the muzzle: the face's light mask
  p.set(hx - 3, hy + 1, M.FUR3, 2); p.set(hx + 2, hy + 1, M.FUR3, 1);
  if (P.mouth === 'open') { p.set(hx - 1, hy + 4, M.EYE, 0); p.set(hx, hy + 4, M.EYE, 0); }
  // the two fangs at the muzzle's corners, in every pose
  p.set(hx - 2, hy + 3, M.BONE, 4); p.set(hx + 1, hy + 3, M.BONE, 3);
  p.end();
  p.begin(null);
  const ey = hy - 1;
  for (const ex of [hx - 2, hx + 1]) {
    const out = ex < hx ? -1 : 1;
    p.set(ex + out, ey, M.FUR, 3); // the lit socket
    if (P.eye === 'shut') { p.set(ex, ey, M.FUR3, 3); p.set(ex + out, ey, M.FUR3, 2); }
    else { p.set(ex, ey, M.EYE, 3); if (P.eye === 'angry') p.set(ex + out, ey - 1, M.FUR2, 0); }
  }
  p.end();
}

// ---------------------------------------------------------------------------
// A Fera Maculada (kind `fera`) — a giant iguana corrupted by the Baiacu Rei, the Ato I boss
// (64 × 64):
// dull olive scales with dark bands, the iguana's round cheek shield, a crest of the puffer's
// bone-white spines with dark tips, a swollen dewlap studded with spines, salt crystals breaking
// out of the back and toxin veins glowing sea-teal (glow texels), long clawed sprawling legs and a
// banded tail curled up behind. `puff` is the puffer's power: every spine up, the body swollen.
// ---------------------------------------------------------------------------

/** Per pose: head offset, jaw opening, dewlap size, crest scale, body drop, swelling, glow, eyes, legs, tail. */
function feraRig(key) {
  const R = {
    head: [0, 0], jaw: 0, dew: 1, crest: 1, body: 0, swell: 0, glow: 3, eye: 'open', tail: 'rest',
    // feet: [dx, lift] for near front, far front, near hind, far hind
    legs: { nf: [0, 0], ff: [0, 0], nh: [0, 0], fh: [0, 0] },
  };
  switch (key) {
    case 'idle1': R.head = [0, 1]; R.dew = 1.3; R.glow = 2; break;
    // a sprawling walk: the diagonal pairs swing together, the body swaying low
    case 'move0': R.legs = { nf: [-3, 2], ff: [2, 0], nh: [2, 0], fh: [-3, 2] }; break;
    case 'move1': R.body = 1; R.legs = { nf: [-1, 0], ff: [0, 1], nh: [0, 1], fh: [-1, 0] }; break;
    case 'move2': R.legs = { nf: [2, 0], ff: [-3, 2], nh: [-3, 2], fh: [2, 0] }; break;
    case 'move3': R.body = 1; R.legs = { nf: [0, 1], ff: [-1, 0], nh: [-1, 0], fh: [0, 1] }; break;
    case 'windup': R.head = [3, -4]; R.jaw = 1; R.dew = 2; R.crest = 1.3; R.glow = 4; R.legs = { nf: [1, 0], ff: [1, 0], nh: [-1, 0], fh: [-1, 0] }; break;
    case 'attack': R.head = [0, 3]; R.jaw = 4; R.dew = 1; R.crest = 1.2; R.glow = 4; R.body = 1; R.legs = { nf: [-3, 0], ff: [-2, 0], nh: [2, 0], fh: [2, 0] }; break;
    case 'hurt': R.head = [3, -3]; R.jaw = 2; R.crest = 0.7; R.eye = 'shut'; R.glow = 2; break;
    case 'dead': R.dead = true; R.glow = 1; R.eye = 'dead'; break;
    case 'tailWind': R.tail = 'raised'; R.head = [1, -1]; R.crest = 1.2; R.glow = 4; R.legs = { nf: [-1, 0], ff: [0, 0], nh: [1, 0], fh: [0, 0] }; break;
    case 'tailSwipe': R.tail = 'swipe'; R.head = [-1, 1]; R.glow = 4; R.body = 1; R.legs = { nf: [1, 0], ff: [0, 0], nh: [-2, 0], fh: [-1, 0] }; break;
    case 'puff': R.swell = 2; R.crest = 1.7; R.dew = 2.6; R.jaw = 2; R.glow = 4; R.head = [1, -2]; break;
    default: break;
  }
  return R;
}

/** One spine of the crest: bone-white, its dark tip leaning back (`lean` px over its height). */
function feraSpine(p, x, y, h, lean, glowTip) {
  // a puffer spine: a 2 px base tapering to a 1 px point, lit on its left, the tip dark
  for (let i = 0; i < h; i++) {
    const t = i / Math.max(1, h - 1);
    const xx = Math.round(x + lean * t);
    const tip = i >= h - 1;
    if (tip && glowTip) p.set(xx, y - i, M.GLOW, 3);
    else p.set(xx, y - i, tip ? M.FUR2 : M.BONE, tip ? 0 : 3);
    if (i < h / 2 && !tip) p.set(xx + 1, y - i, M.BONE, 1);
  }
}

/** A salt crystal cluster breaking out of the hide at (x, y): 2–3 pale shards, a toxin glow at the root. */
function saltCrystals(p, x, y, size, glow) {
  const shards = [[0, 0, size + 2, 0], [-2, 1, size, -1], [2, 1, size - 1, 1]];
  for (const [dx, dy, h, lean] of shards) {
    if (h < 2) continue;
    for (let i = 0; i < h; i++) {
      const xx = Math.round(x + dx + lean * i / h), yy = y + dy - i;
      const w = i < h - 1 ? 1 : 0;
      p.set(xx, yy, M.STONE, i === h - 1 ? 4 : 3);
      if (w) p.set(xx + 1, yy, M.STONE, i < h / 2 ? 1 : 2);
    }
  }
  if (glow >= 2) { p.set(x, y + 1, M.GLOW, Math.min(4, glow)); p.set(x + 1, y + 1, M.GLOW, Math.max(1, glow - 1)); }
}

/** Scales over what is painted in `mat`: a staggered lattice of lit and shadowed scale edges. */
function feraScales(p, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (p.get(x, y) !== M.FUR) continue;
      const k = (x + ((y >> 1) & 1) * 2) % 4;
      const sh = p.getShade(x, y);
      if ((y & 1) === 0 && k === 0) p.set(x, y, M.FUR, Math.min(4, sh + 1));
      else if ((y & 1) === 1 && k === 2 && sh > 0) p.set(x, y, M.FUR2, Math.max(1, sh));
    }
  }
}

/**
 * A sprawling lizard leg (side view, facing left): from the shoulder or hip out to the elbow or
 * knee, down to the foot, long toes and bone claws pointing forward. Far legs are a step darker.
 */
function feraLegSide(p, sx, sy, ex, ey, fx, fy, far, hind) {
  const d = far ? 1 : 0;
  thickLine(p, sx, sy, ex, ey, hind ? 6 : 5, M.FUR, (t, x, y) => Math.max(0, (y < (sy + ey) / 2 ? 3 : 2) - d));
  thickLine(p, ex, ey, fx, fy - 1, 4, M.FUR, (t, x) => Math.max(0, (x <= Math.min(ex, fx) + 1 ? 3 : 2) - d));
  // the foot: three long toes splayed forward, a claw on each
  for (const [tx, ty] of [[-4, 0], [-3, -1], [-1, 0]]) {
    p.line2(fx, fy - 1, fx + tx, fy + ty, M.FUR2, Math.max(0, 2 - d));
    p.set(fx + tx - 1, fy + ty, M.BONE, far ? 2 : 4);
  }
  p.set(fx + 2, fy, M.FUR2, Math.max(0, 1 - d)); p.set(fx + 3, fy, M.BONE, far ? 1 : 3); // the back toe
}

/** The tail's centre line (side view), from the hip to the tip, by pose. */
function feraTailPath(tail, bx, by) {
  if (tail === 'raised') return [[bx, by], [bx + 5, by - 3], [bx + 8, by - 9], [bx + 9, by - 16], [bx + 7, by - 22], [bx + 3, by - 25], [bx - 1, by - 24]];
  if (tail === 'swipe') return [[bx, by], [bx + 5, by + 3], [bx + 9, by + 7], [bx + 12, by + 10], [bx + 13, by + 13]];
  return [[bx, by], [bx + 5, by + 1], [bx + 9, by - 1], [bx + 12, by - 5], [bx + 12, by - 10], [bx + 10, by - 14], [bx + 7, by - 15]];
}

function drawFeraSide(p, R) {
  const G = 61;
  const bd = R.body, sw = R.swell;
  const [hdx, hdy] = R.head;
  if (R.dead) {
    // keeled over: the body flat, legs curled up, the crest laid along the ground, the glow out
    p.begin(null);
    thickLine(p, 46, G - 5, 60, G - 3, 4, M.FUR, 2);
    blob(p, 31, G - 6, 17, 5, M.FUR, { hi: 0.35, lo: -0.3 });
    for (let x = 16; x <= 46; x++) p.over(x, G - 2, M.FUR3, 1);
    p.end();
    p.begin(null);
    feraScales(p, 12, G - 12, 60, G);
    for (let x = 18; x <= 44; x += 3) feraSpine(p, x, G - 11, 3, 2, false);
    saltCrystals(p, 30, G - 11, 2, 1); saltCrystals(p, 40, G - 10, 1, 1);
    p.end();
    p.begin('all', 0);
    for (const [lx, ly] of [[20, G - 10], [27, G - 11], [37, G - 11], [44, G - 10]]) { p.line2(lx, ly, lx + 2, ly - 3, M.FUR, 2); p.set(lx + 3, ly - 4, M.BONE, 3); }
    p.end();
    p.begin(null);
    blob(p, 11, G - 5, 7, 3.6, M.FUR, { hi: 0.35, lo: -0.3 });
    for (let x = 3; x <= 11; x++) p.set(x, G - 3, M.FUR3, 1);
    p.set(8, G - 7, M.FUR3, 2); p.set(9, G - 6, M.FUR3, 2); p.set(9, G - 8, M.FUR3, 2); p.set(7, G - 6, M.FUR3, 2); // the eye, crossed out
    p.end();
    return;
  }
  const by = 45 + bd;
  // far legs, behind everything
  p.begin(null);
  const L = R.legs;
  feraLegSide(p, 27, by + 2, 30 + L.ff[0] * 0.5, by + 8 - L.ff[1], 29 + L.ff[0], G - L.ff[1], true, false);
  feraLegSide(p, 40, by + 2, 37 + L.fh[0] * 0.5, by + 9 - L.fh[1], 38 + L.fh[0], G - L.fh[1], true, true);
  p.end();
  // the tail: banded, tapering, curled up behind
  p.begin(null);
  const tp = feraTailPath(R.tail, 47, by - 1);
  for (let i = 0; i + 1 < tp.length; i++) {
    const w = Math.max(1.4, 6.5 - i * 1.0);
    thickLine(p, tp[i][0], tp[i][1], tp[i + 1][0], tp[i + 1][1], w, M.FUR, (t) => ((i * 4 + Math.round(t * 4)) % 4 === 3 ? 1 : 2));
  }
  p.end();
  p.begin(null);
  for (let i = 1; i + 1 < tp.length; i++) feraSpine(p, tp[i][0], Math.round(tp[i][1] - Math.max(1, 3 - i * 0.5)), Math.max(2, Math.round((4 - i * 0.5) * R.crest)), 1, false);
  p.end();
  // the body: chest, swollen belly, hips; the pale underside
  p.begin(null);
  blob(p, 24, by, 8 + sw, 6.5 + sw, M.FUR, { hi: 0.45, lo: -0.2 });
  blob(p, 34, by + 1, 10 + sw, 7 + sw, M.FUR, { hi: 0.45, lo: -0.2 });
  blob(p, 44, by, 6.5 + sw, 6 + sw * 0.5, M.FUR, { hi: 0.45, lo: -0.2 });
  for (let x = 18; x <= 47; x++) { p.over(x, by + 6 + sw, M.FUR3, 1); p.over(x, by + 5 + sw, M.FUR3, 2); }
  p.end();
  p.begin(null);
  feraScales(p, 14, by - 9, 52, by + 8);
  // the dark bands across the back
  for (const bx of [28, 36, 43]) for (let y = by - 5; y <= by + 2; y++) if ((y & 1) === 0 || y > by - 2) p.over(bx + ((y >> 1) & 1), y, M.FUR2, 2);
  // toxin veins glowing through the flank
  crack(p, [[24, by + 1], [28, by + 3], [32, by + 2], [36, by + 4]], Math.min(4, R.glow));
  crack(p, [[38, by + 1], [42, by + 3], [45, by + 2]], Math.max(1, R.glow - 1));
  p.end();
  // the crest along the neck and the back: puffer spines, longest at the shoulders
  p.begin(null);
  const crestTop = (x) => { let y = by - 12 - sw; while (y < by && !p.get(x, y)) y++; return y; };
  for (let x = 23; x <= 48; x += 3) {
    const h = Math.round((x < 30 ? 6 : x < 40 ? 5 : 3) * R.crest);
    feraSpine(p, x, crestTop(x), h, R.crest > 1.4 ? 0 : 1, R.glow >= 4 && (x % 6 === 0));
  }
  saltCrystals(p, 31, crestTop(31) + 1, 3 + sw, R.glow);
  saltCrystals(p, 41, crestTop(41) + 1, 2 + sw, R.glow);
  saltCrystals(p, 24, by + 1, 1, R.glow - 1);
  p.end();
  // near legs
  p.begin('sides', 1);
  feraLegSide(p, 21, by + 3, 18 + L.nf[0] * 0.5, by + 9 - L.nf[1], 20 + L.nf[0], G - L.nf[1], false, false);
  feraLegSide(p, 44, by + 3, 49 + L.nh[0] * 0.5, by + 9 - L.nh[1], 45 + L.nh[0], G - L.nh[1], false, true);
  p.end();
  // neck and head
  const hx = 13 + hdx, hy = 39 + hdy + bd;
  p.begin(null);
  thickLine(p, 22, by - 2, hx + 4, hy + 2, 9 + sw, M.FUR, (t, x, y) => (y < hy ? 3 : 2));
  p.end();
  p.begin(null);
  // the dewlap: a swollen throat fan, pale, spined along its edge (bigger as it inflates)
  const dw = R.dew;
  const dpts = [[hx - 4, hy + 3], [hx + 4, hy + 3], [hx + 6, hy + 5 + dw], [hx + 2, hy + 7 + dw * 3], [hx - 2, hy + 6 + dw * 2]];
  fillPoly(p, dpts, M.FUR3, (x, y) => (x < hx ? 3 : 2));
  for (const [x, y] of [[hx + 3, hy + 6 + dw * 2.5], [hx - 1, hy + 6 + dw * 2], [hx + 6, hy + 5 + dw]]) p.set(Math.round(x), Math.round(y + 1), M.BONE, 4);
  if (dw >= 2) crack(p, [[hx - 1, hy + 5], [hx + 2, hy + 7], [hx + 4, hy + 6]], 3);
  p.end();
  p.begin(null);
  blob(p, hx, hy, 7.5, 4.6, M.FUR, { hi: 0.4, lo: -0.25 });
  // the snout: long and blunt, the nostril near its tip
  fillPoly(p, [[hx - 5, hy - 3], [hx - 10, hy - 1], [hx - 10, hy + 2], [hx - 5, hy + 3]], M.FUR, (x, y) => (y < hy - 1 ? 3 : y > hy + 1 ? 1 : 2));
  p.set(hx - 9, hy - 1, M.FUR2, 0);
  // the jaw: shut (a dark line) or dropped open with teeth and a dark red mouth
  const j = R.jaw;
  if (j <= 0) for (let x = hx - 10; x <= hx + 2; x++) p.set(x, hy + 2, M.FUR2, x < hx - 2 ? 0 : 1);
  else {
    fillPoly(p, [[hx - 10, hy + 2], [hx + 2, hy + 2], [hx + 2, hy + 2 + j], [hx - 9, hy + 2 + j * 1.4]], M.NOSE, (x, y) => (y === Math.round(hy + 2) ? 0 : 1));
    for (let x = hx - 9; x <= hx + 1; x++) p.set(x, Math.round(hy + 3 + j * 1.4 - (x - hx + 9) * 0.04 * j), M.FUR, 1);
    for (let x = hx - 9; x <= hx; x += 2) { p.set(x, hy + 3, M.BONE, 4); p.set(x + 1, Math.round(hy + 2 + j * 1.3), M.BONE, 3); }
  }
  // the cheek shield: the iguana's big round scale behind the jaw
  for (const [dx, dy, sh] of [[3, 1, 4], [4, 1, 3], [3, 2, 3], [4, 2, 2], [2, 1, 3], [3, 0, 3]]) p.set(hx + dx, hy + dy, M.FUR3, sh);
  p.end();
  p.begin(null);
  feraScales(p, hx - 10, hy - 5, hx + 8, hy + 2);
  // the eye: a toxin-teal glow with a dark slit, under a heavy brow
  const ex = hx - 3, ey = hy - 2;
  p.set(ex - 1, ey - 1, M.FUR2, 0); p.set(ex, ey - 1, M.FUR2, 0); p.set(ex + 1, ey - 1, M.FUR2, 1);
  if (R.eye === 'shut') { p.set(ex - 1, ey, M.FUR3, 2); p.set(ex, ey, M.FUR3, 2); p.set(ex + 1, ey, M.FUR3, 1); }
  else { p.set(ex - 1, ey, M.GLOW, Math.min(4, R.glow)); p.set(ex, ey, M.FUR2, 0); p.set(ex + 1, ey, M.GLOW, Math.max(1, R.glow - 1)); p.set(ex, ey + 1, M.GLOW, 2); }
  // head spines: a short crest from the brow back onto the neck
  for (const [dx, h] of [[1, 2], [3, 3], [5, 3]]) feraSpine(p, hx + dx, hy - 4, Math.round(h * R.crest), 1, false);
  saltCrystals(p, hx + 1, hy - 4, 1, R.glow - 1);
  p.end();
}

/** Facing the camera (front) or from behind (back). */
function drawFeraFront(p, R, back) {
  const G = 61, cx = 32;
  const bd = R.body, sw = R.swell;
  if (R.dead) {
    p.begin(null);
    blob(p, cx, G - 6, 18, 5, M.FUR, { hi: 0.35, lo: -0.3 });
    p.end();
    p.begin(null);
    feraScales(p, cx - 19, G - 12, cx + 19, G);
    for (let x = cx - 12; x <= cx + 12; x += 3) feraSpine(p, x, G - 11, 3, 1, false);
    saltCrystals(p, cx - 6, G - 11, 2, 1); saltCrystals(p, cx + 7, G - 10, 1, 1);
    p.end();
    p.begin('all', 0);
    for (const [lx, d] of [[10, -1], [14, -1], [50, 1], [54, 1]]) { p.line2(lx, G - 7, lx + d * 3, G - 10, M.FUR, 2); p.set(lx + d * 4, G - 11, M.BONE, 3); }
    if (!back) { p.set(cx - 4, G - 8, M.FUR3, 2); p.set(cx - 3, G - 7, M.FUR3, 2); p.set(cx + 4, G - 8, M.FUR3, 2); p.set(cx + 3, G - 7, M.FUR3, 2); }
    p.end();
    return;
  }
  const L = R.legs;
  // legs: sprawled out to both sides, elbows and knees high, clawed feet planted wide
  const leg = (sx, sy, out, foot, far) => {
    const [dx, lift] = foot;
    const ex = sx + out * 5, ey = sy + 3;
    const fx = sx + out * 6 + dx, fy = G - lift;
    thickLine(p, sx, sy, ex, ey, far ? 4 : 5, M.FUR, (t, x, y) => (y < ey ? 3 : 2) - (far ? 1 : 0));
    thickLine(p, ex, ey, fx, fy - 1, far ? 3 : 4, M.FUR, (t) => (t < 0.5 ? 2 : 1) - (far ? 1 : 0));
    for (const tx of [-2, 0, 2]) { p.set(fx + tx, fy, M.FUR2, 1); p.set(fx + tx + Math.sign(tx || out), fy, M.BONE, far ? 2 : 4); }
  };
  p.begin(null);
  // (the far pair: the hind legs from the front, the forelegs from behind)
  leg(cx - 10, 47 + bd, -1, back ? L.nf : L.nh, true);
  leg(cx + 10, 47 + bd, 1, back ? L.ff : L.fh, true);
  p.end();
  if (back) {
    // from behind: the tail comes toward the viewer down the middle, banded, tapering
    p.begin(null);
    const sway = R.tail === 'raised' ? -4 : R.tail === 'swipe' ? 6 : 0;
    for (let i = 0; i < 6; i++) {
      const y = 50 + bd + i * 2, x = cx + Math.round(sway * i / 5);
      thickLine(p, x, y, cx + Math.round(sway * (i + 1) / 5), y + 2, Math.max(2, 7 - i), M.FUR, i % 2 ? 1 : 2);
    }
    p.end();
  }
  p.begin(null);
  blob(p, cx, 47 + bd, 14 + sw, 6.5 + sw, M.FUR, { hi: 0.45, lo: -0.2 });
  if (!back) for (let y = 49 + bd; y <= 53 + bd + sw; y++) for (let x = cx - 6; x <= cx + 6; x++) p.over(x, y, M.FUR3, x < cx ? 2 : 1); // the pale chest
  p.end();
  p.begin(null);
  feraScales(p, cx - 16, 38 + bd, cx + 16, 55 + bd);
  for (const x of [cx - 8, cx + 7]) for (let y = 42 + bd; y <= 50 + bd; y += 2) p.over(x, y, M.FUR2, 1);
  crack(p, [[cx - 11, 48 + bd], [cx - 7, 50 + bd], [cx - 3, 49 + bd]], Math.min(4, R.glow));
  crack(p, [[cx + 3, 50 + bd], [cx + 7, 48 + bd], [cx + 11, 50 + bd]], Math.max(1, R.glow - 1));
  p.end();
  // the crest: puffer spines down the spine (from behind), or rising behind the head (from the front)
  p.begin(null);
  const n = back ? 9 : 5;
  for (let i = 0; i < n; i++) {
    const y = (back ? 34 : 38) + bd + i * (back ? 2.2 : 1.4);
    const h = Math.round((back ? 6 - i * 0.45 : 6 - i * 0.6) * R.crest);
    feraSpine(p, cx + (i % 2 ? 1 : -1), Math.round(y), Math.max(2, h), 0, R.glow >= 4 && i % 3 === 0);
  }
  saltCrystals(p, cx - 9, 42 + bd - sw, 3 + sw, R.glow);
  saltCrystals(p, cx + 9, 43 + bd - sw, 2 + sw, R.glow);
  p.end();
  // near legs
  p.begin('sides', 1);
  leg(cx - 8, 49 + bd, -1, back ? L.nh : L.nf, false);
  leg(cx + 8, 49 + bd, 1, back ? L.fh : L.ff, false);
  p.end();
  const [hdx, hdy] = R.head;
  if (back) {
    // the back of the head, its crest of spines, the cheek shields at its sides
    const hy = 36 + bd + Math.min(0, hdy);
    p.begin('below', 1);
    blob(p, cx, hy, 8, 5, M.FUR, { hi: 0.4, lo: -0.2 });
    p.end();
    p.begin(null);
    feraScales(p, cx - 8, hy - 5, cx + 8, hy + 4);
    for (const [dx, h] of [[-3, 3], [-1, 5], [1, 5], [3, 3]]) feraSpine(p, cx + dx, hy - 3, Math.round(h * R.crest), 0, false);
    p.set(cx - 7, hy + 1, M.FUR3, 3); p.set(cx + 7, hy + 1, M.FUR3, 2);
    p.end();
    return;
  }
  // the head facing the camera: a broad blunt snout, eyes at the sides, the dewlap hanging below
  const hx = cx + Math.sign(hdx), hy = 37 + bd + Math.round(hdy * 0.7);
  p.begin(null);
  const dw = R.dew;
  fillPoly(p, [[hx - 4, hy + 4], [hx + 4, hy + 4], [hx + 3, hy + 7 + dw * 2.4], [hx, hy + 9 + dw * 3], [hx - 3, hy + 7 + dw * 2.4]], M.FUR3, (x) => (x < hx ? 3 : 2));
  p.set(hx, Math.round(hy + 10 + dw * 3), M.BONE, 4); p.set(hx - 3, Math.round(hy + 7 + dw * 2.4), M.BONE, 3); p.set(hx + 3, Math.round(hy + 7 + dw * 2.4), M.BONE, 3);
  if (dw >= 2) crack(p, [[hx - 2, hy + 6], [hx, hy + 8], [hx + 2, hy + 6]], 3);
  p.end();
  p.begin('all', 1);
  blob(p, hx, hy, 8, 5.5, M.FUR, { hi: 0.35, lo: -0.3 });
  p.end();
  p.begin(null);
  feraScales(p, hx - 8, hy - 6, hx + 8, hy + 3);
  // the cheek shields
  for (const sgn of [-1, 1]) { p.set(hx + sgn * 7, hy + 1, M.FUR3, sgn < 0 ? 4 : 3); p.set(hx + sgn * 7, hy + 2, M.FUR3, 2); p.set(hx + sgn * 6, hy + 1, M.FUR3, 3); p.set(hx + sgn * 6, hy + 2, M.FUR3, 3); }
  // the snout and mouth
  for (let x = hx - 3; x <= hx + 3; x++) p.set(x, hy + 2, M.FUR, x < hx ? 3 : 2);
  p.set(hx - 2, hy + 1, M.FUR2, 0); p.set(hx + 2, hy + 1, M.FUR2, 0); // nostrils
  const j = R.jaw;
  if (j <= 0) for (let x = hx - 4; x <= hx + 4; x++) p.set(x, hy + 3, M.FUR2, 0);
  else {
    for (let y = hy + 3; y <= hy + 3 + Math.min(3, j); y++) for (let x = hx - 3; x <= hx + 3; x++) p.set(x, y, M.NOSE, y === hy + 3 ? 0 : 1);
    for (const x of [hx - 3, hx - 1, hx + 1, hx + 3]) p.set(x, hy + 3, M.BONE, 4);
  }
  // the eyes at the sides of the head, toxin-teal
  for (const sgn of [-1, 1]) {
    const ex = hx + sgn * 5, ey = hy - 1;
    p.set(ex, ey - 1, M.FUR2, 0); p.set(ex - sgn, ey - 1, M.FUR2, 0);
    if (R.eye === 'shut') { p.set(ex, ey, M.FUR3, 2); p.set(ex - sgn, ey, M.FUR3, 2); }
    else { p.set(ex, ey, M.GLOW, Math.min(4, R.glow)); p.set(ex - sgn, ey, M.FUR2, 0); }
  }
  // the head's own little crest, peeking over the brow
  for (const [dx, h] of [[-2, 2], [0, 3], [2, 2]]) feraSpine(p, hx + dx, hy - 5, Math.round(h * R.crest), 0, false);
  p.end();
}

function drawFera(p, view, key) {
  const R = feraRig(key);
  if (view === 'side') drawFeraSide(p, R);
  else drawFeraFront(p, R, view === 'up');
}

// ---------------------------------------------------------------------------
// Shark (the shark boss, kind `shark`) — a giant humanoid great white with a rusted anchor (96 ×
// 96, the boss size planned for the dragon): blue-grey hide over a white belly, a shark's head with
// rows of teeth, gills and orange eyes, the dorsal fin on its back, the tail fin reaching the
// ground; a barnacled shell pauldron with coral on its right shoulder, a leather strap across the
// chest, a torn hide kilt, rope wrapped round the forearms, barnacled boots with claws. The anchor
// (rust, rope, seaweed) is held two-handed: carried, raised and slammed down, swung wide.
// ---------------------------------------------------------------------------

/**
 * Per pose, in the front view's coordinates (96 × 96, ground 93): body drop, lean, head offset,
 * mouth (0 shut … 3 roaring), eyes, the two hands, the anchor's ring and crown, the feet.
 */
function sharkRig(key) {
  const R = {
    bob: 0, lean: 0, head: [0, 0], mouth: 1, eye: 'open',
    hands: [[66, 56], [70, 64]], ring: [74, 30], crown: [70, 88],
    feet: [[35, 0], [61, 0]], dead: false,
  };
  switch (key) {
    case 'idle1': R.bob = 1; R.mouth = 0; R.hands = [[66, 57], [70, 65]]; break;
    case 'move0': R.feet = [[33, 3], [62, 0]]; R.bob = -1; break;
    case 'move1': R.bob = 1; break;
    case 'move2': R.feet = [[35, 0], [64, 3]]; R.bob = -1; break;
    case 'move3': R.bob = 1; break;
    // the slam: the anchor raised high over the head, then brought down in front
    case 'windup': R.bob = -1; R.lean = 1; R.mouth = 2; R.hands = [[44, 20], [52, 18]]; R.ring = [42, 26]; R.crown = [76, 6]; break;
    case 'attack': R.bob = 4; R.mouth = 3; R.hands = [[44, 60], [52, 64]]; R.ring = [46, 52]; R.crown = [44, 90]; R.feet = [[31, 0], [65, 0]]; break;
    // the sweep: drawn back to its right, then swung wide across
    case 'sweepWind': R.lean = 2; R.mouth = 2; R.hands = [[66, 50], [74, 52]]; R.ring = [62, 50]; R.crown = [92, 58]; break;
    case 'sweep': R.lean = -2; R.mouth = 3; R.hands = [[30, 54], [24, 56]]; R.ring = [34, 54]; R.crown = [4, 62]; R.feet = [[33, 0], [63, 0]]; break;
    case 'roar': R.bob = -1; R.head = [0, -3]; R.mouth = 3; R.hands = [[78, 56], [18, 46]]; R.ring = [80, 40]; R.crown = [78, 88]; break;
    case 'hurt': R.head = [2, -2]; R.lean = 2; R.mouth = 2; R.eye = 'shut'; R.hands = [[68, 58], [72, 66]]; R.ring = [78, 34]; R.crown = [72, 89]; break;
    case 'dead': R.dead = true; R.eye = 'dead'; break;
    default: break;
  }
  return R;
}

/** The anchor from its ring to its crown: shaft, stock, two barbed flukes, rust, rope and weed. */
function drawAnchor(p, ring, crown, w = 4) {
  const [rx, ry] = ring, [cx, cy] = crown;
  const len = Math.hypot(cx - rx, cy - ry) || 1;
  const ux = (cx - rx) / len, uy = (cy - ry) / len; // along the shaft, ring → crown
  const nx = -uy, ny = ux; // across it
  const rust = (t, x, y) => ((x * 3 + y * 5) % 11 === 0 ? 1 : (x + y) % 2 ? 2 : 3);
  // the stock: a bar across the shaft near the ring
  const sx = rx + ux * 6, sy = ry + uy * 6;
  thickLine(p, sx - nx * 9, sy - ny * 9, sx + nx * 9, sy + ny * 9, 3, M.METAL, (t) => (t < 0.5 ? 3 : 2));
  // the shaft
  thickLine(p, rx + ux * 3, ry + uy * 3, cx, cy, w, M.METAL, rust);
  // the flukes: arms sweeping back from the crown, barbed palms at their tips
  for (const sgn of [-1, 1]) {
    const tx = cx + nx * sgn * 11 - ux * 8, ty = cy + ny * sgn * 11 - uy * 8;
    thickLine(p, cx, cy, cx + nx * sgn * 6 + ux * 1, cy + ny * sgn * 6 + uy * 1, w, M.METAL, 2);
    thickLine(p, cx + nx * sgn * 6 + ux * 1, cy + ny * sgn * 6 + uy * 1, tx, ty, w - 1, M.METAL, (t) => (t > 0.7 ? 3 : 2));
    fillPoly(p, [[tx - ux * 3, ty - uy * 3], [tx + nx * sgn * 3 + ux * 2, ty + ny * sgn * 3 + uy * 2], [tx - nx * sgn * 2 + ux * 3, ty - ny * sgn * 2 + uy * 3]], M.METAL, 3);
  }
  // the ring at the top
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    const x = Math.round(rx - ux * 2 + Math.cos(ang) * 3.2), y = Math.round(ry - uy * 2 + Math.sin(ang) * 3.2);
    p.set(x, y, M.METAL, Math.sin(ang) < 0 ? 3 : 1);
  }
  // rope: wrapped round the shaft, a loop hanging from the ring
  for (let t = 0.12; t < 0.6; t += 0.07) {
    const x = rx + (cx - rx) * t, y = ry + (cy - ry) * t;
    p.line2(x - nx * 2.5, y - ny * 2.5, x + nx * 2.5 + ux, y + ny * 2.5 + uy, M.WOOD, 3);
  }
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    p.set(Math.round(rx + nx * (3 + Math.sin(t * 3) * 3) + ux * t * 14), Math.round(ry + ny * (3 + Math.sin(t * 3) * 3) + uy * t * 14 + Math.sin(t * Math.PI) * 4), M.WOOD, i % 2 ? 2 : 3);
  }
  // seaweed hanging off the crown, barnacles on the flukes
  for (const [k, l] of [[-4, 5], [1, 7], [5, 4]]) {
    for (let i = 0; i < l; i++) p.set(Math.round(cx + nx * k + (i % 3 === 1 ? 1 : 0)), Math.round(cy + ny * k - uy * 2 + i * 0.9), M.GEL, i < 2 ? 3 : 2);
  }
  p.over(Math.round(cx + nx * 7), Math.round(cy + ny * 7), M.BONE, 3);
  p.over(Math.round(cx - nx * 8 - ux * 3), Math.round(cy - ny * 8 - uy * 3), M.BONE, 4);
}

/** A thick limb with a lit side: from a to b, `w` px. */
function sharkLimb(p, a, b, w, mat = M.FUR) {
  thickLine(p, a[0], a[1], b[0], b[1], w, mat, (t, x, y) => {
    const dx = x + 0.5 - (a[0] + (b[0] - a[0]) * t);
    return dx < -w * 0.15 ? 3 : dx > w * 0.25 ? 1 : 2;
  });
}

/** Rope wraps round a limb segment (bands across it). */
function ropeWraps(p, a, b, n) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
  for (let i = 0; i < n; i++) {
    const t = 0.2 + (i / Math.max(1, n - 1)) * 0.6;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    p.line2(x - nx * 4, y - ny * 4, x + nx * 4, y + ny * 4 + 1, M.WOOD, i % 2 ? 2 : 3);
  }
}

/** A barnacled boot with clawed toes, its top at y0 (front or side). */
function sharkBoot(p, x, y0, ground, side) {
  for (let y = y0; y <= ground; y++) {
    const w = y > ground - 3 ? 12 : 10;
    const x0 = Math.round(x - w / 2) + (side && y > ground - 3 ? -2 : 0);
    for (let i = 0; i < w; i++) p.set(x0 + i, y, M.LEATHER, i < 3 ? 3 : i > w - 3 ? 1 : 2);
  }
  // barnacles on the cuff and the toe, the turned-over cuff, claws
  for (const [dx, dy] of [[-3, 1], [0, 2], [3, 1], [-2, 9], [2, 10]]) p.set(x + dx, y0 + dy, M.STONE, (dx + dy) % 2 ? 4 : 3);
  for (let i = -5; i <= 4; i++) p.set(x + i, y0, M.LEATHER, 3);
  for (const dx of side ? [-8, -6, -4] : [-5, -2, 1, 4]) { p.set(x + dx, ground, M.BONE, 4); p.set(x + dx - (side ? 1 : 0), ground - 1, M.BONE, 3); }
}

/** The shark's head facing the camera at (hx, hy) = the skull's centre. */
function sharkHeadFront(p, hx, hy, R) {
  // the dorsal fin rising behind the head
  p.begin(null);
  fillPoly(p, [[hx - 3, hy - 6], [hx + 1, hy - 20], [hx + 4, hy - 19], [hx + 4, hy - 6]], M.FUR, (x) => (x < hx ? 3 : 2));
  p.end();
  p.begin('all', 1);
  // the skull: a broad wedge, grey-blue on top, the snout pointed down toward the viewer
  blob(p, hx, hy, 12, 9, M.FUR, { hi: 0.35, lo: -0.3 });
  fillPoly(p, [[hx - 9, hy + 2], [hx + 9, hy + 2], [hx + 6, hy + 9], [hx - 6, hy + 9]], M.FUR3, (x, y) => (y < hy + 4 ? 3 : 2));
  p.end();
  p.begin(null);
  // gill slits down both sides of the neck
  for (const sgn of [-1, 1]) for (let k = 0; k < 3; k++) for (let y = hy + 2; y <= hy + 6; y++) p.set(hx + sgn * (10 - k * 2), y + k, M.FUR2, 0);
  // the eyes: small, set wide, orange
  for (const sgn of [-1, 1]) {
    const ex = hx + sgn * 7, ey = hy - 1;
    p.set(ex, ey - 1, M.FUR2, 0); p.set(ex - sgn, ey - 1, M.FUR2, 0); p.set(ex + sgn, ey - 1, M.FUR2, 1);
    if (R.eye === 'shut') { p.set(ex, ey, M.FUR3, 2); p.set(ex - sgn, ey, M.FUR3, 2); }
    else if (R.eye === 'dead') { p.set(ex, ey, M.FUR2, 0); p.set(ex - sgn, ey + 1, M.FUR2, 0); p.set(ex - sgn, ey - 1, M.FUR2, 0); }
    else { p.set(ex, ey, M.EYE, 3); p.set(ex - sgn, ey, M.EYE, 1); }
  }
  // the mouth: a wide grin of teeth, opening wider as it snarls and roars
  const m = R.mouth;
  const my = hy + 4;
  for (let x = hx - 8; x <= hx + 8; x++) {
    const curve = Math.round(Math.abs(x - hx) * 0.25);
    const top = my - curve, bot = my + m + 1 - curve;
    for (let y = top; y <= bot; y++) p.set(x, y, M.NOSE, y === top ? 0 : 1);
    if ((x - hx) % 2 === 0) { p.set(x, top, M.BONE, 4); if (m > 0) p.set(x, bot, M.BONE, 3); }
  }
  p.end();
}

/** The shark's head in profile (facing left) at (hx, hy) = the skull's centre. */
function sharkHeadSide(p, hx, hy, R) {
  p.begin('all', 1);
  // the skull and the long pointed snout; the white jaw below a hard line
  blob(p, hx + 2, hy, 11, 8, M.FUR, { hi: 0.35, lo: -0.3 });
  fillPoly(p, [[hx - 6, hy - 6], [hx - 17, hy - 1], [hx - 16, hy + 2], [hx - 6, hy + 4]], M.FUR, (x, y) => (y < hy - 2 ? 3 : 2));
  fillPoly(p, [[hx - 14, hy + 2], [hx + 10, hy + 3], [hx + 8, hy + 8], [hx - 6, hy + 7]], M.FUR3, (x, y) => (y < hy + 5 ? 3 : 2));
  p.end();
  p.begin(null);
  for (let k = 0; k < 4; k++) for (let y = hy + 1; y <= hy + 5; y++) p.set(hx + 6 + k * 2, y + (k > 1 ? 1 : 0), M.FUR2, 0); // gills
  const ex = hx - 6, ey = hy - 2;
  p.set(ex - 1, ey - 1, M.FUR2, 0); p.set(ex, ey - 1, M.FUR2, 0); p.set(ex + 1, ey - 1, M.FUR2, 1);
  if (R.eye === 'shut') { p.set(ex, ey, M.FUR3, 2); p.set(ex + 1, ey, M.FUR3, 2); }
  else if (R.eye === 'dead') { p.set(ex, ey, M.FUR2, 0); p.set(ex + 1, ey + 1, M.FUR2, 0); p.set(ex + 1, ey - 1, M.FUR2, 0); }
  else { p.set(ex, ey, M.EYE, 3); p.set(ex + 1, ey, M.EYE, 1); }
  p.set(hx - 15, hy - 1, M.FUR2, 0); // nostril
  // the jaw line, the teeth, the mouth opening downward
  const m = R.mouth;
  for (let x = hx - 14; x <= hx + 2; x++) {
    const y0 = hy + 2 + Math.round((x - hx + 14) * 0.06);
    for (let y = y0; y <= y0 + m; y++) p.set(x, y, M.NOSE, y === y0 ? 0 : 1);
    if ((x + 14 - hx) % 2 === 0) { p.set(x, y0, M.BONE, 4); if (m > 0) p.set(x, y0 + m, M.BONE, 3); }
  }
  p.end();
}

function drawSharkFront(p, key, back) {
  const G = 93;
  const R0 = sharkRig(key);
  // from behind everything held is mirrored (his right hand is on the viewer's left)
  const mx = (/** @type {number[]} */ a) => (back ? [96 - a[0], a[1]] : a);
  const R = { ...R0, hands: R0.hands.map(mx), ring: mx(R0.ring), crown: mx(R0.crown), feet: R0.feet.map((f) => (back ? [96 - f[0], f[1]] : f)) };
  const cx = 48 + R.lean;
  const bob = R.bob;
  if (R.dead) { drawSharkDead(p); return; }
  // from behind, the anchor he holds in front of him is behind his body
  if (back) { p.begin(null); drawAnchor(p, R.ring, R.crown); p.end(); }
  // the tail fin: down behind the legs to the ground, to the viewer's left (right from behind)
  p.begin(null);
  const tx = back ? 76 : 20;
  thickLine(p, cx + (back ? 6 : -6), 64 + bob, tx, 84, 7, M.FUR, 2);
  fillPoly(p, back ? [[tx - 2, 80], [tx + 10, 70], [tx + 8, 82], [tx + 12, 92], [tx, 88]] : [[tx + 2, 80], [tx - 10, 70], [tx - 8, 82], [tx - 12, 92], [tx, 88]], M.FUR, (x) => (x < tx ? 3 : 2));
  p.end();
  // legs: thick, bowed, knees out; barnacled boots
  p.begin(null);
  const hips = [[cx - 8, 64 + bob], [cx + 8, 64 + bob]];
  R.feet.forEach(([fx, lift], i) => {
    const knee = [i ? fx + 4 : fx - 4, 78 + bob - lift];
    sharkLimb(p, hips[i], knee, 12);
    sharkLimb(p, knee, [fx, 84 - lift], 10);
    sharkBoot(p, fx, 82 - lift, G - lift, false);
  });
  p.end();
  // the torso: a broad muscled chest over the white belly, abs, the strap, the kilt
  p.begin(null);
  blob(p, cx, 46 + bob, 17, 16, M.FUR, { hi: 0.45, lo: -0.25 });
  blob(p, cx, 60 + bob, 12, 7, M.FUR, { hi: 0.45, lo: -0.25 });
  if (!back) {
    fillPoly(p, [[cx - 8, 38 + bob], [cx + 8, 38 + bob], [cx + 7, 64 + bob], [cx - 7, 64 + bob]], M.FUR3, (x, y) => (x < cx - 2 ? 3 : x > cx + 3 ? 1 : 2));
    // pecs and abs
    for (let x = cx - 12; x <= cx + 12; x++) if (Math.abs(x - cx) > 1) p.over(x, 45 + bob + Math.round(Math.abs(x - cx) * 0.15), M.FUR2, 1);
    for (const y of [51, 56, 61]) for (let x = cx - 5; x <= cx + 5; x++) if (x !== cx) p.over(x, y + bob, M.FUR3, 1);
    for (let y = 47; y <= 63; y++) p.over(cx, y + bob, M.FUR3, 1);
  } else {
    // the back: shoulder blades, the spine, the big dorsal fin
    for (let y = 36; y <= 62; y++) p.over(cx, y + bob, M.FUR2, 1);
    for (const sgn of [-1, 1]) for (let y = 40; y <= 50; y++) p.over(cx + sgn * 8 + (y > 45 ? -sgn : 0), y + bob, M.FUR2, 2);
  }
  p.end();
  p.begin(null);
  // the leather strap across the chest (or the back), a bronze buckle
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = Math.round((back ? cx + 14 : cx - 14) + (back ? -28 : 28) * t), y = Math.round(34 + bob + 26 * t);
    for (let k = 0; k < 5; k++) p.set(x, y + k, M.LEATHER, k === 0 ? 4 : k === 4 ? 1 : k === 2 && i % 3 === 0 ? 4 : 3);
  }
  p.set(cx, 47 + bob, M.GOLD, 4); p.set(cx + 1, 47 + bob, M.GOLD, 3); p.set(cx, 48 + bob, M.GOLD, 2); p.set(cx + 1, 48 + bob, M.GOLD, 2);
  // the torn kilt: a belt and ragged strips of hide
  for (let x = cx - 13; x <= cx + 13; x++) { p.set(x, 63 + bob, M.LEATHER, 3); p.set(x, 64 + bob, M.LEATHER, 2); }
  for (let x = cx - 13; x <= cx + 13; x++) {
    const len = 9 + ((x * 7) % 5) + (Math.abs(x - cx) < 4 ? 3 : 0);
    for (let y = 65; y < 65 + len; y++) p.set(x, y + bob, M.LEATHER, (x * 5) % 7 === 0 ? 1 : x < cx - 6 ? 3 : 2);
  }
  p.end();
  // the anchor, held in front (behind the hands)
  if (!back) { p.begin(null); drawAnchor(p, R.ring, R.crown); p.end(); }
  // arms: shoulders to elbows to the hands on the shaft; rope round the forearms; the pauldron
  p.begin('sides', 1);
  // hand 0 is his right hand: on the viewer's right from the front, on the left from behind
  const shoulders = back ? [[cx - 15, 36 + bob], [cx + 15, 36 + bob]] : [[cx + 15, 36 + bob], [cx - 15, 36 + bob]];
  R.hands.forEach((h, i) => {
    const sh = shoulders[i];
    const out = sh[0] > cx ? 1 : -1;
    const elbow = [Math.round((sh[0] + h[0]) / 2 + out * 6), Math.round((sh[1] + h[1]) / 2 + 2)];
    sharkLimb(p, sh, elbow, 10);
    sharkLimb(p, elbow, h, 9);
    ropeWraps(p, elbow, h, 3);
    blob(p, h[0], h[1], 4, 3.4, M.FUR, { hi: 0.3, lo: -0.3 }); // the fist
    p.set(h[0] - 2, h[1] + 2, M.BONE, 3); p.set(h[0] + 1, h[1] + 3, M.BONE, 3); // claws
  });
  p.end();
  p.begin(null);
  const pa = back ? [cx + 16, 33 + bob] : [cx - 16, 33 + bob];
  rock(p, pa[0], pa[1], 9, 6.5, M.STONE, 11, { facets: 9, lift: 0 });
  for (const [dx, dy] of [[-4, -1], [0, -3], [3, 0], [-1, 2], [5, -2]]) p.set(pa[0] + dx, pa[1] + dy, M.BONE, 4); // barnacles
  // coral branching up from the shell
  for (const [dx, h, lean] of [[-3, 7, -1], [0, 9, 0], [3, 6, 1]]) {
    for (let i = 0; i < h; i++) p.set(pa[0] + dx + Math.round(lean * i / 3), pa[1] - 5 - i, M.SCARF, i === h - 1 ? 4 : i % 2 ? 2 : 3);
    p.set(pa[0] + dx + lean * 2 + (lean || 1), pa[1] - 5 - Math.round(h * 0.6), M.SCARF, 3);
  }
  p.end();
  // the head
  const hx = cx + R.head[0], hy = 22 + bob + R.head[1];
  if (back) {
    p.begin('all', 1);
    blob(p, hx, hy, 12, 9, M.FUR, { hi: 0.4, lo: -0.2 });
    p.end();
    p.begin(null);
    for (const sgn of [-1, 1]) for (let k = 0; k < 3; k++) for (let y = hy + 2; y <= hy + 6; y++) p.set(hx + sgn * (10 - k * 2), y + k, M.FUR2, 0);
    // the dorsal fin rising from the back of the head, its edge dark
    fillPoly(p, [[hx - 3, hy + 2], [hx + 1, hy - 20], [hx + 4, hy - 19], [hx + 4, hy + 2]], M.FUR, (x) => (x < hx + 1 ? 3 : 2));
    for (let y = hy - 18; y <= hy + 1; y++) p.set(hx + 4, y, M.FUR2, 1);
    p.end();
  } else sharkHeadFront(p, hx, hy, R);
}

function drawSharkSide(p, key) {
  const G = 93;
  const F = sharkRig(key);
  // the side view's own layout (facing left): the anchor held out in front
  const S = {
    idle0: { ring: [22, 36], crown: [30, 89], hands: [[30, 56], [28, 66]] },
    idle1: { ring: [22, 37], crown: [30, 89], hands: [[30, 57], [28, 67]] },
    windup: { ring: [44, 20], crown: [80, 6], hands: [[42, 18], [48, 16]] },
    attack: { ring: [26, 54], crown: [10, 90], hands: [[28, 60], [24, 64]] },
    sweepWind: { ring: [60, 50], crown: [92, 58], hands: [[62, 52], [68, 54]] },
    sweep: { ring: [28, 52], crown: [4, 60], hands: [[28, 54], [22, 56]] },
    roar: { ring: [20, 40], crown: [26, 89], hands: [[26, 58], [60, 44]] },
    hurt: { ring: [24, 38], crown: [32, 90], hands: [[32, 58], [30, 68]] },
  }[key] ?? { ring: [22, 36], crown: [30, 89], hands: [[30, 56], [28, 66]] };
  const bob = F.bob;
  if (F.dead) { drawSharkDead(p); return; }
  const lean = F.lean;
  const tor = [52 + lean, 48 + bob];
  // the far arm and the tail
  p.begin(null);
  thickLine(p, tor[0] + 10, 64 + bob, 80, 84, 8, M.FUR, 2);
  fillPoly(p, [[78, 80], [90, 68], [89, 80], [92, 92], [80, 88]], M.FUR, (x) => (x < 84 ? 2 : 1));
  const farSh = [tor[0] + 4, 36 + bob];
  const fh = S.hands[1];
  const fe = [Math.round((farSh[0] + fh[0]) / 2 + 2), Math.round((farSh[1] + fh[1]) / 2 + 3)];
  sharkLimb(p, farSh, fe, 9); sharkLimb(p, fe, fh, 8);
  p.end();
  // legs: the near one striding forward, the far one back
  p.begin(null);
  const [[f0, l0], [f1, l1]] = F.feet;
  const step = (f0 - 35) + (f1 - 61);
  const legs = [[tor[0] + 4, 66 + bob, tor[0] + 8 - step, l1, true], [tor[0] - 2, 66 + bob, tor[0] - 6 + step, l0, false]];
  for (const [hx0, hy0, fx, lift, far] of legs) {
    const knee = [Math.round((hx0 + fx) / 2) - 4, 79 + bob - lift];
    sharkLimb(p, [hx0, hy0], knee, far ? 10 : 12);
    sharkLimb(p, knee, [fx, 84 - lift], far ? 9 : 10);
    sharkBoot(p, fx, 82 - lift, G - lift, true);
  }
  p.end();
  // torso: the deep chest, the white belly in front, the back's dorsal fin
  p.begin(null);
  blob(p, tor[0], tor[1], 14, 16, M.FUR, { hi: 0.45, lo: -0.25 });
  // the dorsal fin, part of the back (same part: no outline between them): a wide base sunk into
  // the shoulders, a convex leading edge sweeping up and back, a concave trailing edge
  {
    const bx = tor[0], by = 40 + bob;
    const fin = [];
    // leading edge: up from the shoulders, convex, to the point swept back
    for (let i = 0; i <= 10; i++) { const t = i / 10; fin.push([bx - 3 + 18 * t ** 1.6, by - 25 * Math.sin(t * Math.PI / 2)]); }
    // trailing edge: down from the point, bowed in, to the back
    for (let i = 1; i <= 8; i++) { const t = i / 8; fin.push([bx + 15 - 6 * t - 3 * Math.sin(t * Math.PI), by - 25 + 24 * t]); }
    fin.push([bx + 10, by + 3]);
    fillPoly(p, fin, M.FUR, (x, y) => (x < bx + 3 + (by - y) * 0.45 ? 3 : 2));
    // the fin's dark trailing rim and a lit leading edge
    for (let y = by - 19; y <= by - 2; y++) {
      let x = bx + 16;
      while (x > bx && p.get(x, y) !== M.FUR) x--;
      if (x > bx + 6) p.set(x, y, M.FUR2, 1);
    }
  }
  blob(p, tor[0] + 1, 61 + bob, 10, 6, M.FUR, { hi: 0.45, lo: -0.25 });
  fillPoly(p, [[tor[0] - 13, 40 + bob], [tor[0] - 6, 38 + bob], [tor[0] - 4, 64 + bob], [tor[0] - 10, 62 + bob]], M.FUR3, (x) => (x < tor[0] - 9 ? 3 : 2));
  p.end();
  p.begin(null);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = Math.round(tor[0] - 10 + 18 * t), y = Math.round(36 + bob + 24 * t);
    for (let k = 0; k < 4; k++) p.set(x, y + k, M.LEATHER, k === 0 ? 3 : k === 3 ? 1 : 2);
  }
  for (let x = tor[0] - 12; x <= tor[0] + 11; x++) { p.set(x, 63 + bob, M.LEATHER, 3); p.set(x, 64 + bob, M.LEATHER, 2); }
  for (let x = tor[0] - 12; x <= tor[0] + 11; x++) {
    const len = 9 + ((x * 7) % 5);
    for (let y = 65; y < 65 + len; y++) p.set(x, y + bob, M.LEATHER, (x * 5) % 7 === 0 ? 1 : x < tor[0] - 4 ? 3 : 2);
  }
  p.end();
  p.begin(null);
  drawAnchor(p, S.ring, S.crown);
  p.end();
  // the near arm, the pauldron on the near shoulder
  p.begin('sides', 1);
  const sh = [tor[0] - 4, 37 + bob];
  const h = S.hands[0];
  const el = [Math.round((sh[0] + h[0]) / 2 - 3), Math.round((sh[1] + h[1]) / 2 + 3)];
  sharkLimb(p, sh, el, 10); sharkLimb(p, el, h, 9);
  ropeWraps(p, el, h, 3);
  blob(p, h[0], h[1], 4, 3.4, M.FUR, { hi: 0.3, lo: -0.3 });
  p.set(h[0] - 3, h[1] + 1, M.BONE, 3); p.set(h[0] - 2, h[1] + 3, M.BONE, 3);
  p.end();
  p.begin(null);
  rock(p, sh[0] + 1, sh[1] - 3, 8.5, 6.5, M.STONE, 11, { facets: 9 });
  for (const [dx, dy] of [[-4, -1], [0, -3], [3, 0], [-1, 2]]) p.set(sh[0] + 1 + dx, sh[1] - 3 + dy, M.BONE, 4);
  for (const [dx, hgt, l] of [[-2, 7, -1], [1, 9, 0], [4, 6, 1]]) {
    for (let i = 0; i < hgt; i++) p.set(sh[0] + 1 + dx + Math.round(l * i / 3), sh[1] - 8 - i, M.SCARF, i === hgt - 1 ? 4 : i % 2 ? 2 : 3);
  }
  p.end();
  sharkHeadSide(p, tor[0] - 12 + F.head[0], 24 + bob + F.head[1], F);
}

/**
 * Fallen (every view): on his belly with the head turned to the viewer's left, slack-jawed; the
 * dorsal fin up, the near arm limp on the ground, the legs bent behind with the boots' soles up,
 * the tail fin flopped over the hips, the anchor dropped behind him.
 */
function drawSharkDead(p) {
  const G = 93;
  // the anchor where it fell: planted upright in the ground behind him
  p.begin(null);
  drawAnchor(p, [80, G - 50], [80, G - 6], 3);
  p.end();
  // the legs bent at the knee, shins up, and the tail fin over the hips
  p.begin(null);
  sharkLimb(p, [60, G - 7], [74, G - 4], 10);
  sharkLimb(p, [74, G - 4], [82, G - 14], 8);
  sharkLimb(p, [60, G - 10], [70, G - 9], 9);
  sharkLimb(p, [70, G - 9], [74, G - 19], 7);
  p.end();
  p.begin(null);
  for (const [bx, by] of [[75, G - 25], [84, G - 21]]) {
    for (let y = by; y <= by + 7; y++) for (let x = bx - 3; x <= bx + 3; x++) p.set(x, y, M.LEATHER, x < bx - 1 ? 3 : x > bx + 1 ? 1 : 2);
    for (let x = bx - 3; x <= bx + 3; x++) p.set(x, by, M.LEATHER, 1);
    p.set(bx - 2, by - 1, M.BONE, 4); p.set(bx, by - 1, M.BONE, 4); p.set(bx + 2, by - 1, M.BONE, 3);
    p.set(bx - 1, by + 3, M.STONE, 4); p.set(bx + 1, by + 5, M.STONE, 3);
  }
  p.end();
  // the torso flat on the ground with the dorsal fin standing up from it
  p.begin(null);
  blob(p, 44, G - 9, 18, 8, M.FUR, { hi: 0.45, lo: -0.25 });
  {
    const bx = 40, by = G - 15;
    const fin = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; fin.push([bx - 2 + 14 * t ** 1.6, by - 20 * Math.sin(t * Math.PI / 2)]); }
    for (let i = 1; i <= 8; i++) { const t = i / 8; fin.push([bx + 12 - 4 * t - 2 * Math.sin(t * Math.PI), by - 20 + 19 * t]); }
    fin.push([bx + 9, by + 3]);
    fillPoly(p, fin, M.FUR, (x, y) => (x < bx + 2 + (by - y) * 0.45 ? 3 : 2));
  }
  // the tail: out of the hips, a crescent fin lying over the ground
  thickLine(p, 58, G - 12, 64, G - 20, 6, M.FUR, 2);
  fillPoly(p, [[60, G - 19], [62, G - 33], [67, G - 23], [72, G - 28], [68, G - 18]], M.FUR, (x) => (x < 64 ? 3 : 2));
  for (let x = 30; x <= 60; x++) p.over(x, G - 2, M.FUR3, 2);
  p.end();
  p.begin(null);
  for (let x = 32; x <= 54; x++) for (let k = 0; k < 3; k++) p.set(x, G - 14 + Math.round((x - 32) * 0.3) + k, M.LEATHER, k === 0 ? 3 : 2);
  for (let x = 54; x <= 63; x++) {
    const len = 7 + ((x * 7) % 4);
    for (let y = G - 13; y < G - 13 + len; y++) p.set(x, y, M.LEATHER, (x * 5) % 7 === 0 ? 1 : 2);
  }
  p.end();
  // the near arm limp in front, the pauldron on the shoulder
  p.begin('sides', 1);
  sharkLimb(p, [34, G - 10], [44, G - 3], 9);
  blob(p, 46, G - 3, 3.5, 2.6, M.FUR, { hi: 0.3, lo: -0.3 });
  p.set(48, G - 1, M.BONE, 3); p.set(46, G, M.BONE, 3);
  p.end();
  p.begin(null);
  rock(p, 31, G - 15, 7, 5, M.STONE, 11, { facets: 9 });
  for (const [dx, h] of [[-2, 5], [1, 7], [4, 4]]) for (let i = 0; i < h; i++) p.set(31 + dx + (i > 3 ? 1 : 0), G - 19 - i, M.SCARF, i === h - 1 ? 4 : i % 2 ? 2 : 3);
  p.end();
  sharkHeadSide(p, 19, G - 9, { mouth: 2, eye: 'dead' });
}

function drawShark(p, view, key) {
  if (view === 'side') drawSharkSide(p, key);
  else drawSharkFront(p, key, view === 'up');
}

// ---------------------------------------------------------------------------
// Straw dummy on a post with a painted target (16 × 24)
// ---------------------------------------------------------------------------

function drawDummy(p, view, key, f) {
  const G = f.G;
  const cx = 7.5;
  const side = view === 'side';
  const back = view === 'up';
  // post into a little dirt mound
  p.begin(null);
  for (let y = 14; y <= G; y++) { p.set(7, y, M.WOOD, 3); p.set(8, y, M.WOOD, 1); }
  for (let x = 5; x <= 10; x++) p.set(x, G, M.WOOD, x < 7 ? 2 : 1);
  p.set(6, G - 1, M.WOOD, 2); p.set(9, G - 1, M.WOOD, 1);
  p.end();
  // crossbar arms with straw tufts
  p.begin(null);
  if (side) { p.set(7, 10, M.WOOD, 4); p.set(8, 10, M.WOOD, 2); p.set(7, 11, M.WOOD, 2); p.set(8, 11, M.WOOD, 1); }
  else {
    for (let x = 2; x <= 13; x++) { p.set(x, 10, M.WOOD, 3); p.set(x, 11, M.WOOD, 1); }
    for (const [x, s] of [[2, 3], [13, 2]]) { p.set(x, 12, M.FUR, s); p.set(x, 13, M.FUR, s - 1); p.set(x + (x < 7 ? -0 : 0), 9, M.FUR, s + 1); }
  }
  p.end();
  // straw body bound with rope, the target painted on the front
  p.begin(null);
  blob(p, cx, 14, side ? 2.8 : 4.1, 4.6, M.FUR, { hi: 0.3, lo: -0.35 });
  for (let y = 10; y <= 18; y++) for (let x = 3; x <= 12; x++) if (((x * 3 + y * 5) % 7) === 0) p.over(x, y, M.FUR, 1); // straw strands
  p.end();
  p.begin(null);
  for (let x = 3; x <= 12; x++) { p.over(x, 11, M.LEATHER, x < 7 ? 3 : 1); p.over(x, 17, M.LEATHER, x < 7 ? 2 : 1); }
  if (!side && !back) {
    for (let y = 11; y <= 17; y++) for (let x = 4; x <= 11; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 14);
      if (d > 3.3) continue;
      const ring = d < 1.1 ? 0 : d < 2.2 ? 1 : 2;
      p.over(x, y, ring === 1 ? M.WHITE : M.SCARF, ring === 1 ? (x < cx ? 4 : 3) : (x < cx ? 3 : 2));
    }
  }
  if (side) { for (let y = 12; y <= 16; y++) p.over(5, y, M.SCARF, 2); }
  // loose straw at the bottom
  p.set(5, 19, M.FUR, 2); p.set(9, 19, M.FUR, 1); p.set(7, 19, M.FUR, 3);
  p.end();
  // burlap sack head with stitched eyes, tied at the neck
  p.begin('below', 1);
  blob(p, cx, 5.5, side ? 3.1 : 3.5, 3.3, M.FUR3, { hi: 0.3, lo: -0.35 });
  p.set(side ? 9 : 10, 2, M.FUR3, 2); p.set(side ? 10 : 11, 2, M.FUR3, 1); // knotted tip
  p.end();
  p.begin(null);
  for (let x = 5; x <= 10; x++) p.set(x, 9, M.LEATHER, x < 7 ? 3 : 2);
  p.set(6, 10, M.FUR, 3); p.set(9, 10, M.FUR, 2);
  if (!back) {
    const eyes = side ? [5] : [5, 9];
    for (const ex of eyes) { p.set(ex, 4, M.LINE, 0); p.set(ex + 1, 5, M.LINE, 0); p.set(ex + 1, 4, M.FUR3, 1); p.set(ex, 5, M.FUR3, 1); } // stitched crosses
    if (!side) { p.set(6, 7, M.LINE, 0); p.set(7, 7, M.FUR3, 1); p.set(8, 7, M.LINE, 0); }
  } else { p.set(7, 5, M.FUR3, 1); p.set(7, 6, M.FUR3, 1); } // back seam
  p.end();
  // wobble: hurt tilts left, hurt2 right, dead = hurt
  if (key === 'hurt' || key === 'dead') shear(p, -0.22, G);
  if (key === 'hurt2') shear(p, 0.22, G);
  if (key === 'idle1') shear(p, 0.06, G);
}

// ---------------------------------------------------------------------------
// Golem "Cinderheart" — basalt boss with magma cracks, core and cinder crown (64 × 64)
// ---------------------------------------------------------------------------

/**
 * Golem rig per pose (front view, screen coordinates; the back view mirrors the asymmetric ones):
 * torso centre, head centre, shoulders, elbows and fists (screen-left arm A = the golem's right arm,
 * B = its left), feet with lifts, the core size and crack heat.
 */
function golemRig(key) {
  const R = {
    torso: [32, 34], head: [32, 17], sA: [16, 25], sB: [48, 25], eA: [12, 37], eB: [52, 37],
    fA: [11, 47], fB: [53, 47], footA: [23, 59, 0], footB: [41, 59, 0], core: 3.4, heat: 3, eyes: 3, lean: 0,
  };
  const up = (d) => { for (const k of ['torso', 'head', 'sA', 'sB', 'eA', 'eB']) R[k] = [R[k][0], R[k][1] + d]; };
  switch (key) {
    case 'idle1': up(1); R.fA = [11, 48]; R.fB = [53, 48]; R.core = 3; break;
    case 'move0': R.footA = [23, 57, 2]; up(-1); R.fA = [12, 45]; R.fB = [53, 49]; break;
    case 'move1': up(1); R.fA = [11, 47]; R.fB = [53, 47]; break;
    case 'move2': R.footB = [41, 57, 2]; up(-1); R.fA = [11, 49]; R.fB = [52, 45]; break;
    case 'move3': up(1); break;
    case 'windup': case 'slamWind':
      up(-1); R.eA = [13, 15]; R.eB = [51, 15]; R.fA = [23, 7]; R.fB = [41, 7]; R.heat = 4; break;
    case 'attack': case 'slam':
      up(5); R.head = [32, 25]; R.eA = [19, 44]; R.eB = [45, 44]; R.fA = [26, 56]; R.fB = [38, 56]; R.heat = 4; break;
    case 'sweepWind':
      R.torso = [34, 34]; R.head = [33, 17]; R.eA = [8, 27]; R.fA = [6, 19]; R.sA = [17, 24]; R.heat = 4; break;
    case 'sweep':
      R.torso = [30, 34]; R.head = [31, 17]; R.eA = [26, 38]; R.fA = [45, 40]; R.eB = [55, 34]; R.fB = [57, 44]; R.heat = 4; break;
    case 'throw':
      R.eB = [53, 20]; R.fB = [48, 13]; R.boulder = [48, 7]; R.eA = [12, 36]; R.fA = [13, 46]; break;
    case 'roar':
      up(-1); R.head = [32, 15]; R.eA = [8, 29]; R.eB = [56, 29]; R.fA = [7, 23]; R.fB = [57, 23]; R.core = 4.4; R.heat = 4; R.eyes = 4; R.roar = true; break;
    case 'hurt':
      up(-1); R.head = [33, 16]; R.eA = [11, 34]; R.eB = [53, 34]; R.fA = [13, 41]; R.fB = [51, 41]; R.eyes = 2; R.lean = 1; break;
    case 'kneel':
      up(10); R.head = [32, 28]; R.footA = [22, 59, 0]; R.footB = [42, 60, 0]; R.kneel = true;
      R.eA = [12, 49]; R.eB = [52, 49]; R.fA = [13, 57]; R.fB = [51, 57]; R.core = 2.4; R.heat = 2; R.eyes = 2; break;
    default: break;
  }
  return R;
}

/** Magma cracks (offsets from the torso centre) for the front / back views. */
const GOLEM_CRACKS = {
  front: [
    [[-3, -2], [-7, -6], [-9, -7], [-12, -11]], [[3, -2], [6, -5], [10, -6]], [[-2, 3], [-5, 7], [-4, 10]],
    [[3, 3], [7, 6], [9, 10]], [[0, -4], [1, -8], [-1, -11]],
  ],
  back: [[[-10, -8], [-6, -4], [-7, 1], [-3, 6]], [[9, -9], [5, -3], [7, 3]], [[0, 2], [2, 7], [0, 11]]],
};

/** One golem arm: upper arm, forearm and fist as rock chunks, a glowing seam on the forearm. */
function golemArm(p, s, e, f, lit, seed, heat) {
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const lift = lit ? 0 : -1;
  const u = mid(s, e), fo = mid(e, f);
  rock(p, u[0], u[1], 4.6, Math.max(4.6, Math.abs(e[1] - s[1]) / 2 + 2), M.STONE, seed, { facets: 7, lift });
  rock(p, fo[0], fo[1], 4.2, Math.max(4.4, Math.abs(f[1] - e[1]) / 2 + 2), M.STONE, seed + 1, { facets: 7, lift });
  if (heat > 2) crack(p, [[e[0] - 1, e[1]], [fo[0], fo[1] + 1], [f[0] + 1, f[1] - 3]], 2);
  rock(p, f[0], f[1], 5.6, 5, M.STONE, seed + 2, { facets: 8, lift });
  // knuckle ridge
  p.over(Math.round(f[0] - 3), Math.round(f[1] + 2), M.STONE, 1); p.over(Math.round(f[0]), Math.round(f[1] + 3), M.STONE, 1); p.over(Math.round(f[0] + 3), Math.round(f[1] + 2), M.STONE, 1);
}

/** Crown of cinder spikes on the head (ember tips glow). */
function golemCrown(p, hx, hy, heat, back) {
  const spikes = [[-5, -3, 3], [-2, -5, 4], [1, -6, 5], [4, -4, 4], [6, -2, 3]];
  for (const [dx, dy, h] of spikes) {
    const x = Math.round(hx + (back ? -dx : dx)), y0 = Math.round(hy + dy);
    for (let k = 0; k < h; k++) {
      p.set(x, y0 - k, M.STONE, k === 0 ? 2 : 3);
      if (k < h - 2) p.set(x + 1, y0 - k, M.STONE, 1);
    }
    p.set(x, y0 - h, M.GLOW, heat >= 3 ? 4 : 2);
    if (heat >= 3) p.set(x, y0 - h + 1, M.GLOW, 3);
  }
}

/** Golem in the front (down) or back (up) view. */
function drawGolemFront(p, key, back) {
  const R = golemRig(key);
  const mx = (pt) => (back ? [64 - pt[0], pt[1]] : pt);
  const [tx, ty] = mx(R.torso);
  const [hx, hy] = mx(R.head);
  // legs and feet
  p.begin(null);
  for (const foot of [R.footA, R.footB]) {
    const [fx, fy] = mx(foot);
    if (R.kneel && foot === R.footB) {
      rock(p, fx, fy - 2, 6, 3.2, M.STONE, 41, { facets: 6 });     // knee on the ground, shin behind
      continue;
    }
    rock(p, (fx + tx) / 2 + (fx < tx ? 1 : -1), (fy + ty + 12) / 2 - 1, 5, 6, M.STONE, fx < 32 ? 11 : 12, { facets: 7, lift: -1 });
    rock(p, fx, fy, 6.2, 3.4, M.STONE, fx < 32 ? 13 : 14, { facets: 6 });
  }
  p.end();
  // far arms first when raised behind the head
  const arms = [[R.sA, R.eA, R.fA, 21], [R.sB, R.eB, R.fB, 25]].map(([s, e, f, seed]) => [mx(s), mx(e), mx(f), seed]);
  // torso: pelvis block + great chest
  p.begin(null);
  rock(p, tx, ty + 12, 11, 4.5, M.STONE, 5, { facets: 7, lift: -1 });
  rock(p, tx, ty, 15.5, 13, M.STONE, 7, { facets: 10, face: 0.62 });
  // dark seams between the chest plates
  p.line2(tx - 9, ty - 4, tx - 5, ty + 8, M.STONE, 0);
  p.line2(tx + 9, ty - 5, tx + 6, ty + 7, M.STONE, 0);
  p.end();
  // magma cracks and the core
  p.begin(null);
  for (const pts of GOLEM_CRACKS[back ? 'back' : 'front']) crack(p, pts.map(([x, y]) => [tx + x, ty + y]), R.heat >= 3 ? 3 : 2);
  if (!back) {
    const c = R.core;
    for (let y = Math.floor(ty - c - 1); y <= Math.ceil(ty + c + 1); y++) {
      for (let x = Math.floor(tx - c - 1); x <= Math.ceil(tx + c + 1); x++) {
        const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty + 0.3);
        if (d > c + 0.6) continue;
        p.set(x, y, d > c - 0.4 ? M.STONE : M.GLOW, d > c - 0.4 ? 0 : d < c * 0.35 ? 4 : d < c * 0.7 ? 3 : 2);
      }
    }
  } else {
    // spine ridge of basalt spikes
    for (let k = 0; k < 4; k++) { const y = ty - 9 + k * 5; p.set(tx, y, M.STONE, 4); p.set(tx, y + 1, M.STONE, 3); p.set(tx + 1, y + 1, M.STONE, 1); p.set(tx - 1, y + 2, M.STONE, 3); }
  }
  p.end();
  // shoulders and arms
  p.begin(null);
  for (const [s, e, f, seed] of arms) golemArm(p, s, e, f, s[0] < 32, seed, R.heat);
  p.end();
  p.begin(null);
  for (const [s, , , seed] of arms) rock(p, s[0], s[1], 7.2, 6.4, M.STONE, seed + 9, { facets: 8, face: 0.5 });
  p.end();
  // head sunk between the shoulders, crown, eyes
  p.begin('all', 0);
  rock(p, hx, hy, 6.4, 5.6, M.STONE, 31, { facets: 7 });
  p.end();
  p.begin(null);
  golemCrown(p, hx, hy - 3, R.heat, back);
  if (!back) {
    const ey = Math.round(hy);
    const s = R.eyes;
    for (const ex of [Math.round(hx - 3), Math.round(hx + 1)]) { p.set(ex, ey, M.GLOW, s); p.set(ex + 1, ey, M.GLOW, Math.max(2, s - 1)); }
    if (R.roar) { for (let x = Math.round(hx - 2); x <= Math.round(hx + 1); x++) p.set(x, ey + 3, M.GLOW, 3); } // open maw
    else p.set(Math.round(hx - 1), ey + 3, M.STONE, 0);
  }
  p.end();
  if (R.boulder) {
    p.begin('all', 0);
    const [bx, by] = mx(R.boulder);
    rock(p, bx, by, 5, 4.4, M.STONE, 51, { facets: 7, lift: 1 });
    crack(p, [[bx - 2, by], [bx + 1, by + 1], [bx + 2, by - 2]], 2);
    p.end();
  }
}

/** Golem in the side view (facing left): hunched profile, far arm behind, near arm in front. */
function drawGolemSide(p, key) {
  const R = golemRig(key);
  // map the front rig to a profile: depth offsets per part (forward = −x)
  const drop = R.torso[1] - 34;
  const tx = 34 + (R.lean ?? 0) * 2, ty = 35 + drop;
  const hx = 23 + (R.lean ?? 0) * 2 + (key === 'slam' || key === 'attack' ? -4 : 0), hy = R.head[1] + 5 + (key === 'roar' ? -2 : 0);
  const near = sideArm(key, 'near', drop), far = sideArm(key, 'far', drop);
  // far leg and far arm (behind)
  p.begin(null);
  const footF = R.kneel ? [38, 59] : [38 - (key === 'move2' ? -2 : 0), 59 - (R.footB[2] ?? 0)];
  rock(p, 38, (footF[1] + ty + 12) / 2, 5, 6, M.STONE, 12, { facets: 7, lift: -1 });
  rock(p, footF[0] - 2, footF[1], 6.4, 3.2, M.STONE, 14, { facets: 6, lift: -1 });
  golemArm(p, far.s, far.e, far.f, false, 25, R.heat);
  p.end();
  // body
  p.begin(null);
  rock(p, tx + 1, ty + 12, 9, 4.5, M.STONE, 5, { facets: 7, lift: -1 });
  rock(p, tx, ty, 11.5, 13, M.STONE, 7, { facets: 9, face: 0.6 });
  for (let k = 0; k < 4; k++) { const y = ty - 9 + k * 5; if (p.get(tx + 9, y)) { p.set(tx + 10, y, M.STONE, 3); p.set(tx + 11, y + 1, M.STONE, 2); p.set(tx + 10, y + 1, M.STONE, 1); } } // back spikes
  p.end();
  p.begin(null);
  crack(p, [[tx - 9, ty - 1], [tx - 5, ty + 2], [tx - 6, ty + 7], [tx - 2, ty + 10]], R.heat >= 3 ? 3 : 2);
  crack(p, [[tx - 4, ty - 8], [tx, ty - 5], [tx + 3, ty - 7]], 2);
  // core glowing through a rift at the front of the chest
  const c = Math.max(1.4, R.core - 1.6);
  for (let y = Math.floor(ty - c); y <= Math.ceil(ty + c); y++) for (let x = Math.floor(tx - 11); x <= Math.floor(tx - 11 + c + 1); x++) {
    const d = Math.hypot(x + 0.5 - (tx - 10.5), y + 0.5 - ty);
    if (d <= c + 0.3) p.over(x, y, M.GLOW, d < c * 0.5 ? 3 : 2);
  }
  p.end();
  // near leg
  p.begin(null);
  const footN = [29 - (R.footA[2] ? 2 : 0), 59 - (R.footA[2] ?? 0)];
  rock(p, 30, (footN[1] + ty + 12) / 2, 5.2, 6.2, M.STONE, 11, { facets: 7 });
  rock(p, footN[0] - 2, footN[1], 6.6, 3.4, M.STONE, 13, { facets: 6 });
  p.end();
  // head (hunched forward), crown, eye
  p.begin('all', 0);
  rock(p, hx, hy, 6, 5.4, M.STONE, 31, { facets: 7 });
  p.end();
  p.begin(null);
  golemCrown(p, hx + 1, hy - 3, R.heat, false);
  p.set(hx - 4, hy, M.GLOW, R.eyes); p.set(hx - 3, hy, M.GLOW, Math.max(2, R.eyes - 1));
  if (R.roar) { p.set(hx - 5, hy + 3, M.GLOW, 3); p.set(hx - 4, hy + 3, M.GLOW, 3); }
  p.end();
  // near arm (in front) and shoulder
  p.begin(null);
  golemArm(p, near.s, near.e, near.f, true, 21, R.heat);
  rock(p, near.s[0], near.s[1], 6.8, 6.2, M.STONE, 30, { facets: 8, face: 0.5 });
  p.end();
  if (key === 'throw') {
    p.begin('all', 0);
    rock(p, near.f[0] + 1, near.f[1] - 6, 5, 4.4, M.STONE, 51, { facets: 7, lift: 1 });
    p.end();
  }
}

/** Side-view arm joints (facing left) per pose for the near / far arm. */
function sideArm(key, which, drop) {
  const n = which === 'near';
  const s = n ? [30, 26 + drop] : [37, 25 + drop];
  const A = {
    idle0: n ? [[27, 37], [24, 47]] : [[40, 36], [41, 46]],
    idle1: n ? [[27, 37], [24, 48]] : [[40, 36], [41, 47]],
    move0: n ? [[26, 36], [22, 45]] : [[41, 36], [43, 47]],
    move1: n ? [[27, 37], [24, 47]] : [[40, 36], [41, 46]],
    move2: n ? [[28, 37], [27, 48]] : [[39, 36], [38, 45]],
    move3: n ? [[27, 37], [24, 47]] : [[40, 36], [41, 46]],
    slamWind: n ? [[23, 17], [17, 9]] : [[31, 15], [25, 8]],
    slam: n ? [[20, 44], [13, 55]] : [[28, 43], [20, 55]],
    sweepWind: n ? [[40, 30], [48, 24]] : [[42, 34], [44, 44]],
    sweep: n ? [[19, 33], [9, 36]] : [[40, 36], [42, 46]],
    throw: n ? [[38, 18], [42, 14]] : [[40, 36], [41, 46]],
    roar: n ? [[21, 26], [13, 20]] : [[44, 26], [52, 21]],
    hurt: n ? [[29, 35], [28, 43]] : [[42, 34], [45, 41]],
    kneel: n ? [[24, 48], [18, 57]] : [[36, 47], [32, 57]],
  };
  const k = key === 'windup' ? 'slamWind' : key === 'attack' ? 'slam' : key;
  const [e, f] = A[k] ?? A.idle0;
  const d = k === 'slam' || k === 'kneel' ? 0 : drop;
  return { s, e: [e[0], e[1] + d * 0], f: [f[0], f[1] + (k === 'idle1' || k === 'move1' || k === 'move3' ? 0 : 0)] };
}

/** Collapsed golem: a pile of basalt rubble, a few embers still glowing, the dimmed core on top. */
function drawGolemDead(p, view) {
  const pile = view === 'side'
    ? [[32, 56, 12, 6, 1], [22, 58, 7, 4.5, 2], [42, 57, 8, 5, 3], [30, 49, 8, 5.5, 4], [38, 50, 6, 4.5, 5], [26, 44, 6, 5, 6], [47, 60, 4, 2.6, 7]]
    : [[32, 57, 13, 5.5, 1], [19, 58, 7, 4.2, 2], [45, 58, 7.5, 4.4, 3], [27, 50, 8, 5.4, 4], [38, 50, 7.5, 5, 5], [32, 43, 6, 5, 6], [12, 60, 3.5, 2.2, 7], [53, 60, 3.8, 2.4, 8]];
  p.begin(null);
  for (const [x, y, rx, ry, seed] of pile) rock(p, x, y, rx, ry, M.STONE, 60 + seed, { facets: 7, lift: -1 });
  p.end();
  p.begin(null);
  crack(p, [[24, 55], [29, 57], [33, 54]], 2);
  crack(p, [[36, 52], [40, 55]], 1);
  if (view !== 'up') { p.set(31, 43, M.GLOW, 2); p.set(32, 43, M.GLOW, 3); p.set(32, 44, M.GLOW, 2); }
  for (const [x, y] of [[20, 57], [44, 56], [28, 49]]) p.set(x, y, M.GLOW, 2);
  p.end();
}

function drawGolem(p, view, key) {
  if (key === 'dead') drawGolemDead(p, view);
  else if (view === 'side') drawGolemSide(p, key);
  else drawGolemFront(p, key, view === 'up');
}

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

/** Humanoid enemy specs (createCharacterSheet with { combat: true }). */
const HUMANOID_SPECS = {
  goblin: {
    preset: 'goblin', build: 'child', skin: '#7aa84a', ears: 'pointed', face: 'fierce', hairStyle: 'bald', hair: '#7aa84a',
    eyes: '#f2c23a', beard: false, hat: 'none', cape: false, weapon: 'sword', blush: false,
    // an open dark-leather vest over the bare green chest and arms, a tan loincloth, bare feet
    outfit: { top: '#4a3226', bottom: '#a8885a', accent: 'brown', style: 'vest', shirt: '#7aa84a' },
    gear: { boots: '#7aa84a', belt: '#2a1c14', leather: '#3a281c' },
  },
  archer: {
    preset: 'archer', build: 'child', skin: '#6f9c46', face: 'fierce', hairStyle: 'short', hair: '#2a2a1e',
    eyes: '#e8b83a', beard: false, hat: 'hood', hatColor: '#6a3a28', cape: false, weapon: 'bow', blush: false,
    outfit: { top: '#5a4a30', bottom: '#3a3024', accent: 'brown', style: 'tunic', shirt: 'cream' },
    gear: { quiver: true, boots: '#2a2018', leather: '#6a4428', belt: '#2a1c14' },
  },
  shaman: {
    preset: 'shaman', build: 'child', skin: '#7f9e50', face: 'fierce', hairStyle: 'bald', hair: '#3e5a2a',
    eyes: '#f2c23a', beard: false, hat: 'hood', hatColor: '#5a2446', feather: '#e8dcc0', cape: false, weapon: 'staff', blush: false,
    outfit: { top: '#3e2c48', bottom: '#2e2236', accent: '#c8a060', style: 'robe', shirt: 'cream' },
    gear: { beads: true, staffGem: '#5ee08c', gemGlow: true, boots: '#2a1e18', sash: '#8a3a2a' },
  },
};

/**
 * Sprite3D options of an enemy sheet (`EnemySheet.spriteOptions`, spread into the sprite options).
 * @typedef {{ castShadow?: boolean, blobSize?: [number, number] }} EnemySpriteOptions
 */

/**
 * Per kind: frame size, column pose names, aliases (alias → pose name), sprite options, material
 * colours, painter and idle animation override. Humanoids use a character spec instead.
 */
const KINDS = {
  slime: {
    fw: 20, fh: 16, columns: [...COMMON, 'land'], aliases: {},
    spriteOptions: { blobSize: /** @type {[number, number]} */ ([0.9, 0.45]) }, draw: drawSlime,
    ramps: () => makeRamps({
      [M.GEL]: ramp5(['#1a4a50', '#25807e', '#3fb6a8', '#7fe0c8', '#dcfff2']),
      [M.FUR]: ramp5(['#1e3a24', '#2f5a30', '#4f8238', '#77a845', '#a8cc62']),
      [M.FUR2]: ramp5(['#23502a', '#3a8a3a', '#62bc48', '#9ade6a', '#d8ff9a']),
      [M.EYE]: eyeRamp('#1a2430', '#3a4c5a'),
    }, M.GEL),
  },
  goblin: {
    fw: 32, fh: 32, columns: HUMANOID, humanoid: HUMANOID_SPECS.goblin,
    aliases: { ...HUMANOID_MOVE, windup: 'wind', attack: 'slash', attack2: 'backhand', dead: 'down' },
    spriteOptions: {},
  },
  archer: {
    fw: 32, fh: 32, columns: HUMANOID, humanoid: HUMANOID_SPECS.archer,
    aliases: { ...HUMANOID_MOVE, windup: 'aim', attack: 'follow', shove: 'thrust', dead: 'down' },
    spriteOptions: {},
  },
  shaman: {
    fw: 32, fh: 32, columns: HUMANOID, humanoid: HUMANOID_SPECS.shaman,
    aliases: { ...HUMANOID_MOVE, windup: 'cast', attack: 'aim', blink: 'tuck', dead: 'down' },
    spriteOptions: {},
  },
  bat: {
    fw: 20, fh: 20, columns: COMMON, aliases: {},
    spriteOptions: { castShadow: false, blobSize: /** @type {[number, number]} */ ([0.7, 0.35]) }, draw: drawBat,
    idle: { poses: ['move0', 'move1', 'move2', 'move3'], fps: 10 },
    ramps: () => makeRamps({
      [M.FUR]: ramp5(['#0e0b12', '#1b1720', '#2b2632', '#433b4c', '#625870']),
      [M.WING]: ramp5(['#240a08', '#4e1a0e', '#8e3414', '#d0662a', '#f6a44a']),
      [M.GLOW]: glowRamp(['#6a1a06', '#c4400e', '#ff7a1e', '#ffb84a', '#fff0a8']),
      [M.BONE]: ramp5(['#8a8272', '#b8ae98', '#ddd4bc', '#f2ead6', '#ffffff']),
      [M.EYE]: eyeRamp('#3a1010', '#6a2a1a'),
    }, M.FUR),
  },
  boar: {
    fw: 32, fh: 24, columns: [...COMMON, 'charge0', 'charge1', 'stun'], aliases: {},
    spriteOptions: { blobSize: /** @type {[number, number]} */ ([1.6, 0.7]) }, draw: drawBoar,
    ramps: () => makeRamps({
      [M.FUR]: ramp5(['#1c1c24', '#32323c', '#4c4e5a', '#6c707c', '#9498a4']),
      [M.FUR2]: ramp5(['#0e0e14', '#18181f', '#26262f', '#3a3a46', '#50505e']),
      [M.FUR3]: ramp5(['#3a3a42', '#56565e', '#74747c', '#94949a', '#b4b4b8']),
      [M.NOSE]: ramp5(['#3a2426', '#6a4446', '#94686a', '#b88c8c', '#d8b0ac']),
      [M.BONE]: ramp5(['#7a705e', '#aea48a', '#d8ceb2', '#efe6cc', '#fffaea']),
      [M.METAL]: 'metal',
      [M.EYE]: eyeRamp('#b8321e', '#e06a3a'),
    }, M.FUR),
  },
  wolf: {
    fw: 32, fh: 24, columns: COMMON, aliases: {},
    spriteOptions: { blobSize: /** @type {[number, number]} */ ([1.4, 0.6]) }, draw: drawWolf,
    ramps: () => makeRamps({
      // the pelt: deep forest-leaf green (dark enough to read on grass: COMBAT.md §10.3), lit leaf tips
      [M.FUR]: ramp5(['#0e1a10', '#18301a', '#26462a', '#3d6634', '#86a64c']),
      // the leaves' shadowed edges, the mane and the paws
      [M.FUR2]: ramp5(['#060c08', '#0c1810', '#142618', '#1f3a22', '#2f5430']),
      // straw: belly, muzzle, the tail's tip
      [M.FUR3]: ramp5(['#6a5426', '#9a7e3c', '#c8a85a', '#e2c87e', '#f4e2a8']),
      [M.NOSE]: ramp5(['#120c0a', '#1e1612', '#30241c', '#463428', '#5c4636']),
      [M.BONE]: ramp5(['#8a8272', '#b8ae98', '#ddd4bc', '#f2ead6', '#ffffff']),
      [M.EYE]: eyeRamp('#c88a1a', '#f2c04a'),
    }, M.FUR),
  },
  fera: {
    fw: 64, fh: 64, columns: [...COMMON, 'tailWind', 'tailSwipe', 'puff'], aliases: {},
    spriteOptions: { blobSize: /** @type {[number, number]} */ ([2.8, 1.1]) }, draw: drawFera,
    ramps: () => makeRamps({
      // the hide: dull olive scales, the dark bands, the pale belly, dewlap and cheek shield
      [M.FUR]: ramp5(['#151a14', '#253024', '#3c4a36', '#5c6c4e', '#8a9874']),
      [M.FUR2]: ramp5(['#0a0d0a', '#141a12', '#1f281c', '#2e3a28', '#425038']),
      [M.FUR3]: ramp5(['#6a6650', '#958e70', '#bdb592', '#d9d2b0', '#efe9cc']),
      // the puffer's spines and the claws and teeth: bone
      [M.BONE]: ramp5(['#6e6a5e', '#a09a88', '#cfc8b4', '#ebe6d6', '#ffffff']),
      // salt crystals
      [M.STONE]: ramp5(['#4e5e66', '#7e949e', '#b2c8ce', '#dcecee', '#ffffff']),
      // the Baiacu Rei's toxin: sea-teal glow texels (eyes, veins, crystal roots)
      [M.GLOW]: glowRamp(['#0e3a3a', '#16706a', '#2ab8a4', '#7af0d2', '#dcfff2']),
      // the inside of the mouth
      [M.NOSE]: ramp5(['#2a0c12', '#4a1620', '#6e2430', '#94404a', '#b8666a']),
    }, M.FUR),
  },
  shark: {
    fw: 96, fh: 96, columns: [...COMMON, 'sweepWind', 'sweep', 'roar'], aliases: {},
    spriteOptions: { blobSize: /** @type {[number, number]} */ ([3.2, 1.3]) }, draw: drawShark,
    ramps: () => makeRamps({
      // the hide: blue-grey shark skin, its dark edges and fins, the white belly and jaw
      [M.FUR]: ramp5(['#1a2632', '#2c4050', '#46627a', '#6a8aa2', '#9cb8cc']),
      [M.FUR2]: ramp5(['#0a1018', '#121c26', '#1c2a38', '#2a3e50', '#3e566c']),
      [M.FUR3]: ramp5(['#7a8a94', '#a4b2ba', '#c8d2d8', '#e2e8ec', '#f6f9fa']),
      // the anchor's rusted iron
      [M.METAL]: ramp5(['#2a140c', '#4e2614', '#7a3c1c', '#a85a2a', '#cc8a4e']),
      // rope, leather, the buckle
      [M.WOOD]: ramp5(['#5a4426', '#86683a', '#b0905a', '#cfb07a', '#e6d0a0']),
      [M.LEATHER]: ramp5(['#1e1410', '#36241a', '#523828', '#6e4e36', '#8e6a4a']),
      [M.GOLD]: ramp5(['#3a2410', '#6b4515', '#a5701f', '#d6a33a', '#f2d072']),
      // the barnacled shell, the coral, the seaweed
      [M.STONE]: ramp5(['#2a3430', '#45524c', '#66766c', '#8e9c90', '#c4ccbe']),
      [M.SCARF]: ramp5(['#5a1420', '#8e2434', '#c4404c', '#e8707a', '#ffb0b0']),
      [M.GEL]: ramp5(['#10260e', '#1e4018', '#2e5e22', '#4a7e32', '#72a04a']),
      // teeth, claws and barnacles; the mouth; the orange eyes
      [M.BONE]: ramp5(['#7a7468', '#aaa294', '#d4ccbc', '#eee8da', '#ffffff']),
      [M.NOSE]: ramp5(['#1a080c', '#3a1018', '#5a1c24', '#7a2e34', '#9a4448']),
      [M.EYE]: eyeRamp('#d2641a', '#ffa040'),
    }, M.FUR),
  },
  dummy: {
    fw: 16, fh: 24, columns: [...COMMON, 'hurt2'], aliases: {},
    spriteOptions: { blobSize: /** @type {[number, number]} */ ([0.7, 0.35]) }, draw: drawDummy,
    ramps: () => makeRamps({
      [M.FUR]: ramp5(['#6a4a18', '#a07a2a', '#d8b453', '#ecd488', '#fbefc0']),
      [M.FUR3]: ramp5(['#5a4630', '#86704e', '#b09a72', '#cdb994', '#e6d8b8']),
      [M.WOOD]: 'wood', [M.LEATHER]: ramp5(['#2a1a10', '#4a3020', '#6e4a30', '#946a44', '#b88c5c']),
      [M.SCARF]: 'red', [M.WHITE]: 'cream',
    }, M.FUR),
  },
  golem: {
    fw: 64, fh: 64, columns: [...COMMON, 'slamWind', 'slam', 'sweepWind', 'sweep', 'throw', 'roar', 'kneel'], aliases: {},
    spriteOptions: { blobSize: /** @type {[number, number]} */ ([2.6, 1.2]) }, draw: drawGolem,
    ramps: () => makeRamps({
      [M.STONE]: ramp5(['#131218', '#23212a', '#373440', '#524e5c', '#77727f']),
      [M.GLOW]: glowRamp(['#6e1c06', '#c2400e', '#f27a22', '#ffba4a', '#fff2b0']),
    }, M.STONE),
  },
};

/**
 * Create an enemy sprite sheet (callers cache it: one sheet per kind is shared by every sprite).
 * @param {'slime'|'goblin'|'archer'|'shaman'|'bat'|'boar'|'dummy'|'golem'|'wolf'|'fera'|'shark'} kind
 * @returns {{texture: THREE.Texture, canvas: HTMLCanvasElement, frameWidth: number, frameHeight: number,
 *   columns: number, rows: number, pixelsPerUnit: number, anchor: [number, number],
 *   animations: Record<string, {frames: {col:number,row:number}[], fps: number, loop: boolean}>,
 *   name: string, dispose: () => void, kind: string, poses: Record<string, number>,
 *   spriteOptions: EnemySpriteOptions}} EnemySheet
 */
export function createEnemySheet(kind) {
  const def = Object.hasOwn(KINDS, kind) ? KINDS[kind] : null;
  if (!def) throw new Error(`createEnemySheet: unknown enemy kind "${kind}"`);
  if (def.humanoid) return humanoidSheet(kind, def);
  const { fw: FW, fh: FH } = def;
  const cols = def.columns.length;
  const rows = DIRECTIONS.length;
  const pc = new PixelCanvas(FW * cols, FH * rows);
  const p = new Painter(FW, FH);
  const ramps = def.ramps();
  DIRECTIONS.forEach((dir, row) => {
    const view = dir === 'down' ? 'down' : dir === 'up' ? 'up' : 'side';
    def.columns.forEach((key, col) => {
      p.clear();
      def.draw(p, view, key, { G: FH - 2 });
      p.ox = 0; p.oy = 0;
      clipMargin(p);
      resolvePainter(p, ramps, pc, col * FW, row * FH, dir === 'right');
    });
  });

  const poses = {};
  def.columns.forEach((name, col) => { poses[name] = col; });
  for (const [alias, name] of Object.entries(def.aliases)) poses[alias] = poses[name];

  const animations = {};
  const idle = def.idle ?? { poses: ['idle0', 'idle1'], fps: 2.5 };
  const move = ['move0', 'move1', 'move2', 'move3'];
  DIRECTIONS.forEach((d, row) => {
    const at = (list) => list.map((n) => ({ col: poses[n], row }));
    animations[`idle_${d}`] = { frames: at(idle.poses), fps: idle.fps, loop: true };
    animations[`walk_${d}`] = { frames: at(move), fps: 8, loop: true };
    animations[`run_${d}`] = { frames: at(move), fps: 13, loop: true };
  });

  const canvas = pc.toCanvas();
  const texture = finishTexture(canvas, `enemy:${kind}`);
  return {
    texture, canvas, frameWidth: FW, frameHeight: FH, columns: cols, rows,
    pixelsPerUnit: PPU, anchor: [0.5, 0], animations, name: kind,
    kind, poses, spriteOptions: { ...def.spriteOptions },
    /** Free the GPU texture (sprite clones share the image and are disposed by their owners). */
    dispose() { texture.dispose(); },
  };
}

/** Goblin / archer / shaman: the character combat sheet of the kind's spec, with the enemy aliases. */
function humanoidSheet(kind, def) {
  const s = createCharacterSheet(def.humanoid, { combat: true });
  s.texture.name = `enemy:${kind}`;
  const poses = { ...s.poses };
  for (const [alias, name] of Object.entries(def.aliases)) poses[alias] = s.poses[name];
  return {
    texture: s.texture, canvas: s.canvas, frameWidth: s.frameWidth, frameHeight: s.frameHeight,
    columns: s.columns, rows: s.rows, pixelsPerUnit: s.pixelsPerUnit, anchor: s.anchor,
    animations: s.animations, name: kind, kind, poses, spriteOptions: { ...def.spriteOptions },
    dispose() { s.dispose(); },
  };
}
