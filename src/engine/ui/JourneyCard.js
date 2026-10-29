import { pal, GEMS } from './art/palette.js';
import { art } from './art/painter.js';
import { gem } from './art/gilt.js';
import { fade, rgbOf, hairline } from './art/pieces.js';
import { placeMark } from './art/atlas.js';
import { group, put, keyHints } from './layout/layout.js';
import { txc, fit, measure, UP } from './layout/type.js';
import { onScale } from './UiScale.js';
import { currentFonts } from './FontLoader.js';
import './ui.css';
import './journey.css';

/**
 * The journey card (docs/specs/PIXEL_UI.md §8.1): what the screen shows while a journey on the
 * atlas loads, instead of a black screen. Over the fader's black: a stepped shade, the kicker
 * ("On the way to"), the destination's name in the head role between gold hairlines with a gem, one
 * line of the road in the line role, the route from the mark of the place left to the mark of the
 * destination with the knight's ◆ walking it in steps, the hour of departure under the one and of
 * arrival under the other, a warning when the arrival falls at night, and a key hint to skip.
 *
 * The caller opens it behind the fader (`open`), loads the level meanwhile, then waits for `done()`
 * (the walk played for `seconds`, or skipped with confirm / cancel) and closes it before fading in.
 * Every text comes from the caller, translated.
 */

/** The card's place in G's 640 × 360 frame (art px). */
const CX = 320, NAME_Y = 150, ROUTE_Y = 204, ROUTE_X0 = 214, ROUTE_X1 = 426;
/** The widest name / line (longer ones end in an ellipsis). */
const MAX_W = 440;
/** The walk's steps (the ◆ moves in whole steps, like the rest of the UI). */
const STEPS = 24;
/** A place mark's size (art/atlas.js placeMark). */
const MARK = 19;

/** @typedef {import('./types.js').JourneyView} JourneyView */

export class JourneyCard {
  /** @param {HTMLElement} parent the UI root */
  constructor(parent) {
    const el = document.createElement('div');
    el.className = 'lu-journey';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('aria-live', 'polite');
    parent.appendChild(el);
    this.element = el;
    this._open = false;
    /** @type {JourneyView|null} */
    this._view = null;
    this._t0 = 0;
    this._seconds = 2.4;
    this._skipped = false;
    this._armedAt = 0;
    this._step = -1;
    /** @type {HTMLCanvasElement|null} the route (redrawn as the ◆ walks) */
    this._route = null;
    /** @type {(() => void)|null} */
    this._resolve = null;
    /** @type {Promise<void>|null} */
    this._done = null;
    this._timer = 0;
    this._offScale = onScale(parent, () => { if (this._open) this._layout(); });
  }

  /** True between open() and close(). */
  get isOpen() { return this._open; }

  /** How far the walk has come (0…1). */
  get progress() {
    if (!this._open) return 0;
    return this._skipped ? 1 : Math.min(1, (performance.now() - this._t0) / (this._seconds * 1000));
  }

  /**
   * Show the card (fades in over the fader's black).
   * @param {JourneyView} view
   * @param {{ seconds?: number }} [opts] seconds: how long the walk takes before `done()` resolves
   */
  open(view, { seconds = 2.4 } = {}) {
    this._settle();
    clearTimeout(this._timer);
    this._view = view;
    this._open = true;
    this._skipped = false;
    this._seconds = Math.max(0.2, seconds);
    this._t0 = performance.now();
    this._armedAt = this._t0 + 300;
    this._step = -1;
    this._done = new Promise((resolve) => { this._resolve = resolve; });
    this._timer = setTimeout(() => this._settle(), this._seconds * 1000);
    this._layout();
    const el = this.element;
    el.classList.remove('is-open');
    void el.offsetWidth;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    const fonts = currentFonts();
    if (fonts) {
      fonts.ensure([view.kicker, view.name, view.line, view.from.time, view.to.time, view.warn, view.skip].join('\n'))
        .then(() => { if (this._open && this._view === view) this._layout(); }, () => {});
    }
  }

  /** Resolves once the walk has played (or was skipped); at once when the card is not open. */
  done() {
    return this._done ?? Promise.resolve();
  }

  /**
   * Hide the card (a short fade); resolves when it is gone.
   * @returns {Promise<void>}
   */
  close() {
    this._settle();
    clearTimeout(this._timer);
    if (!this._open) return Promise.resolve();
    this._open = false;
    const el = this.element;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    return new Promise((resolve) => { this._timer = setTimeout(resolve, 260); });
  }

  /**
   * Walk the ◆ on and read a skip (confirm or cancel). Call once per frame while open (`UI.update`).
   * @param {number} dt seconds (unused: the walk follows the wall clock, loading stalls frames)
   * @param {{ actionPressed(name: string): boolean, consumeAction?(name: string): boolean }} [input]
   */
  update(dt, input) {
    if (!this._open) return;
    const pressed = (name) => !!input && (typeof input.consumeAction === 'function' ? input.consumeAction(name) : input.actionPressed(name));
    const skip = pressed('confirm') || pressed('cancel');
    if (skip && performance.now() >= this._armedAt) {
      this._skipped = true;
      this._settle();
    }
    this._drawRoute();
  }

  dispose() {
    clearTimeout(this._timer);
    this._settle();
    this._offScale();
    this.element.remove();
  }

  _settle() {
    const r = this._resolve;
    this._resolve = null;
    if (r) r();
  }

  // ------------------------------------------------------------------------------------------
  // Layout (art px of G's 640 × 360 frame)
  // ------------------------------------------------------------------------------------------

  _layout() {
    const v = this._view;
    if (!v) return;
    const k = pal();
    const el = this.element;
    el.replaceChildren();
    const g = group(el, 'mc', 0, 0, 640, 360, 'lu-journey__card');
    // the shade behind the words
    const sw = 520, sh = 170;
    const shade = fade(sw, sh, rgbOf(k.band), (u, v2) => Math.max(0, 1 - Math.hypot((u - 0.5) / 0.5, (v2 - 0.5) / 0.5)) * 1.3 * 0.6, [0.2, 0.4, 0.6]);
    put(g, shade, CX - sw / 2, 108, 1, 'lu-journey__shade').setAttribute('aria-hidden', 'true');
    // the kicker, the name between the rules, the line of the road
    const name = fit(UP(v.name), 'head', MAX_W, 1);
    const lw = Math.max(120, measure(name, 'head', 1) + 48) + (Math.max(120, measure(name, 'head', 1) + 48) % 2);
    txc(g, UP(v.kicker), CX, NAME_Y - 22, { font: 'small', track: 1, color: k.g4, align: 'center', drop: true, cls: 'lu-journey__kicker' });
    put(g, hairline(lw, 'both'), CX - lw / 2, NAME_Y - 12, 1, 'lu-journey__rule');
    put(g, art(9, 5, (p) => gem(p, 4, 2, 1, GEMS.gold(), { setting: [k.g5, k.g4, k.g3] })), CX - 4, NAME_Y - 14, 1, 'lu-journey__rule');
    const te = txc(g, name, CX, NAME_Y, { font: 'head', track: 1, color: k.g5, align: 'center', ol: true, cls: 'lu-journey__name' });
    te.setAttribute('role', 'heading');
    te.setAttribute('aria-level', '2');
    put(g, hairline(lw, 'both'), CX - lw / 2, NAME_Y + 11, 1, 'lu-journey__rule');
    if (v.line) txc(g, fit(v.line, 'line', MAX_W), CX, NAME_Y + 27, { font: 'line', color: k.tx1, align: 'center', drop: true, cls: 'lu-journey__line' });
    // the route: the place left, the dots, the destination; the hours under them
    put(g, placeMark(v.from.icon, v.from.state), ROUTE_X0 - MARK - 3, ROUTE_Y - (MARK >> 1), 1, 'lu-journey__mark');
    put(g, placeMark(v.to.icon, v.to.state), ROUTE_X1 + 4, ROUTE_Y - (MARK >> 1), 1, 'lu-journey__mark');
    this._route = art(ROUTE_X1 - ROUTE_X0, 7, () => {});
    put(g, this._route, ROUTE_X0, ROUTE_Y - 3, 1, 'lu-journey__route');
    this._step = -1;
    this._drawRoute();
    txc(g, v.from.time, ROUTE_X0 - MARK / 2 - 3, ROUTE_Y + 18, { font: 'line', color: k.tx2, align: 'center', drop: true });
    txc(g, v.to.time, ROUTE_X1 + 4 + MARK / 2, ROUTE_Y + 18, { font: 'line', color: v.warn ? k.hp3 : k.tx1, align: 'center', drop: true });
    if (v.warn) txc(g, fit(v.warn, 'line', MAX_W), CX, ROUTE_Y + 34, { font: 'line', color: k.hp3, align: 'center', drop: true, cls: 'lu-journey__warn' });
    if (v.skip) keyHints(g, [{ keys: ['Enter'], label: v.skip }], 620, 340, { align: 'right', color: k.tx3, drop: true });
  }

  /** The route's dots up to the ◆ in gold, the rest dim; drawn again only when the ◆ steps on. */
  _drawRoute() {
    const c = this._route;
    if (!c) return;
    const step = Math.round(this.progress * STEPS);
    if (step === this._step) return;
    this._step = step;
    const k = pal();
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const w = c.width;
    const at = Math.round((step / STEPS) * (w - 1));
    ctx.fillStyle = k.dm1;
    for (let x = 1; x < w; x += 4) if (x > at) ctx.fillRect(x, 3, 2, 1);
    ctx.fillStyle = k.g3;
    for (let x = 1; x < w; x += 4) if (x <= at) ctx.fillRect(x, 3, 2, 1);
    // the knight's ◆: ink rim, gold, a lit pixel
    const px = Math.max(3, Math.min(w - 4, at));
    ctx.fillStyle = k.ink0;
    ctx.fillRect(px - 3, 3, 7, 1); ctx.fillRect(px - 2, 2, 5, 3); ctx.fillRect(px - 1, 1, 3, 5); ctx.fillRect(px, 0, 1, 7);
    ctx.fillStyle = k.g4;
    ctx.fillRect(px - 2, 3, 5, 1); ctx.fillRect(px - 1, 2, 3, 3); ctx.fillRect(px, 1, 1, 5);
    ctx.fillStyle = k.g5;
    ctx.fillRect(px, 2, 1, 1);
  }
}
