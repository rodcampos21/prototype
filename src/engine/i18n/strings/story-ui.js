/**
 * UI strings, namespace 'story-ui' (docs/specs/I18N.md §2): the story UI — the journal, the end
 * card, the cutscene's skip hint. Owner: B-story (docs/specs/PIXEL_UI.md §8). A feature namespace:
 * registered by the story UI when `UI.useStoryUI()` makes it (the journal, emotes and end card
 * register it in their constructors: this file travels in the story chunk, never in what a level
 * without a story loads).
 *
 * Keys are ids, not words; `pt` is the source, `en` its translation — each a table of key → string
 * (`{var}` slots) or function. `{key}` is a keycap slot: the component draws the key there as a
 * keycap (never a word in the sentence). Import-free: the i18n checker reads it in Node.
 *
 * Terms (docs/specs/I18N.md §3; docs/specs/I18N_GLOSSARY.md §6): the journal is Diário (the
 * controls legend's "Diário" must match), Selecionar and Fechar as the tactics panel's hints.
 */
/** @type {import('../I18n.js').StringTable} */
const table = {
  pt: {
    // the journal's window
    'journal.title': 'Diário',
    'tab.quests': 'Missões',
    'tab.items': 'Itens',
    'tab.codex': 'Códex',
    'group.active': 'Em andamento',
    'group.concluded': 'Encerradas',
    'group.keyItems': 'Itens-chave',
    'group.items': 'Itens',
    'state.active': 'Em andamento',
    'state.done': 'Concluída',
    'state.failed': 'Fracassada',
    'empty.quests': 'Nenhuma missão ainda.',
    'empty.items': 'Sua bolsa está vazia.',
    /** the empty tabs' hints, under their line (the journal's empty state) */
    'empty.questsHint': 'O que as pessoas que você encontra pedem a você fica escrito aqui.',
    'empty.itemsHint': 'O que você encontra e recebe fica guardado aqui.',
    'empty.codex': 'O Códex está vazio.',
    'empty.codexHint': 'As criaturas que você derrotar ficam registradas aqui.',
    objectives: 'Objetivos',
    log: 'Registro',
    keyItem: 'Item-chave',
    unknownItem: 'Não se sabe mais nada sobre isso.',
    // the Códex tab (the bestiary: a page per enemy kind, locked until one is defeated)
    'group.codex': 'Criaturas',
    'codex.no': 'Nº {no}',
    'codex.unknown': '????',
    'codex.locked': 'Não registrada',
    'codex.lockedHint': 'Derrote esta criatura para registrá-la no Códex.',
    'codex.seen': 'Registrada',
    'codex.stats': 'Atributos',
    'codex.statsHint': 'No nível 1',
    'codex.drops': 'Drops',
    'codex.noDrops': 'Não deixa nada além de ouro.',
    'codex.kills': 'Derrotadas: {n}',
    /** an item's count (the list and the item's heading) */
    count: '×{n}',
    /** the gold's unit (Latin in every language) */
    gold: 'G',
    // the journal's key hints (in its header)
    'hint.tabs': 'Abas',
    'hint.select': 'Selecionar',
    'hint.close': 'Fechar',
    // the end card's prompt (shown once input is accepted; {key} the keycap)
    'end.prompt': 'Aperte {key} para continuar',
    // the cutscene's skip hint ({key} the keycap)
    'skip.hold': 'Segure {key} para pular',
  },
  en: {
    'journal.title': 'Journal',
    'tab.quests': 'Quests',
    'tab.items': 'Items',
    'tab.codex': 'Codex',
    'group.active': 'Active',
    'group.concluded': 'Concluded',
    'group.keyItems': 'Key Items',
    'group.items': 'Items',
    'state.active': 'In progress',
    'state.done': 'Completed',
    'state.failed': 'Failed',
    'empty.quests': 'No quests yet.',
    'empty.items': 'Your pack is empty.',
    'empty.questsHint': 'What the people you meet ask of you is written here.',
    'empty.itemsHint': 'What you find and are given is kept here.',
    'empty.codex': 'The Codex is empty.',
    'empty.codexHint': 'The creatures you defeat are recorded here.',
    objectives: 'Objectives',
    log: 'Log',
    keyItem: 'Key Item',
    unknownItem: 'Nothing more is known of it.',
    'group.codex': 'Creatures',
    'codex.no': 'No. {no}',
    'codex.unknown': '????',
    'codex.locked': 'Not recorded',
    'codex.lockedHint': 'Defeat this creature to record it in the Codex.',
    'codex.seen': 'Recorded',
    'codex.stats': 'Stats',
    'codex.statsHint': 'At level 1',
    'codex.drops': 'Drops',
    'codex.noDrops': 'Leaves nothing but gold.',
    'codex.kills': 'Defeated: {n}',
    count: '×{n}',
    gold: 'G',
    'hint.tabs': 'Tabs',
    'hint.select': 'Select',
    'hint.close': 'Close',
    'end.prompt': 'Press {key} to continue',
    'skip.hold': 'Hold {key} to skip',
  },
};
export default table;
