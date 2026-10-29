import { pal } from './art/palette.js';
import { hairline, veilCanvas, dayBar, plate } from './art/pieces.js';
import { atlasSheet, placeMark, selectRing, routeLine, stateSign, labelScrap, INK } from './art/atlas.js';
import { group, box, put, win, keyHints, section, key, capW, U } from './layout/layout.js';
import { txt, txc, fit, measure, UP } from './layout/type.js';
import { onScale, currentScale } from './UiScale.js';
import { currentFonts } from './FontLoader.js';
import './ui.css';
import './atlas.css';

/**
 * The atlas: the cartographer's map the player travels by, opened from the hub's map table
 * (docs/specs/CAMPAIGN_FORMAT.md §4.1, docs/specs/PIXEL_UI.md §8.1). A framed window over the veiled
 * scene: the parchment sheet on the left (art/atlas.js — the land as drawn so far, the place names
 * in ink, each place's mark in its state, the selection ring, the route from the camp in red dots),
 * the chosen place on the right (its name, its state, the journey and the hour of arrival, a warning
 * when that falls at night, what is found there, the cartographer's note, the Travel plate), the
 * title and the day's clock above, the key hints below.
 *
 * Keys (the game's input, `update`): ← → ↑ ↓ choose the nearest place that way, confirm travels,
 * cancel closes. Pointer: a place under the pointer is chosen; a click on the chosen place or on the
 * Travel plate travels; a click outside the window closes. Every text comes from the caller,
 * translated. `open` resolves with the id of the place to travel to, or null.
 */

/** The window (art px of G's 640 × 360 frame). */
const X0 = 30, Y0 = 26, W = 580, H = 308;
/** The sheet: left in the window. */
const MX = X0 + 12, MY = Y0 + 32, MW = 380, MH = 228;
/** The side panel. */
const PX0 = MX + MW + 14, PX1 = X0 + W - 14;
/** A place mark's size (art px; placeMark is 19 × 19) and the ring's (27 × 27). */
const MARK = 19, RING = 27;

/** @typedef {import('./types.js').AtlasView} AtlasView */
/** @typedef {import('./types.js').AtlasViewPlace} AtlasViewPlace */

/** The sheets painted, by their spec (the newest few). @type {Map<string, HTMLCanvasElement>} */
const SHEETS = new Map();

/** A copy of a canvas (one canvas stands in one place of the page). @param {HTMLCanvasElement} src */
function copyOf(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  c.classList.add('px');
  return c;
}

export class AtlasScreen {
  /** @param {HTMLElement} parent the UI root */
  constructor(parent) {
    /** @type {((name: 'open'|'close'|'blip'|'confirm') => void) | null} sound hook (AudioSystem.playSfx names) */
    this.onSound = null;
    const el = document.createElement('div');
    el.className = 'lu-atlas';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-input-ignore', '');
    parent.appendChild(el);
    this.element = el;
    this._open = false;
    /** @type {AtlasView|null} */
    this._view = null;
    this._index = 0;
    this._armedAt = 0;
    this._closeQueued = false;
    /** @type {string|null} a place to travel to, chosen with the pointer (read in `update`) */
    this._goQueued = null;
    /** @type {((id: string|null) => void)|null} */
    this._resolve = null;
    /** @type {HTMLCanvasElement|null} */
    this._veil = null;
    this._veilSize = '';
    /** @type {HTMLElement|null} the window */
    this._window = null;
    /** @type {HTMLElement|null} the panel's group (laid out again on every choice) */
    this._panel = null;
    /** @type {HTMLElement|null} the ring and the route over the sheet */
    this._over = null;
    /** @type {Map<string, HTMLElement>} */
    this._marks = new Map();

    this._onClick = (/** @type {MouseEvent} */ e) => {
      if (!this._accepting()) return;
      const tg = /** @type {Element|null} */ (e.target);
      const mark = /** @type {HTMLElement|null} */ (tg?.closest?.('.lu-atlas__place') ?? null);
      if (mark) {
        const i = this._places.findIndex((p) => p.id === mark.dataset.id);
        if (i < 0) return;
        if (i === this._index && this._places[i].go) this._goQueued = this._places[i].id;
        else this._select(i, true);
        return;
      }
      if (tg?.closest?.('.lu-atlas__go')) {
        const p = this._places[this._index];
        if (p?.go) this._goQueued = p.id;
        return;
      }
      if (!(this._window && this._window.contains(/** @type {Node} */ (tg)))) this._closeQueued = true;
    };
    this._onOver = (/** @type {PointerEvent} */ e) => {
      if (!this._accepting() || e.pointerType === 'touch') return;
      const mark = /** @type {HTMLElement|null} */ (/** @type {Element|null} */ (e.target)?.closest?.('.lu-atlas__place') ?? null);
      if (!mark) return;
      const i = this._places.findIndex((p) => p.id === mark.dataset.id);
      if (i >= 0 && i !== this._index) this._select(i, true);
    };
    el.addEventListener('click', this._onClick);
    el.addEventListener('pointerover', this._onOver);
    this._offScale = onScale(parent, () => { this._veilSize = ''; if (this._open) this._layout(); });
  }

  /** True between open() and the choice (or the close). */
  get isOpen() { return this._open; }

  /** The id of the place chosen now ('' before open()). */
  get selectedId() { return this._places[this._index]?.id ?? ''; }

  /** @returns {AtlasViewPlace[]} */
  get _places() { return this._view?.places ?? []; }

  /**
   * Open the map (fades in). Resolves with the id of the place the player travels to, or null when
   * the map is closed.
   * @param {AtlasView} view
   * @returns {Promise<string|null>}
   */
  open(view) {
    this._resolve?.(null);
    this._view = view;
    const sel = view.places.findIndex((p) => p.id === view.selected);
    this._index = sel >= 0 ? sel : Math.max(0, view.places.findIndex((p) => p.state !== 'home'));
    this._closeQueued = false;
    this._goQueued = null;
    this._open = true;
    this._armedAt = performance.now() + 250;
    this.element.classList.add('is-open');
    this.element.setAttribute('aria-hidden', 'false');
    this._layout();
    // (the texts' glyphs: laid out again once their fonts are in)
    const fonts = currentFonts();
    const texts = [view.title, view.subtitle, view.clock, ...Object.values(view.texts),
      ...view.places.flatMap((p) => [p.name, p.stateLabel, p.note, p.warn, p.why, ...p.yields, ...p.travel]),
      ...view.sketch.map((f) => f.name ?? '')].join('\n');
    if (fonts) fonts.ensure(texts).then(() => { if (this._open && this._view === view) this._layout(); }, () => {});
    this._sound('open');
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  /**
   * Close the map (fades out); the open() promise resolves with `id` (null: nothing chosen).
   * @param {string|null} [id]
   */
  close(id = null) {
    if (!this._open) return;
    this._open = false;
    this.element.classList.remove('is-open');
    this.element.setAttribute('aria-hidden', 'true');
    this._sound(id ? 'confirm' : 'close');
    const res = this._resolve;
    this._resolve = null;
    res?.(id);
  }

  /**
   * Read the map's actions. Call once per frame while open (`UI.update` does).
   * @param {number} dt seconds (unused)
   * @param {{ actionPressed(name: string): boolean, consumeAction?(name: string): boolean }} [input]
   */
  update(dt, input) {
    if (!this._open) return;
    const pressed = (name) => !!input && (typeof input.consumeAction === 'function' ? input.consumeAction(name) : input.actionPressed(name));
    if (!this._accepting()) {
      // (the press that opened the map is not a choice on it)
      for (const a of ['confirm', 'cancel', 'left', 'right', 'up', 'down']) pressed(a);
      return;
    }
    if (this._goQueued) { this.close(this._goQueued); return; }
    if (pressed('cancel') || this._closeQueued) { this.close(null); return; }
    if (pressed('confirm')) {
      const p = this._places[this._index];
      if (p?.go) { this.close(p.id); return; }
      this._sound('blip');
    }
    if (pressed('left')) this._move(-1, 0);
    else if (pressed('right')) this._move(1, 0);
    else if (pressed('up')) this._move(0, -1);
    else if (pressed('down')) this._move(0, 1);
  }

  dispose() {
    this.close(null);
    this._offScale();
    this.element.removeEventListener('click', this._onClick);
    this.element.removeEventListener('pointerover', this._onOver);
    this.element.remove();
  }

  // ------------------------------------------------------------------------------------------

  _accepting() { return this._open && performance.now() >= this._armedAt; }

  /** @param {'open'|'close'|'blip'|'confirm'} name */
  _sound(name) { this.onSound?.(name); }

  /**
   * Choose the nearest place in a direction: ahead of the chosen one along (dx, dy), the one whose
   * distance ahead plus twice its distance aside is the least; none that way: nothing changes.
   * @param {number} dx @param {number} dy
   */
  _move(dx, dy) {
    const ps = this._places;
    const cur = ps[this._index];
    if (!cur) return;
    let best = -1, score = Infinity;
    ps.forEach((p, i) => {
      if (i === this._index) return;
      const vx = p.x - cur.x, vy = p.y - cur.y;
      const ahead = vx * dx + vy * dy;
      if (ahead <= 0.5) return;
      const s = ahead + Math.abs(vx * dy - vy * dx) * 2;
      if (s < score) { score = s; best = i; }
    });
    if (best >= 0) this._select(best, true);
  }

  /** @param {number} i @param {boolean} sound */
  _select(i, sound) {
    if (i === this._index && this._panel) return;
    this._index = i;
    if (sound) this._sound('blip');
    this._layoutChoice();
  }

  /** The sheet's px of a place (centre). @param {{ x: number, y: number }} p */
  _at(p) {
    const v = /** @type {AtlasView} */ (this._view);
    return [MX + Math.round((p.x / v.size[0]) * MW), MY + Math.round((p.y / v.size[1]) * MH)];
  }

  // ------------------------------------------------------------------------------------------
  // Layout (art px of G's 640 × 360 frame)
  // ------------------------------------------------------------------------------------------

  /** The whole window: the veil, the frame, the header, the sheet and its marks, the hints, the choice. */
  _layout() {
    const v = this._view;
    if (!v) return;
    const el = this.element;
    const k = pal();
    // the veil: the screen at one canvas pixel per art pixel
    const sc = currentScale(el);
    const vw = Math.ceil((sc?.W ?? 1280) / (sc?.px ?? 2)), vh = Math.ceil((sc?.H ?? 720) / (sc?.px ?? 2));
    if (!this._veil || this._veilSize !== `${vw}x${vh}`) {
      this._veil?.remove();
      this._veil = veilCanvas(vw, vh);
      this._veil.className = 'px lu-atlas__veil';
      this._veil.style.width = U(vw);
      this._veil.style.height = U(vh);
      el.prepend(this._veil);
      this._veilSize = `${vw}x${vh}`;
    }
    this._window?.remove();
    this._marks.clear();
    const g = group(el, 'mc', X0, Y0, W, H, 'over lu-atlas__window');
    g.setAttribute('role', 'dialog');
    g.setAttribute('aria-label', v.title);
    this._window = g;
    win(g, { size: 'L', lattice: true, beads: 6, crown: true, trio: true, sides: true }, X0, Y0, W, H);

    // the header: the title over the sheet, the day's clock over the panel
    txc(g, UP(fit(v.title, 'head', MW - 20)), MX + MW / 2, Y0 + 13, { font: 'head', color: k.g4, align: 'center', ol: true });
    if (v.subtitle) txc(g, v.subtitle, MX + MW / 2, Y0 + 25, { font: 'small', color: k.tx3, align: 'center', track: 1, drop: true });
    // (the clock and, beside it, the day's sky with the hour's ◆)
    const cw = measure(v.clock, 'line');
    txc(g, v.clock, PX0, Y0 + 22, { font: 'line', color: k.tx1, drop: true });
    const bw = Math.max(24, PX1 - PX0 - cw - 12);
    put(g, dayBar(bw, v.dayFrac), PX1 - bw - 4, Y0 + 19);

    // the sheet: its shadow on the table, the parchment
    const sheetKey = JSON.stringify([MW, MH, v.size, v.sketch]);
    let sheet = SHEETS.get(sheetKey);
    if (!sheet) {
      sheet = atlasSheet({ w: MW, h: MH, size: v.size, sketch: v.sketch });
      SHEETS.set(sheetKey, sheet);
      while (SHEETS.size > 3) SHEETS.delete(SHEETS.keys().next().value);
    }
    const shadow = document.createElement('canvas');
    shadow.width = MW; shadow.height = MH;
    const sctx = shadow.getContext('2d');
    sctx.globalAlpha = 0.55;
    sctx.drawImage(sheet, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = k.ink0;
    sctx.fillRect(0, 0, MW, MH);
    put(g, shadow, MX + 3, MY + 3, 1, 'lu-atlas__shadow');
    put(g, copyOf(sheet), MX, MY, 1, 'lu-atlas__sheet');
    // the labels of the land, in ink on a scrap of clean parchment
    for (const f of v.sketch) {
      if (f.kind !== 'label' || !f.at || !f.name) continue;
      this._label(g, f.name, MX + (f.at[0] / v.size[0]) * MW, MY + (f.at[1] / v.size[1]) * MH, INK.label);
    }
    // the route and the ring go between the sheet and the marks
    this._over = box(g, MX, MY, MW, MH, 'lu-atlas__over');
    // the places: a mark each, its name under it (a rumour's faded)
    v.places.forEach((p) => {
      const [x, y] = this._at(p);
      const m = box(g, x - MARK / 2, y - MARK / 2, MARK, MARK, `lu-atlas__place is-${p.state}`, 'button');
      m.dataset.id = p.id;
      m.setAttribute('aria-label', `${p.name} · ${p.stateLabel}`);
      put(m, placeMark(p.icon, p.state), x - MARK / 2, y - MARK / 2);
      this._marks.set(p.id, m);
      this._label(g, p.name, x, y + 14, p.state === 'rumor' ? INK.faded : INK.label);
    });

    // the hints
    const hy = Y0 + H - 17;
    keyHints(g, [{ keys: ['←', '→', '↑', '↓'], label: v.texts.choose }, { keys: ['Enter'], label: v.texts.travel }, { keys: ['Esc'], label: v.texts.close }], 320, hy, { align: 'center', color: k.tx2, ol: true });
    this._panel = null;
    this._layoutChoice();
  }

  /**
   * A name on the sheet: ink centred on (x, cy), over a scrap of clean parchment (kept inside the
   * sheet) so it reads over trees, hills and water.
   * @param {HTMLElement} g @param {string} name @param {number} x @param {number} cy @param {string} color
   */
  _label(g, name, x, cy, color) {
    const w = measure(name, 'small') + 6;
    const lx = Math.min(MX + MW - w - 2, Math.max(MX + 2, Math.round(x - w / 2)));
    put(g, labelScrap(w, 9), lx, Math.round(cy) - 5, 1, 'lu-atlas__label');
    txc(g, name, lx + w / 2, cy, { font: 'small', color, align: 'center', cls: 'lu-atlas__label' });
  }

  /** The chosen place: the ring and the route on the sheet, the panel. */
  _layoutChoice() {
    const v = this._view;
    const g = this._window;
    if (!v || !g || !this._over) return;
    const k = pal();
    const p = this._places[this._index];
    for (const [id, m] of this._marks) m.classList.toggle('is-sel', id === p?.id);
    // the ring and the route from the camp
    const over = this._over;
    over.replaceChildren();
    if (p) {
      const home = this._places.find((q) => q.state === 'home');
      const [x, y] = this._at(p);
      if (home && home !== p) {
        const [hx, hy] = this._at(home);
        put(over, routeLine(MW, MH, [hx - MX, hy - MY], [x - MX, y - MY], !p.go), MX, MY, 1, 'lu-atlas__route');
      }
      put(over, selectRing(), x - RING / 2, y - RING / 2, 1, 'lu-atlas__ring');
    }
    // the panel
    this._panel?.remove();
    const pg = box(g, PX0, MY, PX1 - PX0, MH, 'lu-atlas__panel');
    this._panel = pg;
    if (!p) return;
    const pw = PX1 - PX0;
    let y = MY + 4;
    const name = txt(pg, p.name, PX0, y, { font: 'name', color: k.g4, ol: true, maxW: pw, cls: 'lu-atlas__name' });
    y += 14 * Math.max(1, name.lines);
    put(pg, stateSign(p.state), PX0, y);
    txc(pg, UP(p.stateLabel), PX0 + 13, y + 4, { font: 'small', track: 1, color: p.state === 'rumor' ? k.tx3 : k.tx2, drop: true });
    y += 16;
    put(pg, hairline(pw, 'both', k.dm1), PX0, y);
    y += 10;
    // the journey
    if (p.travel.length) {
      section(pg, UP(v.texts.journey), PX0, PX1, y, null);
      y += 10;
      for (const line of p.travel) {
        txt(pg, line, PX0, y, { font: 'line', color: k.tx1, drop: true, maxW: pw });
        y += 11;
      }
      if (p.warn) {
        const w = txt(pg, p.warn, PX0, y, { font: 'line', color: k.hp3, drop: true, maxW: pw, lineH: 10 });
        y += 10 * Math.max(1, w.lines) + 1;
      }
      y += 6;
    }
    // what is there
    section(pg, UP(v.texts.yields), PX0, PX1, y, null);
    y += 10;
    txt(pg, p.yields.length ? p.yields.join(' · ') : v.texts.unknown, PX0, y, { font: 'line', color: p.yields.length ? k.kw : k.tx3, drop: true, maxW: pw });
    y += 17;
    // the note
    if (p.note) {
      section(pg, UP(v.texts.note), PX0, PX1, y, null);
      y += 10;
      txt(pg, `“${p.note}”`, PX0, y, { font: 'line', color: k.tx2, drop: true, maxW: pw, lineH: 10, cls: 'lu-atlas__note' });
    }
    // the Travel plate (or why not)
    const by = MY + MH - 18;
    if (p.go) {
      const go = box(pg, PX0, by, pw, 16, 'lu-atlas__go', 'button');
      go.setAttribute('aria-label', `${v.texts.travel}: ${p.name}`);
      put(go, plate(pw, 16), PX0, by);
      const label = UP(v.texts.travel);
      const lw = measure(label, 'name', 1) + capW('Enter') + 6;
      const lx = PX0 + Math.round((pw - lw) / 2);
      key(go, 'Enter', lx, by + 3);
      txc(go, label, lx + capW('Enter') + 6, by + 8, { font: 'name', track: 1, color: k.g5, ol: true });
    } else if (p.why) {
      txt(pg, p.why, PX0, by - 2, { font: 'line', color: k.tx3, drop: true, maxW: pw, lineH: 10 });
    } else if (p.state === 'home') {
      txt(pg, v.texts.here, PX0, by + 2, { font: 'line', color: k.tx3, drop: true, maxW: pw });
    }
  }
}
