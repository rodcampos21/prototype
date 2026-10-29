import { t, registerStrings, hasStrings } from '../i18n/I18n.js';
import INVENTORY from '../i18n/strings/inventory.js';
import { pal, GEMS } from './art/palette.js';
import { hairline } from './art/pieces.js';
import { itemIcon } from './art/icons/items.js';
import { txc } from './layout/type.js';
import { group, put, win, anchorEl } from './layout/layout.js';
import { onScale } from './UiScale.js';
import './ui.css';
import './inventory.css';

/** @import { InventoryData } from './types.js' */
/** @import { Minimap } from './Minimap.js' */

/**
 * ResourceBar — the HUD's resources (`.lu-resbar`, a campaign with an `inventory`: CAMPAIGN_FORMAT.md
 * §4.2), under the minimap in the top-right corner: an XS window as wide as the minimap with the
 * gold first, then each backpack item — its icon and how many the player carries, or at the camp
 * how many the stock holds — and at the foot the backpack's use and limit (`6/8`, red when full),
 * or at the camp the stock's chest. Laid out in art px of G's 640 × 360 frame (layout/layout.js),
 * again when the data, the minimap's place or the scale change. Inside the HUD element: it hides
 * with the HUD. Created by `UI.useResourceBar()`.
 */

/** The bar's x and width (the minimap's), the rows' pitch, the inside's padding (art px). */
const X = 554, W = 76, ROW = 15, PAD = 6;

/** @param {string} k @param {Record<string, any>} [v] */
const s = (k, v) => t(`inventory.${k}`, v);

export class ResourceBar {
  /**
   * @param {HTMLElement} parent the HUD element (it covers the root)
   * @param {{ minimap?: Minimap|null }} [opts] minimap: the bar sits under it (`Minimap.bottom`)
   */
  constructor(parent, { minimap = null } = {}) {
    if (!hasStrings('inventory')) registerStrings('inventory', INVENTORY);
    this._minimap = minimap;
    const el = group(parent, 'tr', X, 50, W, 20, 'is-empty');
    el.className = `lu-resbar ${el.className}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', s('bar'));
    this.element = el;
    /** @type {InventoryData|null} */
    this._data = null;
    this._key = '';
    this._y = -1;
    this._offScale = onScale(parent, () => this._render());
  }

  /**
   * Show the player's resources (Game: when the story's items, the gold or home change).
   * @param {InventoryData|null} data
   */
  setData(data) {
    const key = data ? JSON.stringify([data.gold, data.pack, data.home, (data.items ?? []).filter((it) => it.pack).map((it) => [it.id, it.count, it.stock, it.icon])]) : '';
    this._data = data;
    if (key === this._key) return;
    this._key = key;
    this._render();
  }

  /** Follow the minimap's place (it moves under a taller clock, and shows once it has a map). Every frame. */
  update() {
    const y = this._top();
    if (y !== this._y) this._render();
  }

  dispose() {
    this._offScale();
    this.element.remove();
  }

  /** The bar's top: under the minimap. */
  _top() {
    return this._minimap ? this._minimap.bottom : 133;
  }

  _render() {
    const el = this.element;
    const d = this._data;
    const y0 = this._top();
    this._y = y0;
    el.replaceChildren();
    el.classList.toggle('is-empty', !d);
    if (!d) return;
    const k = pal();
    const rows = (d.items ?? []).filter((it) => it.pack);
    const pack = d.pack ?? null;
    const n = 1 + rows.length;
    const h = PAD + n * ROW + (pack ? 5 + ROW : 0) + PAD - 3;
    anchorEl(el, 'tr', X, y0, W, h);
    win(el, { size: 'XS', corners: GEMS.gold(), cornerR: 2 }, X, y0, W, h);
    const L = X + PAD, R = X + W - PAD - 1;
    let y = y0 + PAD - 2;
    /**
     * A row: the icon at the left, the number at the right.
     * @param {HTMLCanvasElement} ic @param {string} num @param {string} color @param {string} id
     * @param {'num'|'tiny'} [font]
     */
    const row = (ic, num, color, id, font = 'num') => {
      put(el, ic, L - 2, y, 1, 'lu-resbar__icon');
      // (`{/8}`: the limit dimmer, numPair's look)
      const tx = txc(el, num, R, y + 8, { font, color, kw: k.tx2, align: 'right', drop: true, cls: 'lu-resbar__n' });
      tx.dataset.id = id;
      y += ROW;
    };
    row(itemIcon('coin'), (Math.max(0, Math.floor(d.gold ?? 0))).toLocaleString('en-US'), k.kw, 'gold');
    for (const it of rows) {
      const c = d.home ? it.stock ?? 0 : it.count;
      const ic = itemIcon(it.icon ?? '');
      ic.title = it.name;
      row(ic, String(c), c ? k.tx1 : k.tx3, it.id);
    }
    if (pack) {
      put(el, hairline(W - PAD * 2, 'both', k.dm1), L, y + 1).setAttribute('aria-hidden', 'true');
      y += 4;
      if (d.home) {
        row(itemIcon('chest'), s('stock'), k.g4, 'stock', 'tiny');
      } else {
        const full = pack.limit > 0 && pack.used >= pack.limit;
        row(itemIcon('pack'), `${pack.used}/${pack.limit}`, full ? k.hp3 : k.tx1, 'pack');
      }
    }
  }
}
