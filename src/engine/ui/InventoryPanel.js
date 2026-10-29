import { t, registerStrings, hasStrings } from '../i18n/I18n.js';
import INVENTORY from '../i18n/strings/inventory.js';
import { pal, GEMS } from './art/palette.js';
import { art } from './art/painter.js';
import { glyph, hairline } from './art/pieces.js';
import { itemIcon, SLOT_ICONS } from './art/icons/items.js';
import { DUSK_ICON } from './art/icons/core.js';
import { spriteCrop } from './art/portrait.js';
import { txt, txc, measure, UP, cjk, FONT } from './layout/type.js';
import { put, win, section, numPair, box } from './layout/layout.js';
import { wrapLines } from './Journal.js';

/**
 * @import { InventoryData, InventoryItem, InventorySlot } from './types.js'
 */

/**
 * InventoryPanel — the journal's **Backpack** and **Equipment** tabs (a campaign with an
 * `inventory`: CAMPAIGN_FORMAT.md §4.2; docs/specs/PIXEL_UI.md §5). The Journal makes one and, on
 * those tabs, lets it fill the window under the header (`build`) and move the choice (`move`):
 *
 * - **Backpack**: at the left the backpack's cells (sockets with the item's icon and how many are
 *   carried; the heading shows `used/limit`, in the ruby's light when full), under them the camp's
 *   stock — its cells at the camp, a line saying it stays there elsewhere. At the right the chosen
 *   item: its icon, name, how many are carried and stocked, its text.
 * - **Equipment**: the player's figure (frame 0 of the character sheet, facing the camera) between
 *   the six slots (head, body, hands at the left; weapon, feet, accessory at the right), the name
 *   and class under it; at the right the chosen slot's item (its text, its bonus), the attributes
 *   and a line that equipping comes later. The slots are shown, not changed.
 *
 * Cells are buttons (a click chooses one). Texts arrive translated, untrusted (story files), set
 * as escaped text (layout/type.js `txt`); the panel's own words are the 'inventory' strings.
 */

/** @typedef {'pack'|'gear'} InventoryTab */
/** A cell: its socket's size and pitch (art px). */
const CELL = 24, PITCH = 27;
/** The equipment's slots by column (left, right), top to bottom. */
const GEAR_COLS = /** @type {const} */ ([['head', 'body', 'hands'], ['weapon', 'feet', 'accessory']]);

/** @param {string} k @param {Record<string, any>} [v] */
const s = (k, v) => t(`inventory.${k}`, v);
/** @param {unknown} v */
const str = (v) => (v === undefined || v === null ? '' : String(v));
/** @param {unknown} v */
const whole = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; };

/**
 * Untrusted data → clean fields.
 * @param {InventoryData|null|undefined} data
 */
export function cleanInventory(data) {
  const d = data && typeof data === 'object' ? data : {};
  /** @type {Required<InventoryItem>[]} */
  const items = (Array.isArray(d.items) ? d.items : []).filter((it) => it && typeof it === 'object').map((it, i) => ({
    id: str(it.id) || `#${i}`, name: str(it.name) || str(it.id), text: str(it.text), icon: str(it.icon),
    pack: !!it.pack, key: !!it.key, count: whole(it.count), stock: whole(it.stock),
  }));
  const SLOTS = ['weapon', 'body', 'head', 'hands', 'feet', 'accessory'];
  /** @type {Required<InventorySlot>[]|null} */
  const equipment = Array.isArray(d.equipment) ? d.equipment.filter((e) => e && typeof e === 'object' && SLOTS.includes(e.slot)).map((e) => ({
    slot: e.slot, id: str(e.id), name: str(e.name), text: str(e.text), icon: str(e.icon),
    bonus: Object.fromEntries(Object.entries(e.bonus && typeof e.bonus === 'object' ? e.bonus : {}).filter(([k, v]) => ['hp', 'mp', 'atk', 'def'].includes(k) && Number.isFinite(v) && v)),
  })) : null;
  const pk = d.pack && typeof d.pack === 'object' ? { used: whole(d.pack.used), limit: whole(d.pack.limit) } : null;
  const st = d.stats && typeof d.stats === 'object' ? d.stats : null;
  return {
    gold: whole(d.gold), pack: pk, home: !!d.home, items, equipment,
    stats: st, name: str(d.name), role: str(d.role),
    figure: typeof HTMLCanvasElement !== 'undefined' && d.figure instanceof HTMLCanvasElement && d.figure.width > 0 ? d.figure : null,
  };
}

/**
 * The panel's columns inside the journal's window: whole cells at the left (8 at G's width, 5 at
 * least), the divider, the detail at the right.
 * @param {{ L: number, R: number, CY: number, BOT: number }} G the journal's geometry
 */
function geom({ L, R, CY, BOT }) {
  const cols = Math.max(5, Math.min(8, Math.floor(Math.round((R - L) * 0.47) / PITCH)));
  const LW = cols * PITCH - (PITCH - CELL);
  const DIV = L + LW + 14;
  return { L, R, CY, BOT, cols, LW, DIV, DX0: DIV + 14 };
}
/** @typedef {ReturnType<typeof geom>} PanelGeom */

/** The divider between the halves: a dim gilt dotted line (1 × h). @param {number} h */
function vRule(h) {
  const k = pal();
  return art(1, h, (p) => { for (let y = 0; y < h; y++) if (y % 2 === 0) p.px(0, y, k.dm2); });
}

/**
 * @typedef {{ id: string, el: HTMLElement, x: number, y: number }} Cell
 */

export class InventoryPanel {
  constructor() {
    if (!hasStrings('inventory')) registerStrings('inventory', INVENTORY);
    /** @type {((name: 'blip'|'confirm') => void) | null} sound hook (the journal's) */
    this.onSound = null;
    /** the chosen cell's id per tab (kept across builds while it exists) */
    this._sel = { pack: '', gear: 'weapon' };
    /** @type {InventoryTab} */
    this._tab = 'pack';
    /** @type {Cell[]} */
    this._cells = [];
    this._index = -1;
    this._data = cleanInventory(null);
    /** @type {HTMLElement|null} the window's group the panel draws into */
    this._g = null;
    /** @type {HTMLElement|null} the chosen cell's detail */
    this._detail = null;
    /** @type {HTMLCanvasElement|null} */
    this._cursor = null;
    this._G = geom({ L: 0, R: 560, CY: 58, BOT: 326 });
  }

  /** The chosen cell's id ('' with none). */
  get selectedId() { return this._cells[this._index]?.id ?? ''; }

  /**
   * Fill the journal's window under its header with a tab.
   * @param {HTMLElement} g the window's group
   * @param {{ L: number, R: number, CY: number, BOT: number }} G the journal's geometry
   * @param {InventoryTab} tab
   * @param {InventoryData|null|undefined} data
   */
  build(g, G, tab, data) {
    this._g = g;
    this._G = geom(G);
    this._tab = tab;
    this._data = cleanInventory(data);
    this._cells = [];
    this._index = -1;
    this._detail = null;
    this._cursor = null;
    const { DIV, CY, BOT } = this._G;
    put(g, vRule(BOT - CY), DIV, CY, 1, 'lu-inv__divider');
    if (tab === 'pack') this._buildPack(g);
    else this._buildGear(g);
    const keep = this._cells.findIndex((c) => c.id === this._sel[tab]);
    this._select(keep >= 0 ? keep : 0);
  }

  /**
   * Move the choice: left / right along a row (a gear column to the other), up / down a row (from
   * one grid into the next). Returns true when it moved.
   * @param {'left'|'right'|'up'|'down'} dir
   */
  move(dir) {
    const cells = this._cells;
    if (cells.length < 2) return false;
    const cur = cells[this._index] ?? cells[0];
    /** the nearest cell that passes a test */
    const best = (/** @type {(c: Cell) => boolean} */ ok) => {
      let pick = -1, dist = Infinity;
      cells.forEach((c, i) => {
        if (!ok(c)) return;
        const dd = Math.abs(c.x - cur.x) * 2 + Math.abs(c.y - cur.y);
        if (dd < dist) { dist = dd; pick = i; }
      });
      return pick;
    };
    let next = -1;
    if (dir === 'left') next = best((c) => c.y === cur.y && c.x < cur.x);
    else if (dir === 'right') next = best((c) => c.y === cur.y && c.x > cur.x);
    else if (dir === 'up') next = best((c) => c.y < cur.y && Math.abs(c.x - cur.x) < PITCH * 3);
    else next = best((c) => c.y > cur.y && Math.abs(c.x - cur.x) < PITCH * 3);
    // (nothing that way: along the order, wrapping)
    if (next < 0) next = (this._index + (dir === 'left' || dir === 'up' ? -1 : 1) + cells.length) % cells.length;
    if (next === this._index) return false;
    this._select(next);
    return true;
  }

  // ------------------------------------------------------------------------------------------

  /**
   * A cell: a socket (lit while chosen) with the item's icon and a count at its foot; a button.
   * @param {HTMLElement} g @param {number} x @param {number} y
   * @param {{ id: string, icon: string, n?: number, dim?: boolean, label: string }} o
   */
  _cell(g, x, y, o) {
    const k = pal();
    const b = /** @type {HTMLButtonElement} */ (box(g, x, y, CELL, CELL, 'lu-inv__cell', 'button'));
    b.type = 'button';
    b.setAttribute('aria-label', o.label);
    win(b, { size: 'XS', socket: true, corners: o.dim ? null : GEMS.gold(), cornerR: 1, fill: k.ink1, tone: o.dim ? 'dim' : undefined }, x, y, CELL, CELL);
    put(b, itemIcon(o.icon, o.dim ? DUSK_ICON() : undefined), x + 4, y + 4, 1, 'lu-inv__icon');
    if (o.n !== undefined && o.n > 1) txt(b, String(o.n), x + CELL - 2, y + CELL - 9, { font: 'num', color: k.tx1, align: 'right', ol: true, cls: 'lu-inv__count' });
    const i = this._cells.length;
    this._cells.push({ id: o.id, el: b, x, y });
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (i !== this._index) { this._select(i); this.onSound?.('blip'); }
    });
  }

  /** An empty cell (no item: a dim socket). @param {HTMLElement} g @param {number} x @param {number} y */
  _emptyCell(g, x, y) {
    const k = pal();
    const b = box(g, x, y, CELL, CELL, 'lu-inv__hole');
    win(b, { size: 'XS', socket: true, corners: null, fill: k.ink1, tone: 'dim' }, x, y, CELL, CELL);
  }

  /** The backpack tab: the backpack's cells, the stock's. @param {HTMLElement} g */
  _buildPack(g) {
    const k = pal();
    const { L, CY, BOT, cols, LW } = this._G;
    const d = this._data;
    const carried = d.items.filter((it) => it.count > 0).sort((a, b) => Number(b.pack) - Number(a.pack));
    let y = CY + 4;
    // the heading with the backpack's use at its end (the ruby's light when full)
    const right = d.pack ? `${d.pack.used}/${d.pack.limit}` : null;
    const full = !!d.pack && d.pack.limit > 0 && d.pack.used >= d.pack.limit;
    section(g, UP(s('pack')), L, L + LW - (right ? measure(right, 'num') + 6 : 0), y);
    if (right) txc(g, right, L + LW, y, { font: 'num', color: full ? k.hp3 : k.g4, align: 'right', drop: true, cls: 'lu-inv__use' });
    y += 9;
    // the backpack's cells: two rows at least
    const packRows = Math.max(2, Math.ceil(carried.length / cols));
    for (let i = 0; i < packRows * cols; i++) {
      const cx = L + (i % cols) * PITCH, cy = y + Math.floor(i / cols) * PITCH;
      const it = carried[i];
      if (it) this._cell(g, cx, cy, { id: `pack:${it.id}`, icon: it.icon, n: it.count, label: `${it.name} ×${it.count}` });
      else this._emptyCell(g, cx, cy);
    }
    y += packRows * PITCH + 10;
    // the stock: its cells at the camp, a line elsewhere
    if (d.pack) {
      section(g, UP(s('stock')), L, L + LW, y);
      y += 9;
      if (d.home) {
        const stocked = d.items.filter((it) => it.stock > 0);
        const room = Math.max(1, Math.floor((BOT - y + PITCH - CELL) / PITCH));
        const n = Math.min(Math.max(cols, stocked.length), room * cols);
        for (let i = 0; i < n; i++) {
          const cx = L + (i % cols) * PITCH, cy = y + Math.floor(i / cols) * PITCH;
          const it = stocked[i];
          if (it) this._cell(g, cx, cy, { id: `stock:${it.id}`, icon: it.icon, n: it.stock, label: `${it.name} ×${it.stock}` });
          else this._emptyCell(g, cx, cy);
        }
      } else {
        for (const ln of wrapLines(s('stockAway'), 'line', LW)) {
          txt(g, ln, L, y, { font: 'line', color: k.tx3, drop: true });
          y += cjk() ? FONT.line.L : 11;
        }
      }
    }
    if (!this._cells.length) this._emptyDetail(g);
  }

  /** The backpack's empty state at the right: the pack in dusk tones, a line, a hint. @param {HTMLElement} g */
  _emptyDetail(g) {
    const k = pal();
    const { DX0, R, CY, BOT } = this._G;
    const cx = Math.round((DX0 + R) / 2);
    let y = Math.round((CY + BOT) / 2) - 34;
    put(g, itemIcon('pack', { ...DUSK_ICON(), scale: 2 }), cx - 16, y);
    y += 40;
    txc(g, s('empty'), cx, y, { font: 'name', color: k.tx1, align: 'center', drop: true, cls: 'lu-inv__empty' });
    y += 12;
    for (const ln of wrapLines(s('emptyHint'), 'line', R - DX0 - 20)) {
      txt(g, ln, cx, y, { font: 'line', color: k.tx3, align: 'center', drop: true });
      y += cjk() ? FONT.line.L : 11;
    }
  }

  /** The equipment tab: the figure between the slots, the name and class. @param {HTMLElement} g */
  _buildGear(g) {
    const k = pal();
    const { L, CY, LW } = this._G;
    const d = this._data;
    const bySlot = new Map((d.equipment ?? []).map((e) => [e.slot, e]));
    // the figure's glass panel at the column's middle, the slots either side
    const PW = 70, PH = 3 * 34 - 6;
    const px = Math.round(L + LW / 2 - PW / 2), py = CY + 10;
    win(g, { size: 'XS', fill: k.ink1, corners: GEMS.gold(), cornerR: 1 }, px, py, PW, PH);
    if (d.figure) put(g, spriteCrop(d.figure, [0, 0, 32, 32]), px + Math.round(PW / 2 - 32), py + PH - 64 - 4, 2, 'lu-inv__figure');
    GEAR_COLS.forEach((col, ci) => {
      const sx = ci === 0 ? px - 12 - CELL : px + PW + 12;
      col.forEach((slot, ri) => {
        const sy = py + ri * 34;
        const e = bySlot.get(slot);
        const has = !!e?.id;
        this._cell(g, sx, sy, { id: slot, icon: has ? e.icon || SLOT_ICONS[slot] : SLOT_ICONS[slot], dim: !has, label: `${s(`slot.${slot}`)}: ${has ? e.name : s('slot.empty')}` });
        txc(g, s(`slot.${slot}`), sx + CELL / 2, sy + CELL + 4, { font: 'tiny', color: k.tx3, align: 'center', drop: true });
      });
    });
    // the name and the class under the figure
    let y = py + PH + 16;
    const cx = Math.round(L + LW / 2);
    if (d.name) { txc(g, d.name, cx, y, { font: 'name', color: k.tx1, align: 'center', drop: true, cls: 'lu-inv__name' }); y += 12; }
    if (d.role) txc(g, d.role, cx, y, { font: 'line', color: k.g4, align: 'center', drop: true });
  }

  /** Choose a cell: the cursor beside it, the socket lit, the detail at the right. @param {number} i */
  _select(i) {
    const cells = this._cells;
    const g = this._g;
    if (!cells.length || !g) { this._index = -1; return; }
    const n = Math.max(0, Math.min(cells.length - 1, i));
    cells[this._index]?.el.classList.remove('is-sel');
    this._index = n;
    const c = cells[n];
    c.el.classList.add('is-sel');
    this._sel[this._tab] = c.id;
    this._cursor?.remove();
    this._cursor = put(g, glyph('cursor'), c.x - 9, c.y + CELL / 2 - 4, 1, 'nudge lu-inv__cursor');
    this._showDetail(c);
  }

  /** The detail at the right for a cell. @param {Cell} c */
  _showDetail(c) {
    this._detail?.remove();
    const g = /** @type {HTMLElement} */ (this._g);
    const k = pal();
    const { DX0, R, CY, BOT } = this._G;
    const det = box(g, DX0, CY, R - DX0, BOT - CY, 'lu-inv__detail');
    this._detail = det;
    const W = R - DX0;
    let y = CY + 2;
    /** @param {string} text @param {string} color */
    const para = (text, color) => {
      for (const ln of wrapLines(text, 'line', W - 4)) {
        txt(det, ln, DX0, y, { font: 'line', color, drop: true, kw: k.kw });
        y += cjk() ? FONT.line.L : 11;
      }
    };
    if (this._tab === 'pack') {
      const id = c.id.replace(/^(pack|stock):/, '');
      const it = this._data.items.find((x) => x.id === id);
      if (!it) return;
      put(det, itemIcon(it.icon, { scale: 2 }), DX0, y);
      txc(det, it.name, DX0 + 40, y + 9, { font: 'name', color: k.tx1, drop: true, cls: 'lu-inv__item-name' });
      if (it.key) txc(det, s('keyItem'), DX0 + 40, y + 23, { font: 'tiny', color: k.g4, drop: true });
      y += 40;
      if (it.pack || it.count) { txt(det, s('carried', { n: it.count }), DX0, y, { font: 'line', color: k.tx2, drop: true }); y += 11; }
      if (this._data.pack && (it.pack || it.stock)) { txt(det, s('stocked', { n: it.stock }), DX0, y, { font: 'line', color: k.tx2, drop: true }); y += 11; }
      y += 4;
      put(det, hairline(W - 4, 'r', k.dm1), DX0, y);
      y += 7;
      if (it.text) para(it.text, k.tx1);
      return;
    }
    // the equipment: the slot, its item, its bonus; the attributes; equipping comes later
    const slot = /** @type {InventorySlot['slot']} */ (c.id);
    const e = (this._data.equipment ?? []).find((x) => x.slot === slot);
    txc(det, UP(s(`slot.${slot}`)), DX0, y + 4, { font: 'small', track: 1, color: k.g4, drop: true });
    y += 12;
    if (e?.id) {
      put(det, itemIcon(e.icon || SLOT_ICONS[slot], { scale: 2 }), DX0, y);
      txc(det, e.name, DX0 + 40, y + 16, { font: 'name', color: k.tx1, drop: true, cls: 'lu-inv__item-name' });
      y += 38;
      if (e.text) para(e.text, k.tx1);
      const bonus = Object.entries(e.bonus).map(([st, n]) => s('bonus', { n, stat: s(`stat.${st}`) })).join('  ');
      if (bonus) { txt(det, bonus, DX0, y + 2, { font: 'num', color: k.kw, drop: true }); y += 12; }
    } else {
      txt(det, s('slot.empty'), DX0, y, { font: 'line', color: k.tx3, drop: true });
      y += 12;
    }
    const st = this._data.stats;
    if (st) {
      y += 8;
      section(det, UP(s('stats')), DX0, R, y);
      y += 9;
      /** @type {[string, [number, number]|number][]} */
      const rows = [];
      if (st.level !== undefined) rows.push(['level', whole(st.level)]);
      if (st.hp !== undefined) rows.push(['hp', [whole(st.hp), whole(st.hpMax ?? st.hp)]]);
      if (st.mp !== undefined) rows.push(['mp', [whole(st.mp), whole(st.mpMax ?? st.mp)]]);
      if (st.atk !== undefined) rows.push(['atk', whole(st.atk)]);
      if (st.def !== undefined) rows.push(['def', whole(st.def)]);
      const half = Math.round(W / 2);
      rows.forEach(([id, v], i) => {
        const x = DX0 + (i % 2) * half, ry = y + Math.floor(i / 2) * 13;
        txt(det, s(`stat.${id}`), x, ry, { font: 'line', color: k.tx2, drop: true });
        if (Array.isArray(v)) numPair(det, v, x + 48, ry);
        else txt(det, String(v), x + 48, ry, { font: 'num', color: k.tx1, drop: true });
      });
      y += Math.ceil(rows.length / 2) * 13 + 6;
    }
    y = Math.max(y, BOT - 14);
    for (const ln of wrapLines(s('gearSoon'), 'line', W - 4)) {
      txt(det, ln, DX0, y, { font: 'line', color: k.tx3, drop: true });
      y += 11;
    }
  }
}
