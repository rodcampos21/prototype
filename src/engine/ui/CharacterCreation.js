import { pal, GEMS } from './art/palette.js';
import { glyph, dimGlyph, plate } from './art/pieces.js';
import { group, box, put, win, keyHints, section } from './layout/layout.js';
import { txt, txc, fit, styleText, grow, UP } from './layout/type.js';
import { onScale } from './UiScale.js';
import { currentFonts } from './FontLoader.js';
import './ui.css';
import './title.css';

/**
 * The character creation over the live 3D scene (a campaign whose `player.create` is true, after
 * the title's New journey — docs/specs/PIXEL_UI.md §8.1): in G's family, a framed window in the
 * middle of the 640 × 360 frame over the title's vignette — the heading, the name field (a real
 * text field set in the name type: the system's keyboard, IME and paste work), the class chooser
 * (◀ the class ▶ on a plate fading at both ends, its line under it) and the key hints.
 *
 * Keyboard: type the name; ↑ ↓ (or Tab) move between the name and the class; ← → choose the class
 * while it has the focus; Enter confirms. Pointer: the arrows choose, the hint "Enter …" confirms.
 * Gamepad (polled while shown): the d-pad ← → chooses the class, A or Start confirms (the field keeps
 * its text, else the suggested name). The keys never reach the game (the window stops them). A name
 * left empty is the suggested one. Every text comes from the caller (translated); the name is never
 * translated. Laid out again when the art scale changes and once the fonts for the texts are in.
 */

/** Standard-mapping gamepad buttons. */
const PAD_A = 0;
const PAD_START = 9;
const PAD_LEFT = 14;
const PAD_RIGHT = 15;

/** The window (art px of G's 640 × 360 frame): centred, 300 × 172. */
const W = 300, H = 172;
const X0 = 320 - W / 2, Y0 = 180 - H / 2;
/** The field's and the plates' inner margin from the window's sides. */
const PAD = 22;

/**
 * A class of the chooser.
 * @typedef {{ id: string, label: string, detail?: string }} CreationClass
 */

/**
 * show()'s texts and choices.
 * @typedef {object} CreationOptions
 * @property {string} title       the heading ('Quem é você?')
 * @property {string} nameLabel   the name section's label
 * @property {string} suggested   the name an empty field confirms with (shown greyed in it)
 * @property {string} classLabel  the class section's label
 * @property {CreationClass[]} classes  at least one
 * @property {string} confirm     the confirm hint's label (after the Enter keycap)
 * @property {string} choose      the ↑ ↓ hint's label
 * @property {string} [prevClass] the arrows' aria labels
 * @property {string} [nextClass]
 * @property {number} [maxLength] the longest name (characters; default 16)
 * @property {string} [name]      the field's text at the start ('')
 * @property {string} [cls]       the class selected at the start (the first)
 */

export class CharacterCreation {
  /** @param {HTMLElement} parent the UI root */
  constructor(parent = document.body) {
    const el = document.createElement('div');
    el.className = 'lu-title lu-create is-gone';
    // (focusable: the keys reach it while the class row has the focus)
    el.tabIndex = -1;
    el.setAttribute('role', 'dialog');
    el.innerHTML = '<div class="lu-title__part lu-create__body"></div>';
    parent.appendChild(el);
    this.element = el;
    this._body = /** @type {HTMLElement} */ (el.querySelector('.lu-create__body'));
    /** The name field (kept: its text and caret survive a layout). */
    this._input = document.createElement('input');
    this._input.type = 'text';
    this._input.className = 'lu-create__name';
    this._input.autocomplete = 'off';
    this._input.spellcheck = false;
    /** @type {CreationOptions|null} */
    this._o = null;
    this._index = 0;
    /** 'name' | 'class': what the keys work on */
    this._focus = 'name';
    this._visible = false;
    this._leaving = false;
    /** @type {((r: { name: string, cls: string }) => void)|null} */
    this._resolve = null;
    this._raf = 0;
    this._padPrev = /** @type {boolean[]} */ ([]);
    this._padInit = false;
    this._hideTimer = 0;
    this._armedAt = 0;

    this._onKey = (/** @type {KeyboardEvent} */ e) => {
      // (the keys typed here never reach the game's input, which listens on the window)
      e.stopPropagation();
      if (!this._accepting()) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); this._confirm(); return; }
      if (e.code === 'Tab' || e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        e.preventDefault();
        this._setFocus(e.code === 'ArrowUp' ? 'name' : e.code === 'ArrowDown' ? 'class' : this._focus === 'name' ? 'class' : 'name');
        return;
      }
      if (this._focus === 'class' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        e.preventDefault();
        this._cycle(e.code === 'ArrowLeft' ? -1 : 1);
      }
    };
    this._onKeyUp = (/** @type {KeyboardEvent} */ e) => { e.stopPropagation(); };
    this._onPointer = (/** @type {PointerEvent} */ e) => {
      if (!this._accepting()) return;
      const tg = /** @type {Element|null} */ (e.target);
      if (tg === this._input) { this._setFocus('name'); return; }
      e.preventDefault();
      const arrow = tg?.closest?.('.lu-create__arrow');
      if (arrow) { this._setFocus('class'); this._cycle(arrow.classList.contains('lu-create__arrow--prev') ? -1 : 1); return; }
      if (tg?.closest?.('.lu-create__class')) { this._setFocus('class'); return; }
      if (tg?.closest?.('.lu-create__go')) { this._confirm(); return; }
      // anywhere else: back to the field
      this._setFocus('name');
    };
    this._poll = () => {
      this._raf = 0;
      if (!this._visible || this._leaving) return;
      const b = this._pollGamepads();
      if (b >= 0 && this._accepting()) {
        if (b === PAD_LEFT || b === PAD_RIGHT) { this._setFocus('class'); this._cycle(b === PAD_LEFT ? -1 : 1); }
        else if (b === PAD_A || b === PAD_START) { this._confirm(); return; }
      }
      this._raf = requestAnimationFrame(this._poll);
    };
    el.addEventListener('keydown', this._onKey);
    el.addEventListener('keyup', this._onKeyUp);
    el.addEventListener('pointerdown', this._onPointer);
    this._offScale = onScale(parent, () => { if (this._visible && !this._leaving) this._layout(); });
  }

  /** True from show() until the fade-out has ended. */
  get visible() { return this._visible; }

  /** The class selected now (its id), null before show(). */
  get selectedClass() { return this._o ? this._o.classes[this._index]?.id ?? null : null; }

  /**
   * Show the creation (fades in). Resolves with the name (the field's, trimmed; the suggested one
   * when empty) and the class id once the player confirms; the window then fades out by itself.
   * @param {CreationOptions} o
   * @returns {Promise<{ name: string, cls: string }>}
   */
  show(o) {
    if (!o?.classes?.length) throw new Error('CharacterCreation.show: no classes');
    clearTimeout(this._hideTimer);
    this._o = o;
    this._index = Math.max(0, o.classes.findIndex((c) => c.id === o.cls));
    this._input.maxLength = o.maxLength ?? 16;
    this._input.value = (o.name ?? '').slice(0, this._input.maxLength);
    this._input.placeholder = o.suggested;
    this._input.setAttribute('aria-label', o.nameLabel);
    this._focus = 'name';
    const el = this.element;
    el.classList.remove('is-on', 'is-leaving', 'is-gone');
    void el.offsetWidth;
    el.classList.add('is-on', 'is-menu');
    el.setAttribute('aria-label', o.title);
    this._visible = true;
    this._leaving = false;
    this._armedAt = performance.now() + 300;
    this._layout();
    const fonts = currentFonts();
    const texts = [o.title, o.nameLabel, o.suggested, o.classLabel, o.confirm, o.choose, ...o.classes.flatMap((c) => [c.label, c.detail ?? ''])].join('\n');
    const relayout = () => { if (this._visible && !this._leaving) this._layout(); };
    if (fonts) fonts.ensure(texts).then(relayout, relayout);
    this._padInit = false;
    if (!this._raf) this._raf = requestAnimationFrame(this._poll);
    // (the field takes the keys at once; a moment later, once the fade has begun)
    setTimeout(() => { if (this._visible && !this._leaving && this._focus === 'name') this._input.focus({ preventScroll: true }); }, 60);
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  dispose() {
    clearTimeout(this._hideTimer);
    if (this._raf) cancelAnimationFrame(this._raf);
    this._offScale();
    this.element.remove();
  }

  // ------------------------------------------------------------------------------------------

  _accepting() { return this._visible && !this._leaving && performance.now() >= this._armedAt; }

  /** The name to keep: the field's (spaces made one, trimmed), else the suggested one. */
  _name() {
    const typed = this._input.value.replace(/\s+/g, ' ').trim();
    return typed || this._o?.suggested || '';
  }

  _confirm() {
    if (!this._o || this._leaving) return;
    const r = { name: this._name(), cls: this._o.classes[this._index].id };
    this._leaving = true;
    this._input.blur();
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    const el = this.element;
    el.classList.add('is-leaving');
    el.classList.remove('is-on');
    this._hideTimer = setTimeout(() => {
      el.classList.remove('is-leaving');
      el.classList.add('is-gone');
      this._visible = false;
      this._leaving = false;
    }, 1150);
    const res = this._resolve;
    this._resolve = null;
    res?.(r);
  }

  /** @param {'name'|'class'} f */
  _setFocus(f) {
    if (f === this._focus) { if (f === 'name') this._input.focus({ preventScroll: true }); return; }
    this._focus = f;
    if (f === 'name') this._input.focus({ preventScroll: true });
    else { this._input.blur(); this.element.focus?.({ preventScroll: true }); }
    this._layout();
  }

  /** @param {number} dir */
  _cycle(dir) {
    const n = this._o?.classes.length ?? 0;
    if (n < 2) return;
    this._index = (this._index + dir + n) % n;
    this._layout();
  }

  /** @returns {number} a gamepad button newly pressed since the previous poll, or -1 */
  _pollGamepads() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return -1;
    let pressed = -1;
    let k = 0;
    for (const pad of pads) {
      if (!pad) continue;
      for (let b = 0; b < pad.buttons.length; b++, k++) {
        const down = pad.buttons[b].pressed;
        if (this._padInit && down && !this._padPrev[k] && pressed < 0) pressed = b;
        this._padPrev[k] = down;
      }
    }
    this._padInit = true;
    return pressed;
  }

  // ------------------------------------------------------------------------------------------
  // Layout (art px of G's 640 × 360 frame)
  // ------------------------------------------------------------------------------------------

  _layout() {
    const o = this._o;
    if (!o) return;
    const body = this._body;
    // (the field is kept: moved out while the rest is laid out again)
    this._input.remove();
    body.replaceChildren();
    const k = pal();
    const g = group(body, 'mc', X0 - 20, Y0 - 20, W + 40, H + 40);
    win(g, { size: 'M', corners: GEMS.gold(), cornerR: 2, trio: true }, X0, Y0, W, H);
    // the heading
    txc(g, UP(fit(o.title, 'head', W - 2 * PAD)), 320, Y0 + 20, { font: 'head', color: k.g4, align: 'center', ol: true, cls: 'lu-create__title' });
    const x0 = X0 + PAD, x1 = X0 + W - PAD;
    const gn = 2 * Math.ceil(grow('name') / 2);
    // the name
    section(g, UP(o.nameLabel), x0, x1, Y0 + 42, null);
    const fy = Y0 + 50;
    const field = box(g, x0, fy, x1 - x0, 18 + gn, `lu-create__field${this._focus === 'name' ? ' is-focus' : ''}`);
    put(field, plate(x1 - x0, 18 + gn), x0, fy);
    styleText(this._input, 'name', { color: k.tx1, ol: true });
    field.append(this._input);
    // the class
    const cy = Y0 + 92;
    section(g, UP(o.classLabel), x0, x1, cy - 8, null);
    const c = o.classes[this._index];
    const one = o.classes.length < 2;
    const on = this._focus === 'class';
    const row = box(g, x0, cy, x1 - x0, 16 + gn, `lu-create__class${on ? ' is-focus' : ''}`);
    put(row, plate(x1 - x0, 16 + gn), x0, cy);
    txc(row, c.label, 320, cy + 8 + gn / 2, { font: 'name', color: on ? k.g5 : k.g4, align: 'center', ol: true, cls: 'lu-create__class-label' });
    for (const [dir, gx] of /** @type {[number, number][]} */ ([[-1, x0 + 6], [1, x1 - 11]])) {
      const a = box(row, gx - 5, cy, 15, 16 + gn, `lu-create__arrow lu-create__arrow--${dir < 0 ? 'prev' : 'next'}`);
      a.setAttribute('role', 'button');
      a.setAttribute('aria-label', (dir < 0 ? o.prevClass : o.nextClass) ?? '');
      const name = dir < 0 ? 'left' : 'right';
      put(a, one ? dimGlyph(name) : glyph(name), gx, cy + 5 + gn / 2);
    }
    if (c.detail) txt(g, fit(c.detail, 'line', x1 - x0), 320, cy + 22 + gn, { font: 'line', color: k.tx2, align: 'center', ol: true, cls: 'lu-create__detail' });
    // the hints; "Enter <confirm>" also confirms on a click
    const hy = Y0 + H - 20;
    const go = box(g, X0, hy - 2, W, 15, 'lu-create__go');
    keyHints(go, [{ keys: ['↑', '↓'], label: o.choose }, { keys: ['Enter'], label: o.confirm }], 320, hy, { align: 'center', color: k.tx2, ol: true });
    if (this._focus === 'name' && document.activeElement !== this._input && this._visible) this._input.focus({ preventScroll: true });
  }
}
