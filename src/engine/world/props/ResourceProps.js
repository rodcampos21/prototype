import * as THREE from 'three';
import { smoothstep } from '../../utils/math.js';
import { rockGeom } from './SmallProps.js';

/**
 * Resources to gather (the `resource` type, `camp: true` in the catalog): what the player chops,
 * breaks and picks on an expedition. Each kind has two stages (`opts.stage`, the catalog's
 * RESOURCE_STAGES): `full`, gathered with Space, and `spent`, what is left until it grows back —
 * a level shows one at a time with `unless` / `when` on the flag gathering sets.
 * - `tree`: a tree (Trees.js, `opts.tree` and `opts.height`) → a stump cut by an axe, chips round it
 *   and the felled trunk lying beside it.
 * - `stone`: a grey boulder broken by pale veins of good stone → rubble.
 * - `herbs`: a low bush of leaves with small white and lilac flowers → bare twigs.
 * Anything else than a known kind builds a tree (level data is untrusted).
 *
 * @import { PropFactory } from '../Props.js'
 * @import { MeshBuilder } from './MeshBuilder.js'
 */

const groundAO = (h = 0.5, k = 0.62) => (px, py) => k + (1 - k) * smoothstep(-0.05, h, py);

/**
 * A resource. opts: { rotation, kind = 'tree', stage = 'full', tree = 'oak', height = 4, seed }
 * @param {PropFactory} f
 */
export function buildResource(f, x, y, z, opts = {}) {
  const kind = opts.kind === 'stone' || opts.kind === 'herbs' ? opts.kind : 'tree';
  const spent = opts.stage === 'spent';
  if (kind === 'tree') {
    if (!spent) return f.tree(x, y, z, { kind: opts.tree ?? 'oak', height: Math.min(6, Math.max(2.5, Number(opts.height) || 4)), seed: opts.seed, rotation: opts.rotation });
    return buildStump(f, x, y, z, opts);
  }
  if (kind === 'stone') return spent ? buildRubble(f, x, y, z, opts) : buildVein(f, x, y, z, opts);
  return buildHerbs(f, x, y, z, opts, spent);
}

/**
 * The stump of a chopped tree: the cut face light and ringed, the bark round it, chips on the
 * ground and the trunk lying where it fell (toward local +X).
 * @param {PropFactory} f
 */
function buildStump(f, x, y, z, opts) {
  const rng = f.rng('resource:stump', x, z, opts.seed);
  const b = f.builder(groundAO(0.3));
  const r = 0.32;
  const h = 0.72;
  b.lathe('bark', [{ y: -0.05, r: r + 0.05 }, { y: 0.08, r: r + 0.02 }, { y: h, r }], { segments: 7, capTop: 'wood_planks', uRepeat: 1.5 });
  // the cut: a slanted lip where the axe went in
  b.box('wood_planks', [r * 1.2, 0.05, 0.12], { at: [0.02, h + 0.02, r * 0.45], rot: [0.35, 0, 0], color: [1.15, 1.08, 0.95] });
  // roots
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
    b.tube('bark', [Math.cos(a) * r * 0.7, 0.08, Math.sin(a) * r * 0.7], [Math.cos(a) * (r + 0.3), -0.02, Math.sin(a) * (r + 0.3)], 0.08, 0.04, { segments: 5 });
  }
  // chips
  for (let k = 0; k < 6; k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0.4, 0.9);
    b.box('wood_planks', [0.12, 0.025, 0.06], { at: [Math.cos(a) * d, 0.015, Math.sin(a) * d], rot: [0, rng.range(0, 3), 0], color: [1.2, 1.1, 0.95] });
  }
  // the felled trunk
  const len = rng.range(2.2, 2.8);
  b.tube('bark', [0.6, 0.26, 0.15], [0.6 + len, 0.22, 0.4], 0.26, 0.19, { segments: 7, capTop: 'wood_planks', capBottom: 'wood_planks', twist: 0.4 });
  const group = f.finish(b, 'resource:stump', x, y, z, opts.rotation ?? 0);
  const end = f.world(group, new THREE.Vector3(0.55 + len * 0.6, 0, 0.3));
  return f.result(group, { colliders: [{ type: 'circle', x, z, r: r + 0.06 }, { type: 'circle', x: end.x, z: end.z, r: 0.22 }] });
}

/**
 * A boulder of good stone: a grey mass split by pale veins, a few loose chunks at its foot.
 * @param {PropFactory} f
 */
function buildVein(f, x, y, z, opts) {
  const rng = f.rng('resource:vein', x, z, opts.seed);
  const b = f.builder(groundAO(0.5, 0.66));
  const grey = { top: f.extra.material('boulder_moss'), side: f.extra.material('boulder') };
  const s = [0.72 * rng.range(0.9, 1.1), 0.7 * rng.range(0.9, 1.1), 0.6 * rng.range(0.9, 1.1)];
  rockGeom(b, 0, 0, 0, s, rng, { ...grey, detail: 1, flatTop: 0.1, tint: [0.92, 0.94, 1] });
  // the veins: pale slabs of cut-worthy stone breaking through the flanks
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rng.range(-0.4, 0.4);
    rockGeom(b, Math.cos(a) * s[0] * 0.62, rng.range(0.15, 0.45), Math.sin(a) * s[2] * 0.62, [0.22, 0.16, 0.18], rng,
      { top: 'stone_tiles', side: 'crag', detail: 0, yaw: a, tint: [1.25, 1.22, 1.15], rough: 0.5 });
  }
  for (let k = 0; k < 3; k++) {
    const a = rng.range(0, Math.PI * 2);
    rockGeom(b, Math.cos(a) * (s[0] + 0.25), 0, Math.sin(a) * (s[2] + 0.25), [0.13, 0.09, 0.12], rng, { top: 'stone_tiles', side: 'crag', detail: 0, tint: [1.15, 1.12, 1.08] });
  }
  const group = f.finish(b, 'resource:vein', x, y, z, opts.rotation ?? rng.range(0, Math.PI * 2));
  return f.result(group, { colliders: [{ type: 'circle', x, z, r: Math.max(s[0], s[2]) * 0.95 }] });
}

/**
 * What is left of a broken boulder: a low heap of rubble (walkable round it).
 * @param {PropFactory} f
 */
function buildRubble(f, x, y, z, opts) {
  const rng = f.rng('resource:rubble', x, z, opts.seed);
  const b = f.builder(groundAO(0.25, 0.7));
  const grey = { top: f.extra.material('boulder_moss'), side: f.extra.material('boulder') };
  rockGeom(b, 0, 0, 0, [0.38, 0.18, 0.32], rng, { ...grey, detail: 0, flatTop: 0.4 });
  for (let k = 0; k < 6; k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0.3, 0.75);
    rockGeom(b, Math.cos(a) * d, 0, Math.sin(a) * d, [0.12, 0.07, 0.1], rng, { ...(k % 2 ? grey : { top: 'stone_tiles', side: 'crag' }), detail: 0, yaw: a });
  }
  const group = f.finish(b, 'resource:rubble', x, y, z, opts.rotation ?? 0);
  return f.result(group, { colliders: [{ type: 'circle', x, z, r: 0.3 }] });
}

/**
 * A bush of herbs: crossed leaf cards in a low mound with small flowers on top — or, spent, a few
 * bare twigs.
 * @param {PropFactory} f
 */
function buildHerbs(f, x, y, z, opts, spent) {
  const rng = f.rng('resource:herbs', x, z, opts.seed);
  const b = f.builder(groundAO(0.4, 0.7));
  if (spent) {
    for (let k = 0; k < 5; k++) {
      const a = rng.range(0, Math.PI * 2);
      const tip = [Math.cos(a) * rng.range(0.15, 0.35), rng.range(0.25, 0.45), Math.sin(a) * rng.range(0.15, 0.35)];
      b.tube('bark', [0, 0, 0], tip, 0.025, 0.012, { segments: 4 });
    }
    const group = f.finish(b, 'resource:herbs', x, y, z, opts.rotation ?? 0);
    return f.result(group, { colliders: [] });
  }
  const leaf = f.foliageMaterial('leaves');
  const H = rng.range(0.5, 0.65);
  const R = 0.42;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI + rng.range(-0.15, 0.15);
    const dx = Math.cos(a) * R;
    const dz = Math.sin(a) * R;
    const tint = 0.85 + 0.1 * k;
    b.quad(leaf, [[-dx, 0, -dz], [dx, 0, dz], [dx, H, dz], [-dx, H, -dz]], [[0, 0], [1, 0], [1, 0.8], [0, 0.8]], { color: [tint * 0.9, tint * 1.08, tint * 0.8] });
  }
  // the flowers: small white and lilac heads among the leaves
  for (let k = 0; k < 7; k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0.05, 0.3);
    const lilac = k % 3 === 0;
    b.box('linen', [0.07, 0.06, 0.07], { at: [Math.cos(a) * d, H * rng.range(0.75, 1.0), Math.sin(a) * d], color: lilac ? [1.05, 0.85, 1.3] : [1.3, 1.3, 1.2] });
  }
  const group = f.finish(b, 'resource:herbs', x, y, z, opts.rotation ?? 0);
  return f.result(group, { colliders: [{ type: 'circle', x, z, r: 0.28 }] });
}
