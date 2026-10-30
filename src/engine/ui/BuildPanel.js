/**
 * The build window (PLANO-DE-MECANICAS §8.1; CAMPAIGN_FORMAT.md §4.3): Space at an empty build slot
 * opens it over the game. A gilt window in the journal's family: the slot's buildings listed on the
 * left (icon and name; one the chest cannot pay for dimmed), the chosen one on the right — its icon,
 * name and text, its cost item by item as `have / need` (green when there is enough, red when not),
 * its days of work and the *Build* button (dim without the cost) —, the chest's contents along the
 * bottom and the key hints in the header. Arrows choose, confirm builds, cancel closes; the rows
 * and the button are buttons too.
 *
 * The window shows what it is given, translated already (BuildingSystem.panelData): it reads no
 * story. `open(data)` resolves with the chosen building's id, or '' when it was closed.
 */
import { pal, GEMS } from './art/palette.js';
import { gemGlyph, hairline } from './art/pieces.js';
import { itemIcon } from './art/icons/items.js';
import { txt, txc, measure, fit, UP } from './layout/type.js';
import { group, put, win, keyHints, box, U } from './layout/layout.js';
import { currentScale, onScale } from './UiScale.js';
import { wrapLines } from './Journal.js';
import './buildpanel.css';

/**
 * @typedef {{ icon: string, name: string, need: number, have: number }} BuildCost
 * @typedef {{ id: string, icon: string, name: string, text: string, cost: BuildCost[], days: string,
 *   affordable: boolean }} BuildOption
 * @typedef {{ title: string, chest: { icon: string, name: string, have: number }[], options: BuildOption[],
 *   labels: { build: string, chest: string, chestEmpty: string, select: string, close: string } }} BuildPanelData
 */

/** The window (art px, centred on the 640 × 360 frame). */
const WW = 420, WH = 236;
/** A list row's pitch. */
const RP = 22;

/** @param {unknown} v */
const str = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * Untrusted data into a clean shape (at most 16 options, 8 cost items each).
 * @param {any} d
 * @returns {BuildPanelData}
 */
function clean(d) {
  const o = d && typeof d === 'object' ? d : {};
  const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
  const L = o.labels && typeof o.labels === 'object' ? o.labels : {};
  return {
    title: str(o.title),
    chest: (Array.isArray(o.chest) ? o.chest : []).slice(0, 12).map((c) => ({ icon: str(c?.icon), name: str(c?.name), have: n(c?.have) })),
    options: (Array.isArray(o.options) ? o.options : []).slice(0, 16).filter((x) => x && typeof x === 'object' && str(x.id)).map((x) => ({
      id: str(x.id), icon: str(x.icon), name: str(x.name) || str(x.id), text: str(x.text), days: str(x.days), affordable: !!x.affordable,
      cost: (Array.isArray(x.cost) ? x.cost : []).slice(0, 8).map((c) => ({ icon: str(c?.icon), name: str(c?.name), need: n(c?.need), have: n(c?.have) })),
    })),
    labels: { build: str(L.build), chest: str(L.chest), chestEmpty: str(L.chestEmpty), select: str(L.select), close: str(L.close) },
  };
}

export class BuildPanel {
  /** @param {HTMLElement} parent the UI root */
  constructor(parent) {
    /** @type {((name: 'open'|'close'|'blip'|'confirm') => void) | null} sound hook */
    this.onSound = null;
    const el = document.createElement('div');
    el.className = 'lu-build';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-input-ignore', '');
    parent.appendChild(el);
    this.element = el;
    this._open = false;
    /** @type {BuildPanelData} */
    this._data = clean({});
    this._index = 0;
    /** @type {((id: string) => void) | null} */
    this._resolve = null;
    /** @type {HTMLElement|null} */
    this._window = null;
    /** @type {HTMLElement[]} the list's rows */
    this._rows = [];
    this._onBackdrop = (/** @type {MouseEvent} */ e) => {
      if (this._open && !(this._window && this._window.contains(/** @type {Node} */ (e.target)))) this.close();
    };
    el.addEventListener('click', this._onBackdrop);
    this._offScale = onScale(parent, () => { if (this._open) this._layout(); });
  }

  /** True between open() and close(). */
  get isOpen() { return this._open; }
  /** The chosen option's id ('' none). */
  get selectedId() { return this._data.options[this._index]?.id ?? ''; }

  /**
   * Open the window on a slot's buildings (the first affordable one chosen). Resolves with the
   * building to begin, or '' when closed without one.
   * @param {BuildPanelData} data
   * @returns {Promise<string>}
   */
  open(data) {
    this._resolve?.('');
    this._data = clean(data);
    const first = this._data.options.findIndex((x) => x.affordable);
    this._index = Math.max(0, first);
    this._open = true;
    this.element.classList.add('is-open');
    this.element.setAttribute('aria-hidden', 'false');
    this._layout();
    this._sound('open');
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  /**
   * Close the window; `id` is what `open` resolves with ('' nothing built).
   * @param {string} [id]
   */
  close(id = '') {
    if (!this._open) return;
    this._open = false;
    this.element.classList.remove('is-open');
    this.element.setAttribute('aria-hidden', 'true');
    if (!id) this._sound('close');
    const r = this._resolve;
    this._resolve = null;
    r?.(id);
  }

  /**
   * Read the window's actions (once per frame while open: `UI.update`).
   * @param {number} dt
   * @param {{ actionPressed(name: string): boolean, consumeAction?(name: string): boolean }} [input]
   */
  update(dt, input) {
    if (!this._open || !input) return;
    const pressed = (name) => (typeof input.consumeAction === 'function' ? input.consumeAction(name) : input.actionPressed(name));
    if (pressed('cancel')) this.close();
    else if (pressed('confirm')) this._build();
    else if (pressed('up') || pressed('left')) this._move(-1);
    else if (pressed('down') || pressed('right')) this._move(1);
  }

  dispose() {
    this._resolve?.('');
    this._resolve = null;
    this._offScale();
    this.element.removeEventListener('click', this._onBackdrop);
    this.element.remove();
  }

  // ------------------------------------------------------------------------------------------

  /** @param {'open'|'close'|'blip'|'confirm'} name */
  _sound(name) { this.onSound?.(name); }

  /** @param {number} dir */
  _move(dir) {
    const n = this._data.options.length;
    if (n < 2) return;
    this._index = (this._index + dir + n) % n;
    this._sound('blip');
    this._layout();
  }

  /** Build the chosen one (nothing without its cost). */
  _build() {
    const o = this._data.options[this._index];
    if (!o) return;
    if (!o.affordable) { this._sound('blip'); return; }
    this._sound('confirm');
    this.close(o.id);
  }

  /** Lay the window out (open, a choice, a new scale). */
  _layout() {
    const el = this.element;
    this._window?.remove();
    const k = pal();
    const sc = currentScale(el);
    const artH = sc?.artH ?? 360;
    const WX = 320 - WW / 2, WY = Math.round(artH / 2 - WH / 2);
    const L = WX + 22, R = WX + WW - 22;
    const HY = WY + 17, RULE = WY + 29, CY = WY + 38, BOT = WY + WH - 40;
    const LW = 132, DIV = L + LW + 8, DX = DIV + 12;
    const d = this._data;
    const g = group(el, 'mc', WX, WY, WW, WH, 'over lu-build__window');
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-label', d.title);
    this._window = g;
    win(g, { size: 'L', crown: true, sides: true }, WX, WY, WW, WH);

    // the header: the slot's title, the key hints at the right
    const title = UP(fit(d.title, 'head', 170, 1));
    txc(g, title, L, HY, { font: 'head', track: 1, color: k.tx1, drop: true, cls: 'lu-build__title' });
    put(g, gemGlyph(2), L + measure(title, 'head', 1) + 6, HY - 3);
    keyHints(g, [{ keys: ['↑', '↓'], label: d.labels.select }, { keys: ['Esc'], label: d.labels.close }], R, HY - 5.5, { align: 'right', color: k.tx2, drop: true, cls: 'lu-build__hint' });
    put(g, hairline(R - L, 'both', k.dm1), L, RULE);

    // the list
    this._rows = d.options.map((o, i) => {
      const y = CY + i * RP;
      const on = i === this._index;
      const row = /** @type {HTMLButtonElement} */ (box(g, L - 4, y, LW + 4, RP - 2, `lu-build__row${on ? ' is-on' : ''}${o.affordable ? '' : ' is-dim'}`, 'button'));
      row.type = 'button';
      row.setAttribute('aria-label', o.name);
      row.addEventListener('mousedown', (e) => e.preventDefault());
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (i === this._index) this._build();
        else { this._index = i; this._sound('blip'); this._layout(); }
      });
      put(row, itemIcon(o.icon), L, y + 2, 1, o.affordable ? '' : 'lu-build__icon-dim');
      txc(row, fit(o.name, 'line', LW - 26), L + 22, y + 10, { font: 'line', color: on ? k.g4 : o.affordable ? k.tx1 : k.tx3, drop: true, cls: 'lu-build__name' });
      return row;
    });
    put(g, vRule(BOT - CY), DIV, CY, 1, 'lu-build__divider');

    // the chosen one
    const o = d.options[this._index];
    if (o) {
      const DW = R - DX;
      put(g, itemIcon(o.icon, { scale: 2 }), DX, CY, 1, 'lu-build__big');
      txc(g, fit(o.name, 'name', DW - 40), DX + 40, CY + 9, { font: 'name', color: k.tx1, drop: true });
      txc(g, o.days, DX + 40, CY + 24, { font: 'small', color: k.tx3, drop: true });
      let y = CY + 40;
      for (const ln of wrapLines(o.text, 'line', DW).slice(0, 3)) {
        txt(g, ln, DX, y, { font: 'line', color: k.tx2, drop: true });
        y += 11;
      }
      y += 4;
      for (const c of o.cost) {
        const ok = c.have >= c.need;
        put(g, itemIcon(c.icon), DX, y - 2);
        txc(g, fit(c.name, 'line', DW - 90), DX + 20, y + 6, { font: 'line', color: k.tx1, drop: true });
        const n = `${c.have} / ${c.need}`;
        txc(g, n, R - measure(n, 'num'), y + 6, { font: 'num', color: ok ? k.heal : k.foe, drop: true, cls: ok ? 'lu-build__ok' : 'lu-build__lack' });
        y += 16;
      }
      // the button
      const bw = Math.max(70, measure(d.labels.build, 'line') + 24), bh = 18;
      const bx = R - bw, by = BOT - bh;
      const btn = /** @type {HTMLButtonElement} */ (box(g, bx, by, bw, bh, `lu-build__btn${o.affordable ? '' : ' is-dim'}`, 'button'));
      btn.type = 'button';
      btn.disabled = !o.affordable;
      btn.setAttribute('aria-label', d.labels.build);
      win(btn, { size: 'XS', corners: o.affordable ? GEMS.gold() : null, cornerR: 1, fill: k.ink1, tone: o.affordable ? undefined : 'dim' }, bx, by, bw, bh);
      txc(btn, d.labels.build, bx + bw / 2, by + bh / 2, { font: 'line', color: o.affordable ? k.g4 : k.tx3, drop: true, align: 'center' });
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._build(); });
    }

    // the chest along the bottom
    put(g, hairline(R - L, 'both', k.dm2), L, BOT + 8);
    const cy = BOT + 22;
    txc(g, UP(d.labels.chest), L, cy, { font: 'small', track: 1, color: k.g3, drop: true });
    let x = L + measure(UP(d.labels.chest), 'small', 1) + 10;
    if (!d.chest.length) txc(g, d.labels.chestEmpty, x, cy, { font: 'line', color: k.tx3, drop: true });
    for (const c of d.chest) {
      if (x > R - 30) break;
      put(g, itemIcon(c.icon), x, cy - 8);
      const n = String(c.have);
      txc(g, n, x + 18, cy, { font: 'num', color: k.tx1, drop: true });
      x += 18 + measure(n, 'num') + 10;
    }
  }
}

/** A vertical dim gilt rule h art px tall (the divider between the list and the detail). @param {number} h */
function vRule(h) {
  const k = pal();
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = Math.max(1, h);
  const ctx = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  ctx.fillStyle = k.dm2;
  ctx.fillRect(0, 0, 1, h);
  c.style.width = U(1);
  c.style.height = U(h);
  return c;
}
