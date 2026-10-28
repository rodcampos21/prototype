/**
 * UI strings, namespace 'dialog' (docs/specs/I18N.md §2): the dialog box, its choices and the
 * interaction prompt. Owner: B-dialog (docs/specs/PIXEL_UI.md §8). A core namespace: registered by
 * the UI root (strings/index.js), so `t('dialog.<key>')` works on every page with a UI (DialogBox and
 * InteractPrompt register it themselves when they are made without a UI root).
 *
 * Keys are ids, not words; `pt` is the source, `en` its translation — each a table of key → string
 * (`{var}` slots) or function. The words follow the glossary (docs/specs/I18N_GLOSSARY.md §6).
 *
 * - `window`      the dialog window's accessible name (role="dialog")
 * - `choices`     the choice list's accessible name
 * - `portrait`    the portrait's accessible name ({name}: the speaker, as shown)
 * - `next`        the advance mark (▼: more to read)
 * - `end`         the last line's mark (◆: the conversation ends)
 * - `prompt.talk` the prompt's default label (`InteractPrompt.show(pos)` without one; the game
 *                 passes its own translated verbs)
 */
/** @type {import('../I18n.js').StringTable} */
const table = {
  pt: {
    window: 'Diálogo',
    choices: 'Escolhas',
    portrait: 'Retrato de {name}',
    next: 'Continuar',
    end: 'Fim',
    'prompt.talk': 'Falar',
  },
  en: {
    window: 'Dialogue',
    choices: 'Choices',
    portrait: 'Portrait of {name}',
    next: 'More',
    end: 'End',
    'prompt.talk': 'Talk',
  },
};
export default table;
