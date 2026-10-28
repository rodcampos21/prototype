/**
 * UI strings, namespace 'title' (docs/specs/I18N.md §2): the title screen. Owner: B-title
 * (docs/specs/PIXEL_UI.md §8). A core namespace: registered by the UI root (strings/index.js), so
 * `t('title.<key>')` works on every page with a UI.
 *
 * Keys are ids, not words; `pt` is the source, `en` its translation — each a table of key → string
 * (`{var}` slots) or function. Key names stay Latin in every language (they are drawn as keycaps
 * beside these words, never inside them: the gap after a keycap is the layout's, so no entry starts
 * with a space).
 *
 * - `name`: the title's default text when the caller gives none (the engine's name: a brand, not
 *   translated).
 * - `pressAnyKey`: the prompt of a title without a menu; a level passes its own
 *   `environment.title.prompt`, translated by the level's content table under the text key the level
 *   holds for it (its `textKeys['title.prompt']`, docs/specs/I18N.md §4.2) — a blank one is the UI
 *   string `game.default.prompt`; both must agree with these.
 * - `credit`: the footer when the caller gives none.
 * - `chooseLevel`: the label after the ← → keycaps under the level chooser.
 * - `travelTo`: the prompt (after the Enter / A keycaps) once another level is chosen.
 * - `prevLevel` / `nextLevel`: the chooser's arrows (aria labels).
 * - `choose` / `start`: the menu's key hints (↑ ↓ Escolher · Space Começar), as mockup G.
 * - `menu`: the menu's aria label.
 * - `language`: the language row (its aria label and the hint while it has the focus).
 * - `langSwitch` / `langBack`: the language row's hints while it has the focus (Enter Trocar · Esc
 *   Voltar).
 */
/** @type {import('../I18n.js').StringTable} */
const table = {
  pt: {
    name: 'Luminati',
    pressAnyKey: 'Aperte qualquer tecla',
    credit: 'Luminati, engine de pixel art 2.5D · three.js',
    chooseLevel: 'Escolha uma fase',
    travelTo: 'Viajar para {label}',
    prevLevel: 'Fase anterior',
    nextLevel: 'Próxima fase',
    choose: 'Escolher',
    start: 'Começar',
    menu: 'Menu inicial',
    language: 'Idioma',
    langSwitch: 'Trocar',
    langBack: 'Voltar',
  },
  en: {
    name: 'Luminati',
    pressAnyKey: 'Press any key',
    credit: 'Luminati 2.5D Pixel-Art Engine · three.js',
    chooseLevel: 'Choose a level',
    travelTo: 'Travel to {label}',
    prevLevel: 'Previous level',
    nextLevel: 'Next level',
    choose: 'Choose',
    start: 'Start',
    menu: 'Title menu',
    language: 'Language',
    langSwitch: 'Switch',
    langBack: 'Back',
  },
};
export default table;
