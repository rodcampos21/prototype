/**
 * UI strings, namespace 'worldfx' (docs/specs/I18N.md §2): the world labels of a combat level
 * (src/engine/ui/WorldLabels.js) — the floating words a hit can show instead of a number, and the
 * level label over an elite's bar. Owner: B-worldfx (docs/specs/PIXEL_UI.md §8). A feature
 * namespace: registered by the WorldLabels constructor (the combat chunk), so a peaceful level
 * never loads it. Import-free (the i18n checker reads it in Node).
 *
 * Keys are ids, not words; `pt` is the source, `en` its translation. "Nv" / "Lv" is the level label
 * (I18N.md §2: HP, MP, SP, XP stay in Latin abbreviations, as JRPGs do).
 */
/** @type {import('../I18n.js').StringTable} */
const table = {
  pt: {
    // a blocked hit (an enemy's guard, a companion's blocked swing): the number's place
    guard: 'Defesa',
    // a perfect dodge (the i-frame roll at the last moment), over the player
    perfect: 'Perfeito!',
    // the level label before an elite's level number ("Nv 3 CAPITÃO GOBLIN")
    lv: 'Nv',
  },
  en: {
    guard: 'Guard',
    perfect: 'Perfect!',
    lv: 'Lv',
  },
};
export default table;
