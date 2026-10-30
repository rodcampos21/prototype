import * as THREE from 'three';
import './ui.css';
import './floatsigns.css';
import { pal, GEMS } from './art/palette.js';
import { measure, txt, setOrigin, UP } from './layout/type.js';
import { win, place, put } from './layout/layout.js';
import { onScale, currentScale } from './UiScale.js';
import { currentFonts } from './FontLoader.js';
import { wrapLines } from './Journal.js';

/**
 * FloatSigns — floating sign plates over spots of the world (docs/specs/PIXEL_UI.md §5, Floating
 * signs): a small gilt XS plate with a title in tracked small capitals and a few lines in the line
 * role, on a thin stem down to its anchor, like a board hung over a building plot (a `signpost`
 * with `opts.float`: what will stand there and what it costs). A plate shows while its spot is
 * near the player (`range` world units), its story group is there and the spot is on screen; it
 * fades in and out in steps. Projected every frame into CSS px (the interaction prompt's way),
 * drawn in art px at the UI root's `--px`. Not occluded by the scene (it is a sign).
 *
 * Inside the HUD element: it hides with the HUD (cutscenes, photo mode) and under the dialog.
 */

/** The widest a plate's text runs (art px) and its padding; the stem's height under the plate. */
const MAX_W = 156, PAD = 5, STEM = 6;

/**
 * A sign to show: where its plate hangs (the stem's foot), its title and lines (translated), and
 * whether it is there now (its story group); an icon (16 × 16, a build slot's building) left of the
 * title.
 * @typedef {{ position: THREE.Vector3, title: string, lines: string[], icon?: HTMLCanvasElement|null, present?: () => boolean }} FloatSignSpec
 */

const _v = new THREE.Vector3();

export class FloatSigns {
  /** @param {HTMLElement} parent the HUD element (it covers the root) */
  constructor(parent) {
    this._parent = parent;
    const el = document.createElement('div');
    el.className = 'lu-fsigns';
    el.setAttribute('aria-hidden', 'true');
    parent.appendChild(el);
    this.element = el;
    /** @type {{ spec: FloatSignSpec, el: HTMLElement, plate: HTMLElement, on: boolean, x: number, y: number }[]} */
    this._signs = [];
    this._w = parent.clientWidth || window.innerWidth;
    this._h = parent.clientHeight || window.innerHeight;
    this._ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        this._w = parent.clientWidth || window.innerWidth;
        this._h = parent.clientHeight || window.innerHeight;
        for (const s of this._signs) s.x = NaN;
      })
      : null;
    this._ro?.observe(parent);
    this._offScale = onScale(parent, () => { for (const s of this._signs) this._layout(s); });
  }

  /**
   * The level's signs (replacing the last level's).
   * @param {FloatSignSpec[]} list
   */
  set(list) {
    this.element.replaceChildren();
    this._signs = (Array.isArray(list) ? list : []).filter((s) => s && s.position && (s.title || s.lines?.length)).map((spec) => {
      const el = document.createElement('div');
      el.className = 'lu-fsign';
      const plate = document.createElement('div');
      plate.className = 'lu-fsign__plate g';
      el.append(plate);
      this.element.append(el);
      const s = { spec, el, plate, on: false, x: NaN, y: NaN };
      this._layout(s);
      return s;
    });
    const fonts = currentFonts();
    const text = this._signs.map((s) => [s.spec.title, ...s.spec.lines].join(' ')).join(' ');
    if (fonts && text) fonts.ensure(text).then(() => { for (const s of this._signs) this._layout(s); });
  }

  /**
   * Place the signs near `focus` (the player). Call once per frame.
   * @param {THREE.Camera & { near?: number }} camera
   * @param {{ x: number, z: number }|null} focus
   * @param {number} [range] world units
   */
  update(camera, focus, range = 12) {
    if (!this._signs.length || !camera) return;
    camera.updateMatrixWorld();
    const dpr = currentScale(this._parent)?.dpr || window.devicePixelRatio || 1;
    for (const s of this._signs) {
      const p = s.spec.position;
      const near = !!focus && Math.hypot(p.x - focus.x, p.z - focus.z) <= range && (s.spec.present?.() ?? true);
      let on = false;
      if (near) {
        _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
        const behind = _v.z > -(camera.near ?? 0.01);
        _v.applyMatrix4(camera.projectionMatrix);
        on = !behind && _v.x > -1.05 && _v.x < 1.05 && _v.y > -1.05 && _v.y < 1.1;
        if (on) {
          const x = Math.round((_v.x * 0.5 + 0.5) * this._w * dpr) / dpr;
          const y = Math.round((-_v.y * 0.5 + 0.5) * this._h * dpr) / dpr;
          if (x !== s.x || y !== s.y) {
            s.x = x;
            s.y = y;
            s.el.style.transform = `translate3d(${x}px,${y}px,0)`;
          }
        }
      }
      if (on !== s.on) {
        s.on = on;
        s.el.classList.toggle('is-on', on);
      }
    }
  }

  dispose() {
    this._ro?.disconnect();
    this._offScale();
    this.element.remove();
  }

  /**
   * One plate about its anchor (0, 0): the stem STEM art px up from it, the plate above, its title
   * (small, tracked capitals, g4) and its lines (line role: the first in tx1, the rest — the cost,
 * the time — in the gold).
   * @param {{ spec: FloatSignSpec, plate: HTMLElement }} s
   */
  _layout(s) {
    const k = pal();
    const P = s.plate;
    P.replaceChildren();
    const title = s.spec.title ? UP(s.spec.title) : '';
    // (each line wrapped; the first — what it is — in the text's colour, the rest — the cost, the
    // time — in the gold)
    const lines = s.spec.lines.flatMap((l, i) => wrapLines(String(l), 'line', MAX_W).map((text) => ({ text, gold: i > 0 })));
    // (an icon: left of the title, the title row as tall as the icon)
    const icon = s.spec.icon ?? null;
    const iw = icon ? 19 : 0;
    const head = icon ? 19 : title ? 10 : 0;
    const tw = (title ? measure(title, 'small', 1) : 0) + iw;
    const w = Math.min(MAX_W, Math.max(tw, ...lines.map((l) => measure(l.text, 'line')), 40)) + PAD * 2;
    const h = PAD + head + lines.length * 11 + PAD - 2;
    const x0 = -Math.floor(w / 2), y0 = -STEM - h;
    place(P, x0, y0, w, h + STEM);
    setOrigin(P, [x0, y0]);
    win(P, { size: 'XS', corners: GEMS.gold(), cornerR: 1, fill: k.ink1 }, x0, y0, w, h);
    // the stem: two dark art px wide down to the spot
    const stem = document.createElement('i');
    stem.className = 'g lu-fsign__stem';
    place(stem, -1 - x0, h, 2, STEM);
    stem.style.background = k.g2 ?? '#5a4a2a';
    P.append(stem);
    let y = y0 + PAD + 3;
    if (icon) {
      put(P, icon, x0 + PAD, y0 + PAD);
      if (title) txt(P, title, x0 + PAD + iw, y0 + PAD + 6, { font: 'small', track: 1, color: k.g4, drop: true });
      y += head;
    } else if (title) {
      txt(P, title, x0 + PAD, y, { font: 'small', track: 1, color: k.g4, drop: true });
      y += 10;
    }
    lines.forEach((l) => {
      txt(P, l.text, x0 + PAD, y, { font: 'line', color: l.gold ? k.kw : k.tx1, drop: true });
      y += 11;
    });
  }
}
