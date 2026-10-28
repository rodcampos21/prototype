/**
 * UI strings, namespace 'hud' (docs/specs/I18N.md §2): the HUD (location plate, clock, controls
 * legend, toasts), the area banner. Owner: B-hud (docs/specs/PIXEL_UI.md §8). A core namespace:
 * registered by the UI root (strings/index.js), so `t('hud.<key>')` works on every page with a UI.
 *
 * Keys are ids, not words; `pt` is the source, `en` its translation — each a table of key → string
 * (`{var}` slots) or function.
 * - `controls`, `hide`: the legend's heading and its footer ([H] Esconder controles; the gap after
 *   the keycap is CSS, never a space in the string).
 * - `control.<id>`: the labels of the HUD's default legend (`DEFAULT_CONTROLS` ids). The game's own
 *   legend rows (src/game/Game.js, combat bindings) are translated by their owners and passed in;
 *   these ids are free for them to reuse where the words are the same. The words are the game's
 *   (strings/game.js `controls.*`, the canonical legend vocabulary, I18N_GLOSSARY.md): one key
 *   reads the same in every legend.
 * - `phase.<id>`: the clock's phases (`timePhase()` ids; the glossary, I18N_GLOSSARY.md §6).
 * - `key.<left|up|right|down>`: the arrow keycaps' accessible names (`createKeycaps`).
 * - `clock`: the clock's accessible name.
 * Key names on keycaps (Space, Shift, Esc …) stay Latin in every language and are not here.
 */
/** @type {import('../I18n.js').StringTable} */
const table = {
  pt: {
    controls: 'Controles',
    hide: 'Esconder controles',
    'control.move': 'Andar',
    'control.run': 'Correr',
    'control.talk': 'Falar / Confirmar',
    'control.rotate': 'Girar câmera',
    'control.zoom': 'Zoom (ou rodinha)',
    'control.map': 'Mapa-múndi',
    'control.time': 'Hora do dia',
    'control.weather': 'Clima',
    'control.photo': 'Modo foto',
    'control.music': 'Música',
    'control.debug': 'Painel de depuração',
    'phase.night': 'Noite',
    'phase.dawn': 'Amanhecer',
    'phase.morning': 'Manhã',
    'phase.midday': 'Meio-dia',
    'phase.afternoon': 'Tarde',
    'phase.golden': 'Hora dourada',
    'phase.dusk': 'Crepúsculo',
    'key.left': 'Seta para a esquerda',
    'key.up': 'Seta para cima',
    'key.right': 'Seta para a direita',
    'key.down': 'Seta para baixo',
    clock: '{time}, {phase}',
  },
  en: {
    controls: 'Controls',
    hide: 'Hide controls',
    'control.move': 'Move',
    'control.run': 'Run',
    'control.talk': 'Talk / Confirm',
    'control.rotate': 'Rotate camera',
    'control.zoom': 'Zoom (or wheel)',
    'control.map': 'World map',
    'control.time': 'Time of day',
    'control.weather': 'Weather',
    'control.photo': 'Photo mode',
    'control.music': 'Music',
    'control.debug': 'Debug panel',
    'phase.night': 'Night',
    'phase.dawn': 'Dawn',
    'phase.morning': 'Morning',
    'phase.midday': 'Midday',
    'phase.afternoon': 'Afternoon',
    'phase.golden': 'Golden Hour',
    'phase.dusk': 'Dusk',
    'key.left': 'Left arrow',
    'key.up': 'Up arrow',
    'key.right': 'Right arrow',
    'key.down': 'Down arrow',
    clock: '{time}, {phase}',
  },
};
export default table;
