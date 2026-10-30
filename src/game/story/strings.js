/**
 * UI strings, namespace 'story' (docs/specs/I18N.md §2): the story runtime's own messages — the
 * toasts that say what changed hands and how a quest stands. Owner: G-story (docs/specs/PIXEL_UI.md
 * §8). A feature namespace: registered by the StoryRunner when it starts (`registerStoryStrings`),
 * so a level without a story never loads it. Import-free and Node-safe (the i18n checker reads it).
 *
 * What the story files and the levels say (lines, names, quest and item texts) is content, not
 * here: the runtime translates it at display (`loc()` by its key, names with `term()`; I18N.md §4).
 * A code default that stands in for blank data is a UI string here (`ending.default`: an `ending`
 * without a title; `player.default`: the player's name with no character made, I18N.md §4.8).
 * Story errors stay English (the developer UI).
 *
 * Keys are ids; `pt` is the source, `en` its translation; each entry a whole sentence with `{var}`
 * slots: `{title}` a quest's title, `{item}` an item's name (both already translated), `{n}` a count.
 */
/** @type {import('../../engine/i18n/I18n.js').StringTable} */
const table = {
  pt: {
    'quest.start': 'Nova missão: {title}',
    'quest.stage': 'Missão atualizada: {title}',
    'quest.done': 'Missão concluída: {title}',
    'quest.fail': 'Missão fracassada: {title}',
    'gold.received': 'Recebeu {n} de ouro',
    'gold.given': 'Entregou {n} de ouro',
    'item.received': 'Recebido: {item}',
    'item.receivedCount': 'Recebido: {item} ×{n}',
    'item.given': 'Entregue: {item}',
    'item.givenCount': 'Entregue: {item} ×{n}',
    /** the backpack (CAMPAIGN_FORMAT.md §4.2): full while gathering; `{items}` what was stored at home ("6 Madeira, 2 Pedra") */
    'pack.full': 'A mochila está cheia. Volte ao acampamento e guarde no baú.',
    'pack.stored': 'Guardado no baú: {items}',
    'pack.none': 'Não sobrou nada que preste.',
    'pack.empty': 'Nada na mochila para guardar.',
    /**
     * a build slot (BuildingSystem; CAMPAIGN_FORMAT.md §4.3): its floating sign and Space on it —
     * `{items}` a list of counts and names ("12 Madeira, 10 Pedra"), `{name}` a building's name,
     * `{n}` days
     */
    'build.cost': 'Custo: {items}',
    'build.days.one': 'Leva 1 dia de obra',
    'build.days': 'Leva {n} dias de obra',
    'build.plot': 'Lote vazio',
    'build.option': '{name}: {items}',
    'build.chest': 'No baú: {items}.',
    'build.chestEmpty': 'O baú está vazio.',
    'build.missing': 'Ainda falta no baú: {items}.',
    'build.begin': 'Começar: {name}',
    'build.which': 'O que erguer aqui?',
    'build.notYet': 'Ainda não',
    'ending.default': 'Fim',
    /** the player's name (`player:` lines, `${player}`) where no character was made */
    'player.default': 'Viajante',
  },
  en: {
    'quest.start': 'New quest: {title}',
    'quest.stage': 'Quest updated: {title}',
    'quest.done': 'Quest complete: {title}',
    'quest.fail': 'Quest failed: {title}',
    'gold.received': 'Received {n} gold',
    'gold.given': 'Gave {n} gold',
    'item.received': 'Received: {item}',
    'item.receivedCount': 'Received: {item} ×{n}',
    'item.given': 'Handed over: {item}',
    'item.givenCount': 'Handed over: {item} ×{n}',
    'pack.full': 'The backpack is full. Go back to the camp and store it in the chest.',
    'pack.stored': 'Stored in the chest: {items}',
    'pack.none': 'Nothing worth keeping.',
    'pack.empty': 'Nothing in the backpack to store.',
    'build.cost': 'Cost: {items}',
    'build.days.one': 'Takes 1 day of work',
    'build.days': 'Takes {n} days of work',
    'build.plot': 'Empty plot',
    'build.option': '{name}: {items}',
    'build.chest': 'In the chest: {items}.',
    'build.chestEmpty': 'The chest is empty.',
    'build.missing': 'Still missing from the chest: {items}.',
    'build.begin': 'Begin: {name}',
    'build.which': 'What to raise here?',
    'build.notYet': 'Not yet',
    'ending.default': 'The End',
    'player.default': 'Traveller',
  },
};
export default table;
