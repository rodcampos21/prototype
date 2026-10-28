import { ENEMY_DEFS, ENEMY_SCALING } from './defs.js';
import { t } from '../../engine/i18n/I18n.js';
import { ownValue } from '../../engine/utils/own.js';

/**
 * @import { EnemyKind } from './defs.js'
 * @import { JournalCodexEntry } from '../../engine/ui/types.js'
 */

/**
 * The Códex — the journal's bestiary tab (COMBAT.md §7.10): every enemy kind the game lists, by
 * its number. A kind is locked (a silhouette, its number and "????") until the player defeats one
 * of it; then its page shows the picture, the description, the stats at level 1 with what each
 * gains per level, the drops and how many were defeated. Unlocks belong to the game being played:
 * a campaign carries them from level to level and keeps them in its save with the rest of the
 * combat progress (CombatSystem `exportProgress` / `importProgress`, CampaignState `combat.codex`);
 * a level played on its own starts with an empty Códex every time.
 *
 * Adding a mob: one row in `CODEX` (its number and its `ENEMY_DEFS` kind) and its description in
 * combat/strings.js (`codex.text.<kind>`, Portuguese and English). Its stats, growth and drops
 * come from `ENEMY_DEFS` / `ENEMY_SCALING`, its name from `enemy.<kind>`, its picture from its
 * enemy sheet — nothing else to write.
 *
 * Owned by CombatSystem (created with it, so a peaceful level holds none of it); the game hands
 * `entries()` to the journal (`Game.journalData`).
 */

/**
 * The Códex's entries in number order: `no` is the number shown (0001 …, unique), `kind` an
 * `ENEMY_DEFS` key.
 * @type {readonly { no: number, kind: EnemyKind }[]}
 */
export const CODEX = Object.freeze([
  Object.freeze({ no: 1, kind: /** @type {EnemyKind} */ ('slime') }),
]);

/** @param {string} k @param {Record<string, any>} [v] */
const c = (k, v) => t(`combat.${k}`, v);

/**
 * A number as the page's language writes it (`digits` decimals at most: 5,2 · 0,96 · 8).
 * @param {number} n @param {number} [digits]
 */
function num(n, digits = 1) {
  const lang = c('codex.locale');
  return n.toLocaleString(lang, { maximumFractionDigits: digits });
}

export class Codex {
  /**
   * @param {{ events?: { on(name: string, fn: (e: any) => void): () => void } | null,
   *   picture?: (kind: EnemyKind) => HTMLCanvasElement | null }} [o]
   *   events: the combat's (its `kill` unlocks the kind); picture: a kind's portrait (an idle frame
   *   of its sheet)
   */
  constructor({ events = null, picture = () => null } = {}) {
    this._picture = picture;
    /** @type {Map<string, HTMLCanvasElement|null>} portraits by kind (cut once) */
    this._pictures = new Map();
    /** @type {Record<string, number>} defeated per kind (a kind present: unlocked) */
    this.kills = Object.create(null);
    this._off = events ? events.on('kill', (e) => { if (e && !e.passive && !e.isAdd) this.record(e.kind); }) : null;
  }

  /**
   * One defeated enemy of `kind`: unlocks its page (if the Códex lists it) and counts it.
   * @param {string} kind
   * @returns {boolean} true when this unlocked the page
   */
  record(kind) {
    if (!CODEX.some((x) => x.kind === kind)) return false;
    const first = !this.isUnlocked(kind);
    this.kills[kind] = (this.kills[kind] ?? 0) + 1;
    return first;
  }

  /** @param {string} kind */
  isUnlocked(kind) {
    return (ownValue(this.kills, kind) ?? 0) > 0;
  }

  /** Forget every unlock (tests; `__game.combat.codexReset()`). */
  reset() {
    this.kills = Object.create(null);
  }

  /**
   * The unlocks as saved (CombatProgress `codex`): defeated per kind, unlocked kinds only.
   * @returns {Record<string, number>}
   */
  exportKills() {
    return { ...this.kills };
  }

  /**
   * Restore `exportKills`'s result (a saved game is untrusted: kinds the Códex does not list and
   * counts that are not whole positive numbers are dropped). Replaces what was there.
   * @param {unknown} kills
   */
  importKills(kills) {
    this.kills = Object.create(null);
    if (!kills || typeof kills !== 'object') return;
    for (const { kind } of CODEX) {
      const n = Math.floor(Number(ownValue(/** @type {Record<string, unknown>} */ (kills), kind)));
      if (Number.isFinite(n) && n > 0) this.kills[kind] = Math.min(n, 1e7);
    }
  }

  /**
   * The journal's Códex tab, translated (texts in the page's language).
   * @returns {JournalCodexEntry[]}
   */
  entries() {
    return CODEX.map(({ no, kind }) => {
      const unlocked = this.isUnlocked(kind);
      /** @type {JournalCodexEntry} */
      const entry = { id: kind, no, unlocked, image: this._portrait(kind) };
      if (!unlocked) return entry;
      const d = ENEMY_DEFS[kind];
      const grow = (/** @type {number} */ base, /** @type {number} */ share) => (d.boss ? '' : c('codex.perLevel', { n: num(base * share, 2) }));
      const [g0, g1] = d.gold;
      entry.name = c(`enemy.${kind}`);
      entry.text = c(`codex.text.${kind}`);
      entry.kills = this.kills[kind];
      entry.stats = [
        { label: c('codex.stat.hp'), value: num(d.hp), growth: grow(d.hp, ENEMY_SCALING.hp) },
        { label: c('codex.stat.atk'), value: num(d.atk), growth: grow(d.atk, ENEMY_SCALING.atk) },
        { label: c('codex.stat.def'), value: num(d.def), growth: '' },
        { label: c('codex.stat.poise'), value: Number.isFinite(d.poise) ? num(d.poise) : '∞', growth: '' },
        { label: c('codex.stat.speed'), value: num(d.speed), growth: '' },
        { label: c('codex.stat.xp'), value: num(d.xp), growth: grow(d.xp, ENEMY_SCALING.xp) },
        { label: c('codex.stat.gold'), value: g0 === g1 ? num(g0) : `${num(g0)}–${num(g1)}`, growth: d.boss ? '' : c('codex.perLevelPct', { n: num(ENEMY_SCALING.gold * 100) }) },
      ];
      entry.drops = [];
      for (const id of /** @type {const} */ (['heart', 'mana', 'draught'])) {
        const p = d.drops[id] ?? 0;
        if (p > 0) entry.drops.push({ label: c(`codex.drop.${id}`), value: c('codex.pct', { n: num(p * 100) }) });
      }
      return entry;
    });
  }

  dispose() {
    this._off?.();
    this._off = null;
  }

  // ------------------------------------------------------------------------------------------

  /** @param {EnemyKind} kind */
  _portrait(kind) {
    if (!this._pictures.has(kind)) {
      let pic = null;
      try { pic = this._picture(kind); } catch { pic = null; }
      this._pictures.set(kind, pic);
    }
    return this._pictures.get(kind) ?? null;
  }

}

/**
 * A kind's portrait: the first idle frame facing the camera, cut from its sheet (a new canvas,
 * the frame's own size).
 * @param {{ canvas: HTMLCanvasElement, frameWidth: number, frameHeight: number, poses?: Record<string, number> }} sheet
 * @returns {HTMLCanvasElement}
 */
export function portraitFrom(sheet) {
  const { frameWidth: w, frameHeight: h } = sheet;
  const col = sheet.poses?.idle0 ?? 0;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').drawImage(sheet.canvas, col * w, 0, w, h, 0, 0, w, h);
  return out;
}

