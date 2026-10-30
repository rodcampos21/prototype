import * as THREE from 'three';
import { smoothstep, clamp } from '../../utils/math.js';
import { TRIM } from './Details.js';
import { rockGeom } from './SmallProps.js';
import { buildHouse } from './House.js';

/**
 * @import { PropFactory } from '../Props.js'
 * @import { MeshBuilder } from './MeshBuilder.js'
 */

/**
 * Camp props (`camp: true` in the catalog): the tent, the map table, the banner and the stakes of a
 * camp that grows into a town. The buildings of a camp evolve as it grows, so a prop that changes
 * with the town takes `opts.stage` (the editor's lists are in ObjectCatalog.js: TENT_STAGES,
 * BANNER_STAGES, STAKE_KINDS — change both); a later stage is a new branch in its builder and a new
 * entry in that list, and a level shows one stage at a time with `when` / `unless` or a chapter
 * variant. Anything else than a known stage builds the first one (level data is untrusted).
 */

const groundAO = (h = 0.5, k = 0.62) => (px, py) => k + (1 - k) * smoothstep(-0.05, h, py);

/**
 * A rope (or pole) between two local points: a thin box along the segment.
 * @param {MeshBuilder} b @param {string} mat @param {number[]} a @param {number[]} c @param {number} [t]
 */
function strut(b, mat, a, c, t = 0.035) {
  const d = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  b.box(mat, [t, len, t], { at: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], rot: q, rotUV: true, faces: { py: false, ny: false } });
}

/**
 * A cloth strip hanging from (x, top, z) across local X, `w` wide and `h` long, cut into `rows`
 * so the wind can bend it: the sway grows from 0 at the top to `swing` at the foot. UVs map the
 * texture whole (the cloth textures are painted to size).
 * @param {MeshBuilder} b @param {THREE.Material} mat
 */
function hangingCloth(b, mat, x, top, z, w, h, { rows = 6, swing = 2.2, lean = 0.04 } = {}) {
  const prev = b.sway;
  b.sway = (px, py) => swing * clamp((top - py) / h, 0, 1) ** 1.3;
  for (let r = 0; r < rows; r++) {
    const y0 = top - (h * r) / rows;
    const y1 = top - (h * (r + 1)) / rows;
    const z0 = z + lean * (r / rows) ** 2;
    const z1 = z + lean * ((r + 1) / rows) ** 2;
    const v0 = 1 - r / rows;
    const v1 = 1 - (r + 1) / rows;
    b.quad(mat, [[x - w / 2, y1, z1], [x + w / 2, y1, z1], [x + w / 2, y0, z0], [x - w / 2, y0, z0]], [[0, v1], [1, v1], [1, v0], [0, v0]]);
  }
  b.sway = prev;
}

// ---------------------------------------------------------------------------------------------
// Tent
// ---------------------------------------------------------------------------------------------

/**
 * The tent of the camp, door toward local +Z.
 * - `worn` (the camp's first night): a patched A-frame of canvas on two poles and a ridge pole,
 *   held by guy ropes, one door flap tied back, a bedroll inside.
 * - `pavilion` (the camp grown): a wall tent with canvas walls, a pitched roof with eaves, corner
 *   poles, the front flaps rolled up and a pennant on the ridge.
 * opts: { rotation = 0, stage = 'worn', seed, id }
 * @param {PropFactory} f
 */
export function buildTent(f, x, y, z, opts = {}) {
  const rng = f.rng('tent', x, z, opts.seed);
  const stage = opts.stage === 'pavilion' ? 'pavilion' : 'worn';
  const b = f.builder(groundAO(0.8, 0.55));
  const canvas = f.extra.material('canvas', { side: THREE.DoubleSide });
  const patch = [0.82, 0.72, 0.55];
  let hw;
  let hl;
  if (stage === 'worn') {
    const W = 2.4;
    const L = 2.8;
    const H = 1.9;
    hw = W / 2;
    hl = L / 2;
    const sag = 0.07;
    // roof panels, cut in three along the ridge so the middle can sag
    const zs = [-hl, -hl / 3, hl / 3, hl];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const za = zs[i];
        const zb = zs[i + 1];
        const ridgeA = [0, i === 0 ? H : H - sag, za];
        const ridgeB = [0, i === 2 ? H : H - sag, zb];
        const eaveA = [s * hw, 0.04, za];
        const eaveB = [s * hw, 0.04, zb];
        const pts = s > 0 ? [eaveA, eaveB, ridgeB, ridgeA] : [eaveB, eaveA, ridgeA, ridgeB];
        const uL = (zb - za) / 2;
        const k = s > 0 ? 0.92 : 1;
        b.quad(canvas, pts, [[0, 0], [uL, 0], [uL, 1.2], [0, 1.2]], { color: [k, k, k] });
      }
    }
    // the back gable, closed
    b.tri(canvas, [hw, 0.04, -hl], [-hw, 0.04, -hl], [0, H, -hl], [1.2, 0], [0, 0], [0.6, 0.95]);
    // the front gable: the right half closed, the left flap tied back against the roof
    b.tri(canvas, [0, 0.04, hl], [hw, 0.04, hl], [0, H, hl], [0.6, 0], [1.2, 0], [0.6, 0.95]);
    b.tri(canvas, [-hw * 0.95, 0.06, hl + 0.02], [-hw * 0.45, 0.95, hl + 0.06], [0, H, hl], [0, 0], [0.4, 0.5], [0.6, 0.95], { color: [0.9, 0.86, 0.8] });
    // patches on the roof (lona remendada)
    for (let k = 0; k < 3; k++) {
      const s = k === 1 ? -1 : 1;
      const t = rng.range(0.25, 0.7);
      const zc = rng.range(-hl + 0.4, hl - 0.4);
      const pw = rng.range(0.28, 0.42);
      const ph = rng.range(0.22, 0.32);
      const px = s * hw * (1 - t);
      const py = 0.04 + (H - 0.04) * t;
      const nx = s * (H - 0.04);
      const ny = hw;
      const nl = Math.hypot(nx, ny);
      const off = 0.012;
      const ox = (nx / nl) * off;
      const oy = (ny / nl) * off;
      const dx = (-s * hw) / Math.hypot(hw, H) * (ph / 2);
      const dy = H / Math.hypot(hw, H) * (ph / 2);
      const pts = [
        [px - dx + ox, py - dy + oy, zc - pw / 2], [px - dx + ox, py - dy + oy, zc + pw / 2],
        [px + dx + ox, py + dy + oy, zc + pw / 2], [px + dx + ox, py + dy + oy, zc - pw / 2],
      ];
      if (s < 0) pts.reverse();
      b.quad(canvas, pts, [[0.1, 0.1], [0.4, 0.1], [0.4, 0.35], [0.1, 0.35]], { color: patch });
    }
    // poles: two uprights and the ridge pole sticking out
    for (const sz of [-1, 1]) b.box(TRIM, [0.09, H + 0.12, 0.09], { at: [0, (H + 0.12) / 2, sz * (hl + 0.05)], rotUV: true, faces: { ny: false } });
    b.box(TRIM, [0.08, 0.08, L + 0.4], { at: [0, H + 0.03, 0], rotUV: true });
    // guy ropes from the pole tops to pegs
    for (const sz of [-1, 1]) {
      const peg = [rng.range(-0.1, 0.1), 0, sz * (hl + 0.85)];
      strut(b, 'rope', [0, H + 0.05, sz * (hl + 0.12)], [peg[0], 0.12, peg[2]], 0.03);
      b.box(TRIM, [0.06, 0.22, 0.06], { at: [peg[0], 0.08, peg[2]], rot: [sz * 0.3, 0, 0] });
    }
    // a bedroll inside, by the open flap
    b.lathe('cloth_red', [{ y: -0.6, r: 0.17 }, { y: 0.6, r: 0.17 }], { segments: 8, at: [-0.35, 0.17, 0.2], rot: [Math.PI / 2, 0, 0], capTop: true, capBottom: true, color: [0.8, 0.72, 0.68] });
  } else {
    const W = 3.2;
    const L = 3.6;
    const Hw = 1.35;
    const H = 2.7;
    const eave = 0.25;
    hw = W / 2;
    hl = L / 2;
    // walls: back and sides; the front wall has the door gap with its flaps rolled up above it
    b.quad(canvas, [[hw, 0, -hl], [-hw, 0, -hl], [-hw, Hw, -hl], [hw, Hw, -hl]], [[0, 0], [W / 2, 0], [W / 2, Hw / 2], [0, Hw / 2]]);
    for (const s of [-1, 1]) {
      const pts = s > 0 ? [[hw, 0, hl], [hw, 0, -hl], [hw, Hw, -hl], [hw, Hw, hl]] : [[-hw, 0, -hl], [-hw, 0, hl], [-hw, Hw, hl], [-hw, Hw, -hl]];
      b.quad(canvas, pts, [[0, 0], [L / 2, 0], [L / 2, Hw / 2], [0, Hw / 2]], { color: [0.94, 0.94, 0.94] });
    }
    const door = 0.6;
    for (const s of [-1, 1]) {
      const a = s * door;
      const pts = s > 0 ? [[a, 0, hl], [hw, 0, hl], [hw, Hw, hl], [a, Hw, hl]] : [[-hw, 0, hl], [a, 0, hl], [a, Hw, hl], [-hw, Hw, hl]];
      b.quad(canvas, pts, [[0, 0], [(hw - door) / 2, 0], [(hw - door) / 2, Hw / 2], [0, Hw / 2]]);
      // the rolled flap over the door
      b.lathe(canvas, [{ y: 0, r: 0.08 }, { y: door, r: 0.08 }], { segments: 6, at: [s > 0 ? 0 : -door, Hw - 0.12, hl + 0.06], rot: [0, 0, -Math.PI / 2], capTop: true, capBottom: true, color: [0.85, 0.8, 0.72] });
    }
    // the gables above the walls
    for (const sz of [-1, 1]) {
      const zc = sz * hl;
      if (sz > 0) b.tri(canvas, [-hw, Hw, zc], [hw, Hw, zc], [0, H, zc], [0, 0], [W / 2, 0], [W / 4, 0.7]);
      else b.tri(canvas, [hw, Hw, zc], [-hw, Hw, zc], [0, H, zc], [0, 0], [W / 2, 0], [W / 4, 0.7]);
    }
    // the roof with eaves past the walls
    const rx = hw + eave;
    const ry = Hw - eave * ((H - Hw) / hw);
    for (const s of [-1, 1]) {
      const pts = s > 0
        ? [[rx, ry, -hl - eave], [rx, ry, hl + eave], [0, H + 0.02, hl + eave], [0, H + 0.02, -hl - eave]]
        : [[-rx, ry, hl + eave], [-rx, ry, -hl - eave], [0, H + 0.02, -hl - eave], [0, H + 0.02, hl + eave]];
      b.quad(canvas, pts, [[0, 0], [(L + 2 * eave) / 2, 0], [(L + 2 * eave) / 2, 1.1], [0, 1.1]], { color: s > 0 ? [0.86, 0.84, 0.8] : [1, 1, 1] });
    }
    // corner and ridge poles
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(TRIM, [0.1, Hw + 0.05, 0.1], { at: [sx * (hw + 0.04), (Hw + 0.05) / 2, sz * (hl + 0.04)], rotUV: true, faces: { ny: false } });
    for (const sz of [-1, 1]) {
      const ph = H + (sz > 0 ? 1.0 : 0.3);
      b.box(TRIM, [0.11, ph, 0.11], { at: [0, ph / 2, sz * (hl + 0.06)], rotUV: true, faces: { ny: false } });
    }
    // guy ropes at the corners
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const peg = [sx * (rx + 0.7), 0, sz * (hl + 0.3)];
        strut(b, 'rope', [sx * rx, ry, sz * (hl + 0.1)], [peg[0], 0.12, peg[2]], 0.03);
        b.box(TRIM, [0.06, 0.22, 0.06], { at: [peg[0], 0.08, peg[2]], rot: [0, 0, sx * 0.3] });
      }
    }
  }
  const group = f.finish(b, 'tent', x, y, z, opts.rotation ?? 0);
  // the pavilion's pennant on the front pole (its own swaying mesh)
  if (stage === 'pavilion') {
    const pb = f.builder();
    hangingCloth(pb, f.clothMaterial('cloth_red'), 0.3, 3.62, hl + 0.06, 0.5, 0.4, { rows: 3, swing: 1.6, lean: 0 });
    const pen = f.finish(pb, 'tent:pennant', 0, 0, 0, 0);
    group.add(pen);
    pen.updateMatrixWorld(true);
  }
  return f.result(group, { colliders: f.boxColliders(group, -hw - 0.05, hw + 0.05, -hl - 0.05, hl + 0.05) });
}

// ---------------------------------------------------------------------------------------------
// Map table
// ---------------------------------------------------------------------------------------------

/**
 * Surubin's map table: a rough trestle table with the map pinned by four stones, an inkpot, a quill
 * and a candle stub. The front (where one stands to read it) faces local +Z.
 * opts: { rotation = 0, seed, id = 'mapTable' }
 * @param {PropFactory} f
 */
export function buildMapTable(f, x, y, z, opts = {}) {
  const rng = f.rng('mapTable', x, z, opts.seed);
  const b = f.builder(groundAO(0.6));
  const W = 1.8;
  const D = 1.0;
  const Ht = 0.86;
  // top planks (three boards, slightly uneven) and two A-trestles with a stretcher
  for (let i = 0; i < 3; i++) {
    b.box('wood_planks', [W, 0.07, D / 3 - 0.02], { at: [rng.range(-0.03, 0.03), Ht + rng.range(-0.01, 0.01), (i - 1) * (D / 3)], faces: { ny: TRIM }, off: [rng.range(0, 2), i * 0.3] });
  }
  for (const sx of [-1, 1]) {
    const lx = sx * (W / 2 - 0.25);
    for (const sz of [-1, 1]) strut(b, TRIM, [lx, Ht - 0.03, sz * 0.12], [lx, 0, sz * (D / 2 - 0.05)], 0.09);
    b.box(TRIM, [0.08, 0.08, D - 0.15], { at: [lx, Ht - 0.08, 0], rotUV: true });
  }
  b.box(TRIM, [W - 0.5, 0.07, 0.07], { at: [0, 0.3, 0], rotUV: true });
  // the map sheet, slightly curled at the corners, and the stones holding it
  const map = f.extra.material('map_parchment');
  const mw = 1.3;
  const md = 0.82;
  const top = Ht + 0.06;
  b.quad(map, [[-mw / 2, top, md / 2], [mw / 2, top, md / 2], [mw / 2, top, -md / 2], [-mw / 2, top, -md / 2]], [[0, 0], [1, 0], [1, 1], [0, 1]], { normals: [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]] });
  const stone = { top: f.extra.material('boulder_moss'), side: f.extra.material('boulder') };
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    rockGeom(b, sx * (mw / 2 - 0.02), top - 0.01, sz * (md / 2 - 0.02), [0.06, 0.04, 0.05], rng, { ...stone, detail: 0 });
  }
  // inkpot and quill, candle stub on a saucer
  b.lathe('metal', [{ y: 0, r: 0.05 }, { y: 0.07, r: 0.05 }, { y: 0.09, r: 0.025 }], { segments: 8, at: [0.72, top - 0.01, -0.3], capTop: true, color: [0.35, 0.33, 0.4] });
  b.tri(f.extra.material('canvas', { side: THREE.DoubleSide }), [0.72, top + 0.08, -0.3], [0.86, top + 0.3, -0.42], [0.79, top + 0.3, -0.4], [0, 0], [0.1, 0.2], [0.05, 0.2], { color: [1.1, 1.1, 1.1] });
  b.lathe('metal', [{ y: 0, r: 0.08 }, { y: 0.02, r: 0.08 }], { segments: 8, at: [-0.74, top - 0.01, -0.32], capTop: true });
  b.lathe(f.extra.material('canvas'), [{ y: 0, r: 0.035 }, { y: 0.12, r: 0.032 }], { segments: 6, at: [-0.74, top + 0.01, -0.32], capTop: true, color: [1.15, 1.1, 1.0] });
  const rot = opts.rotation ?? 0;
  const group = f.finish(b, 'mapTable', x, y, z, rot);
  return f.result(group, {
    colliders: f.boxColliders(group, -W / 2, W / 2, -D / 2, D / 2),
    interact: { position: f.world(group, new THREE.Vector3(0, 0, D / 2 + 0.55)), radius: 1.2, id: opts.id ?? 'mapTable' },
  });
}

// ---------------------------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------------------------

/**
 * The cult's banner: the pufferfish on sea blue hanging from a crossbar, swaying in the wind. The
 * cloth faces local +Z.
 * - `pole` (the camp's first morning): a rough pole wedged in a cairn of stones.
 * - `mast` (the camp grown): a tall squared mast on a stone plinth, a spiked gilt finial on top.
 * opts: { rotation = 0, stage = 'pole', seed }
 * @param {PropFactory} f
 */
export function buildBanner(f, x, y, z, opts = {}) {
  const rng = f.rng('banner', x, z, opts.seed);
  const b = f.builder(groundAO(0.5));
  const mast = opts.stage === 'mast';
  const Hp = mast ? 4.6 : 3.5;
  const bar = Hp - (mast ? 0.45 : 0.3);
  const cw = 1.25;
  const ch = 2.25;
  if (mast) {
    b.box('stone_brick', [0.95, 0.42, 0.95], { at: [0, 0.21, 0], faces: { ny: false } });
    b.box('stone_brick', [0.7, 0.16, 0.7], { at: [0, 0.5, 0], faces: { ny: false }, off: [0.4, 0.2] });
    b.box('wood_planks_dark', [0.18, Hp - 0.5, 0.18], { at: [0, 0.5 + (Hp - 0.5) / 2, 0], rotUV: true, faces: { ny: false } });
    // the finial: a gilt ball with spikes, the pufferfish again
    b.lathe('metal', [{ y: -0.12, r: 0.02 }, { y: -0.06, r: 0.11 }, { y: 0.06, r: 0.11 }, { y: 0.12, r: 0.02 }], { segments: 8, at: [0, Hp + 0.14, 0], smooth: true, color: [1.5, 1.2, 0.55] });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const e = (k % 2 ? 0.35 : -0.25);
      const dir = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
      strut(b, 'metal', [dir[0] * 0.09, Hp + 0.14 + dir[1] * 0.09, dir[2] * 0.09], [dir[0] * 0.2, Hp + 0.14 + dir[1] * 0.2, dir[2] * 0.2], 0.025);
    }
  } else {
    // a rough pole, a little crooked, and the cairn holding it
    b.push([0, 0, 0], [rng.range(-0.03, 0.03), 0, rng.range(-0.03, 0.03)]);
    b.box(TRIM, [0.13, Hp, 0.13], { at: [0, Hp / 2 - 0.1, 0], rotUV: true, faces: { ny: false } });
    b.box(TRIM, [0.17, 0.12, 0.17], { at: [0, Hp - 0.06, 0], rot: [0, Math.PI / 4, 0] });
    b.pop();
    const stone = { top: f.extra.material('boulder_moss'), side: f.extra.material('boulder') };
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rng.range(-0.3, 0.3);
      rockGeom(b, Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32, [0.2, 0.15, 0.18], rng, { ...stone, detail: 0, yaw: rng.range(0, 6) });
    }
    rockGeom(b, 0.08, 0.18, -0.05, [0.17, 0.12, 0.15], rng, { ...stone, detail: 0 });
  }
  // the crossbar with its rope ties
  const bw = cw + 0.3;
  b.box(TRIM, [bw, 0.09, 0.09], { at: [0, bar, 0.1], rotUV: true });
  for (const s of [-1, 1]) strut(b, 'rope', [0, bar + (mast ? 0.35 : 0.22), 0.06], [s * (bw / 2 - 0.05), bar + 0.03, 0.1], 0.025);
  const group = f.finish(b, 'banner', x, y, z, opts.rotation ?? 0);
  // the cloth: its own swaying mesh (wind materials are never merged)
  const cb = f.builder();
  hangingCloth(cb, f.clothMaterial('banner_fish'), 0, bar - 0.02, 0.16, cw, ch, { rows: 7, swing: 2.4, lean: 0.05 });
  const cloth = f.finish(cb, 'banner:cloth', 0, 0, 0, 0);
  group.add(cloth);
  cloth.updateMatrixWorld(true);
  return f.result(group, { colliders: [{ type: 'circle', x, z, r: mast ? 0.5 : 0.42 }] });
}

// ---------------------------------------------------------------------------------------------
// Stakes
// ---------------------------------------------------------------------------------------------

/**
 * A sharpened stake with a ribbon tied on top, at local (sx, 0, sz), into `b` (and the ribbon into
 * `rb`, a swaying builder).
 * @param {MeshBuilder} b @param {MeshBuilder|null} rb @param {THREE.Material|null} ribbon
 */
function stakeGeom(b, rb, ribbon, sx, sz, rng, h = 0.85) {
  const lean = [rng.range(-0.06, 0.06), rng.range(0, 6), rng.range(-0.06, 0.06)];
  b.push([sx, 0, sz], lean);
  b.box(TRIM, [0.08, h, 0.08], { at: [0, h / 2 - 0.08, 0], rotUV: true, faces: { ny: false, py: false } });
  const e = 0.04;
  const t = h - 0.08;
  const A = [0, t + 0.1, 0];
  const C = [[-e, t, e], [e, t, e], [e, t, -e], [-e, t, -e]];
  for (let k = 0; k < 4; k++) b.tri(TRIM, C[k], C[(k + 1) % 4], A, [0, 0], [0.08, 0], [0.04, 0.1]);
  b.box('rope', [0.1, 0.05, 0.1], { at: [0, t - 0.1, 0] });
  b.pop();
  if (rb && ribbon) hangingCloth(rb, ribbon, sx + 0.06, t - 0.08, sz + 0.06, 0.07, 0.5, { rows: 4, swing: 3, lean: 0.03 });
}

/**
 * The return mast (a stake's `mast` kind): a tall crooked pole wedged in a cairn, a gilt spiked ball
 * on top (the pufferfish), the cult's fish on a red banner from a crossbar — red so it is seen from
 * far across a big map —, two red ribbons tied round the pole and a few stakes with ribbons round
 * the cairn. The cloth faces local +Z.
 * @param {PropFactory} f
 */
function buildReturnMast(f, x, y, z, opts) {
  const rng = f.rng('stake', x, z, opts.seed);
  const b = f.builder(groundAO(0.5));
  const rb = f.builder();
  const ribbon = f.clothMaterial('cloth_red');
  const Hp = 4.2;
  const bar = Hp - 0.32;
  const cw = 0.95;
  const ch = 1.7;
  // the pole, a little crooked, its top cut square, and the cairn holding it
  b.push([0, 0, 0], [rng.range(-0.025, 0.025), 0, rng.range(-0.025, 0.025)]);
  b.box(TRIM, [0.14, Hp, 0.14], { at: [0, Hp / 2 - 0.1, 0], rotUV: true, faces: { ny: false } });
  b.box(TRIM, [0.18, 0.12, 0.18], { at: [0, Hp - 0.06, 0], rot: [0, Math.PI / 4, 0] });
  // the finial: a gilt ball with spikes, the pufferfish again
  b.lathe('metal', [{ y: -0.1, r: 0.02 }, { y: -0.05, r: 0.09 }, { y: 0.05, r: 0.09 }, { y: 0.1, r: 0.02 }], { segments: 8, at: [0, Hp + 0.1, 0], smooth: true, color: [1.5, 1.2, 0.55] });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const e = k % 2 ? 0.35 : -0.25;
    const dir = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
    strut(b, 'metal', [dir[0] * 0.07, Hp + 0.1 + dir[1] * 0.07, dir[2] * 0.07], [dir[0] * 0.17, Hp + 0.1 + dir[1] * 0.17, dir[2] * 0.17], 0.022);
  }
  // the crossbar with its rope ties
  const bw = cw + 0.24;
  b.box(TRIM, [bw, 0.08, 0.08], { at: [0, bar, 0.1], rotUV: true });
  for (const s of [-1, 1]) strut(b, 'rope', [0, bar + 0.22, 0.06], [s * (bw / 2 - 0.05), bar + 0.03, 0.1], 0.025);
  // rope wound round the pole where the ribbons are tied
  for (const h of [1.25, 1.55]) b.box('rope', [0.18, 0.05, 0.18], { at: [0, h, 0] });
  b.pop();
  const stone = { top: f.extra.material('boulder_moss'), side: f.extra.material('boulder') };
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + rng.range(-0.3, 0.3);
    rockGeom(b, Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36, [0.22, 0.16, 0.2], rng, { ...stone, detail: 0, yaw: rng.range(0, 6) });
  }
  rockGeom(b, 0.1, 0.2, -0.06, [0.18, 0.13, 0.16], rng, { ...stone, detail: 0 });
  rockGeom(b, -0.12, 0.18, 0.08, [0.16, 0.12, 0.14], rng, { ...stone, detail: 0 });
  // the ribbons on the pole, and three stakes with ribbons round the cairn
  for (const [h, dx] of [[1.25, 0.08], [1.55, -0.08]]) hangingCloth(rb, ribbon, dx, h, 0.08, 0.07, 0.55, { rows: 4, swing: 3, lean: 0.03 });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5 + rng.range(-0.25, 0.25);
    stakeGeom(b, rb, ribbon, Math.cos(a) * 0.95, Math.sin(a) * 0.95, rng, 0.75);
  }
  const group = f.finish(b, 'stake', x, y, z, opts.rotation ?? 0);
  // the cloth: its own swaying mesh (wind materials are never merged)
  hangingCloth(rb, f.clothMaterial('banner_fish_red'), 0, bar - 0.02, 0.15, cw, ch, { rows: 7, swing: 2.4, lean: 0.05 });
  const cloth = f.finish(rb, 'stake:ribbon', 0, 0, 0, 0);
  group.add(cloth);
  cloth.updateMatrixWorld(true);
  return f.result(group, { colliders: [{ type: 'circle', x, z, r: 0.48 }] });
}

/**
 * Stakes in the ground.
 * - `ribbon`: one stake with a red ribbon — where the player arrives on an expedition and walks
 *   back to camp from (a small map).
 * - `mast`: the return mast for a big map — a tall pole with the cult's fish on a red banner, seen
 *   from far, and marked on the minimap (`buildReturnMast`).
 * - `plot`: a building plot, `width` × `depth`: a stake at each corner, a rope between them and a
 *   ribbon on the front-left one. Walkable (no collider): a building rises on it later.
 * opts: { rotation = 0, kind = 'ribbon', width = 4, depth = 3, seed }
 * @param {PropFactory} f
 */
export function buildStake(f, x, y, z, opts = {}) {
  if (opts.kind === 'mast') return buildReturnMast(f, x, y, z, opts);
  const rng = f.rng('stake', x, z, opts.seed);
  const plot = opts.kind === 'plot';
  const b = f.builder(groundAO(0.4));
  const rb = f.builder();
  const ribbon = f.clothMaterial('cloth_red');
  /** @type {import('../TileMap.js').Collider[]} */
  const colliders = [];
  if (plot) {
    const hw = clamp(Number(opts.width) || 4, 1.5, 10) / 2;
    const hd = clamp(Number(opts.depth) || 3, 1.5, 10) / 2;
    const corners = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]];
    corners.forEach(([cx, cz], i) => stakeGeom(b, i === 0 ? rb : null, i === 0 ? ribbon : null, cx, cz, rng, 0.7));
    // the rope round the plot, sagging between the stakes
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [cx, cz] = corners[(i + 1) % 4];
      const mid = [(ax + cx) / 2, 0.36, (az + cz) / 2];
      strut(b, 'rope', [ax, 0.48, az], mid, 0.03);
      strut(b, 'rope', mid, [cx, 0.48, cz], 0.03);
    }
  } else {
    stakeGeom(b, rb, ribbon, 0, 0, rng, 0.95);
    colliders.push({ type: 'circle', x, z, r: 0.12 });
  }
  const group = f.finish(b, 'stake', x, y, z, opts.rotation ?? 0);
  const ribbons = f.finish(rb, 'stake:ribbon', 0, 0, 0, 0);
  group.add(ribbons);
  ribbons.updateMatrixWorld(true);
  return f.result(group, { colliders });
}

// ---------------------------------------------------------------------------------------------
// Buildings of the camp
// ---------------------------------------------------------------------------------------------

/**
 * The footprint of each camp building (local, width along X × depth along Z), the size of the plot
 * it stands on (ObjectCatalog.js keeps the same numbers for the editor's footprint: change both).
 */
export const CAMP_BUILDING_SIZE = Object.freeze({ forge: [4, 3.5], silo: [3.5, 3.5], lodge: [5, 3.5], altar: [1.6, 1.2], chest: [1.6, 1.0] });

/**
 * A building going up (`frame`): the plot's stone footing, four corner posts with two rings of
 * beams, braces, a plank walk on the front, a ladder, a stack of logs and a heap of stones beside.
 * Every camp building looks like this while it is being built (the scaffold of PLANO F1).
 * @param {PropFactory} f @param {MeshBuilder} b
 */
function buildingFrame(f, b, w, d, rng) {
  const hw = w / 2;
  const hd = d / 2;
  const stone = { top: f.extra.material('boulder_moss'), side: f.extra.material('boulder') };
  // the footing: a low course of cut stone round the plot, a gap for the door
  for (const s of [-1, 1]) {
    b.box('stone_brick', [0.36, 0.26, d], { at: [s * (hw - 0.18), 0.13, 0], faces: { ny: false }, off: [rng.range(0, 1), 0] });
    b.box('stone_brick', [hw - 0.5, 0.26, 0.36], { at: [s * (hw / 2 + 0.25), 0.13, hd - 0.18], faces: { ny: false } });
  }
  b.box('stone_brick', [w - 0.72, 0.26, 0.36], { at: [0, 0.13, -hd + 0.18], faces: { ny: false } });
  // the posts, the beams and the braces
  const H = 2.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(TRIM, [0.12, H, 0.12], { at: [sx * (hw - 0.1), H / 2, sz * (hd - 0.1)], rotUV: true, faces: { ny: false } });
  for (const y of [1.25, H - 0.08]) {
    for (const sz of [-1, 1]) b.box(TRIM, [w - 0.1, 0.08, 0.08], { at: [0, y, sz * (hd - 0.1)], rotUV: true });
    for (const sx of [-1, 1]) b.box(TRIM, [0.08, 0.08, d - 0.1], { at: [sx * (hw - 0.1), y, 0], rotUV: true });
  }
  for (const sx of [-1, 1]) strut(b, TRIM, [sx * (hw - 0.1), 0.15, -hd + 0.1], [sx * (hw - 0.1), 1.2, -hd + 0.1 + Math.min(1.4, d * 0.4)], 0.06);
  strut(b, TRIM, [-hw + 0.1, 1.3, -hd + 0.1], [-hw + 0.1 + Math.min(1.6, w * 0.4), H - 0.1, -hd + 0.1], 0.06);
  // the plank walk on the front beam, and the ladder up to it
  for (let k = 0; k < 3; k++) b.box('wood_planks', [w - 0.3, 0.05, 0.16], { at: [0, 1.32, hd - 0.1 + (k - 1) * 0.18], off: [k * 0.4, 0] });
  for (const s of [-1, 1]) strut(b, TRIM, [hw * 0.5 + s * 0.18, 0, hd + 0.55], [hw * 0.5 + s * 0.18, 1.45, hd + 0.05], 0.05);
  for (let k = 1; k <= 4; k++) {
    const t = k / 5;
    b.box(TRIM, [0.4, 0.04, 0.04], { at: [hw * 0.5, 1.45 * t, hd + 0.55 - 0.5 * t], rotUV: true });
  }
  // the logs waiting (three below, two on top) and a heap of stones
  const lx = -hw - 0.75;
  for (const [dy, dz] of [[0.13, -0.28], [0.13, 0], [0.13, 0.28], [0.36, -0.14], [0.36, 0.14]]) {
    b.tube('bark', [lx + dz, dy, -0.9], [lx + dz, dy, 0.9], 0.13, 0.12, { segments: 6, capTop: 'wood_planks', capBottom: 'wood_planks', twist: dz * 7 });
  }
  for (let k = 0; k < 5; k++) rockGeom(b, hw + 0.6 + rng.range(-0.25, 0.25), 0, rng.range(-0.5, 0.5), [0.2, 0.15, 0.18], rng, { ...stone, detail: 0, yaw: rng.range(0, 6) });
}

/** Where the forge's fire burns (local), its light and its chimney's smoke (`buildingForge`). */
const FORGE_FIRE = Object.freeze({ x: -0.5, y: 0.9, z: -0.3, chimneyZ: -1.35, chimneyTop: 3.4 });

/**
 * The forge, an open-air smithy seen from above: a low stone wall at the back with a narrow plank
 * awning over it on two posts (the tools hang there), the chimney rising through the awning, and in
 * front of it, in the open, the stone hearth with its fire (a flame, a warm light day and night,
 * embers, smoke from the chimney) and its bellows; the anvil on a stump, a quench barrel, a heap of
 * charcoal — all forward of the awning, so the camera sees the work and not a roof.
 * @param {PropFactory} f @param {MeshBuilder} b
 */
function buildingForge(f, b, w, d, rng) {
  const hw = w / 2;
  const hd = d / 2;
  const F = FORGE_FIRE;
  // the floor: flagstones, a little proud of the ground
  b.box('stone_brick', [w, 0.1, d], { at: [0, 0.05, 0], faces: { ny: false }, off: [0.3, 0.2] });
  // the back wall, waist high, and the awning over it (only the back: a metre deep)
  b.box('stone_brick', [w, 1.0, 0.3], { at: [0, 0.5, -hd + 0.15], faces: { ny: false } });
  const Ha = 2.3;
  const front = -hd + 1.0;
  for (const sx of [-1, 1]) b.box(TRIM, [0.15, Ha, 0.15], { at: [sx * (hw - 0.12), Ha / 2, front], rotUV: true, faces: { ny: false } });
  b.box(TRIM, [w + 0.1, 0.12, 0.12], { at: [0, Ha - 0.04, front], rotUV: true });
  const aw = [[hw + 0.25, Ha + 0.02, front + 0.2], [hw + 0.25, Ha + 0.5, -hd - 0.2], [-hw - 0.25, Ha + 0.5, -hd - 0.2], [-hw - 0.25, Ha + 0.02, front + 0.2]];
  b.quad('wood_planks_dark', [aw[3], aw[0], aw[1], aw[2]], [[0, 0], [w / 1.5, 0], [w / 1.5, 0.9], [0, 0.9]]);
  b.quad('wood_planks_dark', [aw[0], aw[3], aw[2], aw[1]], [[0, 0], [w / 1.5, 0], [w / 1.5, 0.9], [0, 0.9]], { color: [0.6, 0.6, 0.6] });
  // the tools hanging from the awning's beam (tongs, hammers)
  for (let k = 0; k < 4; k++) b.box('metal', [0.05, 0.5, 0.05], { at: [0.55 + k * 0.32, Ha - 0.35, front - 0.06], color: [0.5, 0.5, 0.55] });
  // the chimney through the awning, and the hearth before it in the open, its bed of embers
  b.box('chimney_stone', [0.8, F.chimneyTop, 0.7], { at: [F.x, F.chimneyTop / 2, F.chimneyZ], faces: { ny: false } });
  b.box('stone_brick', [1.5, 0.8, 1.5], { at: [F.x, 0.4, (F.chimneyZ + 0.2 + F.z + 0.55) / 2 - 0.05], faces: { ny: false } });
  b.lathe(f.extra.material('ash'), [{ y: 0.8, r: 0.45 }, { y: 0.85, r: 0.32 }, { y: 0.87, r: 0.02 }], { segments: 8, at: [F.x, 0, F.z], smooth: true });
  // the bellows beside the hearth: two boards and the leather between
  b.push([F.x - 1.05, 0.55, F.z - 0.15], [0, 0, -0.25]);
  b.box('wood_planks_dark', [0.5, 0.06, 0.32], { at: [0, 0.12, 0] });
  b.box('wood_planks_dark', [0.5, 0.06, 0.32], { at: [0, -0.12, 0] });
  b.box(f.extra.material('canvas'), [0.42, 0.2, 0.28], { at: [-0.04, 0, 0], color: [0.45, 0.32, 0.22] });
  b.box(TRIM, [0.3, 0.05, 0.05], { at: [-0.4, 0.12, 0] });
  b.pop();
  b.box(TRIM, [0.1, 0.55, 0.1], { at: [F.x - 1.05, 0.27, F.z - 0.15] });
  // the anvil on its stump, in the open
  const ax = 0.85, az = 0.55;
  b.tube('bark', [ax, 0, az], [ax, 0.5, az], 0.24, 0.22, { segments: 7, capTop: 'wood_planks' });
  b.box('metal', [0.55, 0.12, 0.2], { at: [ax, 0.62, az], color: [0.45, 0.45, 0.5] });
  b.box('metal', [0.22, 0.12, 0.16], { at: [ax, 0.52, az], color: [0.4, 0.4, 0.45] });
  b.tri('metal', [ax + 0.27, 0.68, az + 0.08], [ax + 0.27, 0.68, az - 0.08], [ax + 0.5, 0.65, az], [0, 0], [0.1, 0], [0.05, 0.1], { color: [0.45, 0.45, 0.5] });
  b.box('metal', [0.06, 0.06, 0.3], { at: [ax - 0.05, 0.71, az + 0.02], rot: [0, 0.6, 0], color: [0.35, 0.35, 0.38] });
  // the quench barrel and a heap of charcoal
  b.lathe('wood_planks_dark', [{ y: 0, r: 0.26 }, { y: 0.35, r: 0.3 }, { y: 0.7, r: 0.26 }], { segments: 8, at: [hw - 0.45, 0, -0.35], capTop: true, smooth: true });
  b.lathe(f.extra.material('ash'), [{ y: 0, r: 0.42 }, { y: 0.18, r: 0.3 }, { y: 0.28, r: 0.05 }], { segments: 7, at: [-hw + 0.5, 0.1, hd - 0.55], smooth: true, color: [0.35, 0.33, 0.34] });
  const flame = f.flame({ width: 0.6, height: 0.6, seed: rng.range(0, 100), glowSize: 1.6, glowIntensity: 0.5 });
  flame.object.position.set(F.x, F.y, F.z);
  return flame;
}

/**
 * The silo: a round tower of upright planks on a stone ring, hooped with rope, under a pointed
 * thatch roof with a cap; a plank door at the front and a ladder up to the hatch.
 * @param {PropFactory} f @param {MeshBuilder} b
 */
function buildingSilo(f, b, w) {
  const R = w / 2 - 0.35;
  const H = 3.2;
  b.lathe('stone_brick', [{ y: 0, r: R + 0.18 }, { y: 0.45, r: R + 0.14 }], { segments: 12, capTop: true });
  b.lathe('wood_planks', [{ y: 0.45, r: R }, { y: H, r: R - 0.05 }], { segments: 12 });
  for (const y of [1.2, 2.3]) b.lathe('rope', [{ y: y - 0.04, r: R + 0.03 }, { y: y + 0.04, r: R + 0.03 }], { segments: 12 });
  b.lathe('roof_thatch', [{ y: H - 0.15, r: R + 0.45 }, { y: H + 0.5, r: R * 0.65 }, { y: H + 1.55, r: 0.08 }], { segments: 12, capBottom: true });
  b.lathe(TRIM, [{ y: H + 1.45, r: 0.1 }, { y: H + 1.8, r: 0.02 }], { segments: 6 });
  // the door, and the ladder to the hatch under the eave
  b.box('door', [0.8, 1.5, 0.08], { at: [0, 0.45 + 0.75, R - 0.02] });
  for (const s of [-1, 1]) strut(b, TRIM, [R * 0.55 + s * 0.18, 0, R + 0.5], [R * 0.55 + s * 0.18, H - 0.2, R - 0.05], 0.05);
  for (let k = 1; k <= 7; k++) {
    const t = k / 8;
    b.box(TRIM, [0.4, 0.04, 0.04], { at: [R * 0.55, (H - 0.2) * t, R + 0.5 - 0.55 * t], rotUV: true });
  }
  b.box('wood_planks_dark', [0.55, 0.5, 0.06], { at: [R * 0.55, H - 0.45, R - 0.02] });
}

/**
 * Surubin's altar under the banner, made of what was left of the first building: a slab of stone
 * on two stacked stones, a plank shelf, shells and fish spines along its edge, a pale salt stone in
 * the middle, two stubs of candles.
 * @param {PropFactory} f @param {MeshBuilder} b
 */
function buildingAltar(f, b, rng) {
  const stone = { top: f.extra.material('boulder_moss'), side: f.extra.material('boulder') };
  for (const s of [-1, 1]) {
    rockGeom(b, s * 0.5, 0, 0, [0.28, 0.32, 0.3], rng, { ...stone, detail: 0, yaw: rng.range(0, 6) });
    rockGeom(b, s * 0.48, 0.38, 0.02, [0.22, 0.2, 0.24], rng, { ...stone, detail: 0, yaw: rng.range(0, 6) });
  }
  b.box('stone_brick', [1.5, 0.14, 0.75], { at: [0, 0.68, 0], off: [0.3, 0.1] });
  b.box('wood_planks', [1.2, 0.06, 0.4], { at: [0, 0.2, 0.18] });
  // the salt stone in the middle (pale, catching the light), the candles, shells and spines
  b.lathe(f.extra.material('canvas'), [{ y: 0, r: 0.12 }, { y: 0.16, r: 0.13 }, { y: 0.28, r: 0.04 }], { segments: 6, at: [0, 0.75, -0.05], smooth: true, capBottom: true, color: [1.35, 1.35, 1.4] });
  for (const s of [-1, 1]) b.lathe(f.extra.material('canvas'), [{ y: 0, r: 0.04 }, { y: 0.14, r: 0.035 }], { segments: 6, at: [s * 0.45, 0.75, 0.05], capTop: true, color: [1.15, 1.1, 1.0] });
  for (let k = 0; k < 7; k++) {
    const x = -0.68 + k * 0.226;
    if (k % 2) b.lathe(f.extra.material('canvas'), [{ y: 0, r: 0.07 }, { y: 0.04, r: 0.05 }, { y: 0.05, r: 0.01 }], { segments: 5, at: [x, 0.75, 0.3], color: [1.25, 1.05, 0.95] });
    else b.tri(f.extra.material('canvas'), [x - 0.03, 0.75, 0.32], [x + 0.03, 0.75, 0.32], [x, 0.98, 0.36], [0, 0], [0.05, 0], [0.025, 0.2], { color: [1.2, 1.18, 1.1] });
  }
}

/**
 * The camp's chest, where the expeditions' resources are stored: a big iron-banded wooden chest on
 * two beams, its lid rounded, a brass lock plate; a sack and a coil of rope beside it.
 * @param {PropFactory} f @param {MeshBuilder} b
 */
function buildingChest(f, b, rng) {
  const W = 1.25, D = 0.72, H = 0.62;
  for (const sx of [-1, 1]) b.box(TRIM, [0.14, 0.12, D + 0.12], { at: [sx * (W / 2 - 0.15), 0.06, 0], rotUV: true });
  b.box('wood_planks', [W, H, D], { at: [0, 0.12 + H / 2, 0], faces: { ny: false }, off: [rng.range(0, 1), 0] });
  // the rounded lid: a half barrel along the chest
  b.lathe('wood_planks_dark', [{ y: -W / 2, r: D / 2 }, { y: W / 2, r: D / 2 }], { segments: 10, at: [0, 0.12 + H, 0], rot: [0, 0, Math.PI / 2], capTop: true, capBottom: true, smooth: true });
  // iron bands round body and lid, the corners, the lock plate
  for (const x of [-W / 2 + 0.16, 0, W / 2 - 0.16]) {
    b.box('metal', [0.07, H + 0.02, D + 0.03], { at: [x, 0.12 + H / 2, 0], color: [0.38, 0.38, 0.42] });
    b.lathe('metal', [{ y: -0.035, r: D / 2 + 0.02 }, { y: 0.035, r: D / 2 + 0.02 }], { segments: 10, at: [x, 0.12 + H, 0], rot: [0, 0, Math.PI / 2], color: [0.38, 0.38, 0.42] });
  }
  b.box('metal', [0.18, 0.2, 0.04], { at: [0, 0.12 + H - 0.06, D / 2 + 0.02], color: [1.4, 1.1, 0.55] });
  // a sack and a coil of rope beside
  b.lathe(f.extra.material('canvas'), [{ y: 0, r: 0.2 }, { y: 0.2, r: 0.26 }, { y: 0.42, r: 0.18 }, { y: 0.5, r: 0.06 }], { segments: 8, at: [W / 2 + 0.28, 0, 0.12], smooth: true, capBottom: true, color: [0.85, 0.75, 0.6] });
  b.lathe('rope', [{ y: 0, r: 0.2 }, { y: 0.1, r: 0.2 }], { segments: 10, at: [-W / 2 - 0.25, 0, 0.18], capTop: true, color: [0.95, 0.9, 0.8] });
}
/**
 * A building of the camp (PLANO-DE-MECANICAS E, F1), on its plot: `forge`, `silo` or `lodge`, each
 * either going up (`frame`: the footing, the scaffold, the logs and stones waiting) or `built`; or
 * the `altar` (one stage). The front (the door, the open side) faces local +Z.
 * - forge: an open shed with a stone hearth, its fire and chimney (a light day and night), an anvil;
 * - silo: a round plank tower on a stone ring under a pointed thatch roof, a ladder to its hatch;
 * - lodge: a log cabin with a thatch roof, a chimney and a lantern by the door (`buildHouse`);
 * - altar: Surubin's altar of stone and planks, shells and fish spines on its edge;
 * - chest: the camp's chest, where the resources are stored (one stage).
 * opts: { rotation = 0, kind = 'forge', stage = 'frame', seed, id }
 * @param {PropFactory} f
 */
export function buildCampBuilding(f, x, y, z, opts = {}) {
  const kind = Object.hasOwn(CAMP_BUILDING_SIZE, opts.kind) ? opts.kind : 'forge';
  const stage = kind === 'altar' || kind === 'chest' || opts.stage === 'built' ? 'built' : 'frame';
  const [w, d] = CAMP_BUILDING_SIZE[kind];
  const rot = opts.rotation ?? 0;
  if (kind === 'lodge' && stage === 'built') {
    return buildHouse(f, x, y, z, {
      width: w, depth: d, rotation: rot, seed: opts.seed, id: opts.id ?? 'lodge', wall: 'log_wall', roof: 'roof_thatch',
      gable: 'log_wall', plinthHeight: 0.3, storyHeight: 2.4, pitch: 40, chimney: true, chimneySide: 1, door: 'front',
      shutters: false, flowerboxes: false, lantern: true, sign: false, woodpile: true, doorHood: false,
    });
  }
  const rng = f.rng('campBuilding', x, z, opts.seed);
  const b = f.builder(groundAO(0.6, 0.6));
  /** @type {ReturnType<PropFactory['flame']>|null} */
  let flame = null;
  if (stage === 'frame') buildingFrame(f, b, w, d, rng);
  else if (kind === 'forge') flame = buildingForge(f, b, w, d, rng);
  else if (kind === 'silo') buildingSilo(f, b, w);
  else if (kind === 'chest') buildingChest(f, b, rng);
  else buildingAltar(f, b, rng);
  const group = f.finish(b, `campBuilding:${kind}`, x, y, z, rot);
  /** @type {any} */
  const extras = {};
  if (flame) {
    group.add(flame.object);
    group.updateMatrixWorld(true);
    const at = (lx, ly, lz) => f.world(group, new THREE.Vector3(lx, ly, lz));
    const F = FORGE_FIRE;
    extras.lights = [{ position: at(F.x, F.y + 0.5, F.z + 0.3), color: 0xff7a30, intensity: 6, distance: 6.5, flicker: 0.45, nightOnly: false }];
    extras.emitters = [
      { preset: 'embers', position: at(F.x, F.y + 0.1, F.z), rate: 2.5 },
      { preset: 'smoke', position: at(F.x, F.chimneyTop + 0.2, F.chimneyZ), rate: 1.8 },
    ];
    extras.flames = [flame];
  }
  // the frame is walked round and through its door gap only at the posts; the rest is solid
  const hw = w / 2, hd = d / 2;
  const colliders = stage === 'frame'
    ? [-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
      const p = f.world(group, new THREE.Vector3(sx * (hw - 0.1), 0, sz * (hd - 0.1)));
      return { type: /** @type {'circle'} */ ('circle'), x: p.x, z: p.z, r: 0.2 };
    }))
    : kind === 'silo' ? [{ type: /** @type {'circle'} */ ('circle'), x, z, r: hw - 0.15 }]
      : kind === 'altar' ? f.boxColliders(group, -0.78, 0.78, -0.4, 0.4)
        : kind === 'chest' ? f.boxColliders(group, -0.7, 0.7, -0.42, 0.42)
        : f.boxColliders(group, -hw, hw, -hd, hd);
  return f.result(group, { colliders, ...extras });
}
