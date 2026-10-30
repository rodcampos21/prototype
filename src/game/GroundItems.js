/**
 * Items dropped from the backpack (the journal's item menu: Game.journal.onItemAction): each lies
 * on the ground beside the player — to the screen's side, so the player's sprite never hides it —
 * as its icon ringed in pale gold, a sprite bobbing a little, for `LIFETIME` seconds; it blinks in
 * the last `HURRY` and is gone after that. It is something to interact with (Game._findInteractable
 * reads `interactables()`): Space — *Pegar* — gives back as much as the backpack takes, and what
 * does not fit stays. Ground items belong to the level they were dropped in and are not saved: a
 * new level clears them.
 */

import * as THREE from 'three';
import { itemIcon } from '../engine/ui/art/icons/items.js';

/**
 * @typedef {object} GroundItem
 * @property {string} id      the item
 * @property {number} n       how many
 * @property {number} x       where it lies (y: its ground)
 * @property {number} y
 * @property {number} z
 * @property {number} t       seconds on the ground
 * @property {THREE.Sprite} sprite
 * @property {{ id: string, kind: string, label: string, radius: number, lookSpan: null, anyFacing: boolean,
 *   position: THREE.Vector3, prompt: THREE.Vector3, text: { speaker: string, lines: string[] },
 *   onInteract: () => number }} it its Space prompt (*Pegar*): an Interactable (World.js) of its own
 */

/** Seconds a dropped item stays on the ground. */
export const LIFETIME = 20;
/** The last seconds: it blinks. */
const HURRY = 5;
/** How far from the player it lands (u). */
const AWAY = 1.0;
/** The reach of its prompt (u). */
const REACH = 1.3;
/** The sprite's size (u) and its height over the ground. */
const SIZE = 0.8, LIFT = 0.42;
/** The icon's outline (the UI's pale gold, g5). */
const OUTLINE = '#f4e3b3';

export class GroundItems {
  /**
   * @param {{ scene: THREE.Scene, height: (x: number, z: number) => number,
   *   standable: (x: number, z: number) => { x: number, z: number } | null,
   *   take: (id: string, n: number) => number }} o height: the ground's height; standable: the
   *   nearest standable spot; take: give the player up to n of id, returns how many they took
   */
  constructor(o) {
    this.o = o;
    /** @type {GroundItem[]} */
    this.items = [];
    this.group = new THREE.Group();
    this.group.name = 'ground-items';
    o.scene.add(this.group);
    /** @type {Map<string, THREE.Texture|null>} one texture per icon */
    this._tex = new Map();
  }

  /**
   * Lay `n` of `id` on the ground `AWAY` from (px, pz) toward (dx, dz) (the screen's right).
   * @param {string} id @param {string} icon @param {number} n
   * @param {number} px @param {number} pz @param {number} dx @param {number} dz
   */
  drop(id, icon, n, px, pz, dx, dz) {
    if (!(n > 0)) return null;
    const len = Math.hypot(dx, dz) || 1;
    const spot = this.o.standable(px + (dx / len) * AWAY, pz + (dz / len) * AWAY) ?? { x: px, z: pz };
    const mat = new THREE.SpriteMaterial({ map: this._texture(icon), transparent: true, alphaTest: 0.1, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(SIZE, SIZE, 1);
    sprite.renderOrder = 2;
    const y = this.o.height(spot.x, spot.z);
    sprite.position.set(spot.x, y + LIFT, spot.z);
    this.group.add(sprite);
    /** @type {GroundItem} */
    const item = /** @type {any} */ ({ id, n, x: spot.x, y, z: spot.z, t: 0, sprite });
    item.it = {
      id: `ground:${id}`, kind: 'ground', label: 'Pick up', radius: REACH, lookSpan: null, anyFacing: true,
      position: new THREE.Vector3(spot.x, y, spot.z),
      prompt: new THREE.Vector3(spot.x, y + LIFT + SIZE * 0.6, spot.z),
      text: { speaker: '', lines: [] },
      onInteract: () => this.pickUp(item),
    };
    this.items.push(item);
    return item;
  }

  /** The prompts of what lies on the ground (Game._findInteractable). */
  interactables() {
    return this.items.map((g) => g.it);
  }

  /**
   * Space on an item: as much as the backpack takes goes back into it; the rest stays. Returns how
   * many were taken.
   * @param {GroundItem} item
   */
  pickUp(item) {
    const i = this.items.indexOf(item);
    if (i < 0) return 0;
    const got = this.o.take(item.id, item.n);
    if (got > 0) {
      item.n -= got;
      if (item.n <= 0) this._remove(i);
    }
    return got;
  }

  /**
   * Per frame (while playing): age, bob, blink at the end, gone after `LIFETIME`.
   * @param {number} dt
   */
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.t >= LIFETIME) { this._remove(i); continue; }
      const s = it.sprite;
      s.position.y = it.y + LIFT + Math.sin(it.t * 3) * 0.04;
      /** @type {THREE.SpriteMaterial} */ (s.material).opacity = LIFETIME - it.t < HURRY && Math.floor(it.t * 6) % 2 ? 0.2 : 1;
    }
  }

  /** Every item gone (a new level). */
  clear() {
    for (let i = this.items.length - 1; i >= 0; i--) this._remove(i);
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
    for (const t of this._tex.values()) t?.dispose();
    this._tex.clear();
  }

  /** @param {number} i */
  _remove(i) {
    const [it] = this.items.splice(i, 1);
    it.sprite.removeFromParent();
    it.sprite.material.dispose();
  }

  /**
   * The icon as a crisp texture (cached), ringed with a pale gold outline so it stands out of the
   * grass; none without a DOM (the tests).
   * @param {string} icon
   */
  _texture(icon) {
    if (this._tex.has(icon)) return this._tex.get(icon) ?? null;
    /** @type {THREE.Texture|null} */
    let tex = null;
    if (typeof document !== 'undefined') {
      const src = itemIcon(icon);
      const c = document.createElement('canvas');
      c.width = src.width + 2;
      c.height = src.height + 2;
      const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      // (the outline: the icon's shape stamped one pixel each way, then tinted)
      for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) ctx.drawImage(src, dx, dy);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(src, 1, 1);
      tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    this._tex.set(icon, tex);
    return tex;
  }
}
