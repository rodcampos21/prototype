/**
 * UI strings, namespace 'inventory' (docs/specs/I18N.md §2): the journal's Backpack and Equipment
 * tabs (InventoryPanel.js; their tab names are 'story-ui' `tab.pack` / `tab.gear`) and the resource
 * bar (docs/specs/PIXEL_UI.md §5, *Inventory*). A feature namespace: registered by the two
 * components, which travel in the story chunk, so a page without a story never loads it.
 * Import-free: the i18n checker reads it in Node.
 *
 * Keys are ids; `pt` is the source, `en` its translation. Terms (I18N_GLOSSARY.md): the backpack is
 * Mochila, the camp's stock Estoque, the equipment Equipamento; `{n}` a count.
 */
/** @type {import('../I18n.js').StringTable} */
const table = {
  pt: {
    pack: 'Mochila',
    stock: 'Estoque',
    /** an item's lines under its name: what is carried, what the stock holds */
    carried: 'Na mochila: {n}',
    stocked: 'No estoque: {n}',
    keyItem: 'Item-chave',
    /** the stock's place on the Backpack tab while away from the camp */
    stockAway: 'O estoque fica no acampamento.',
    empty: 'A mochila está vazia.',
    emptyHint: 'O que você coleta nas expedições vem para cá.',
    // the Equipment tab
    'slot.weapon': 'Arma',
    'slot.body': 'Armadura',
    'slot.head': 'Cabeça',
    'slot.hands': 'Mãos',
    'slot.feet': 'Pés',
    'slot.accessory': 'Acessório',
    'slot.empty': 'Vazio',
    stats: 'Atributos',
    'stat.level': 'Nível',
    'stat.hp': 'HP',
    'stat.mp': 'MP',
    'stat.atk': 'ATQ',
    'stat.def': 'DEF',
    /** an equipment item's bonus line ("+2 ATQ") */
    bonus: '+{n} {stat}',
    /** under the equipment: equipping comes later (CAMPAIGN_FORMAT.md §4.2) */
    gearSoon: 'Trocar de equipamento virá depois.',
    // the resource bar's accessible name
    bar: 'Recursos',
  },
  en: {
    pack: 'Backpack',
    stock: 'Stock',
    carried: 'In the backpack: {n}',
    stocked: 'In the stock: {n}',
    keyItem: 'Key item',
    stockAway: 'The stock stays at the camp.',
    empty: 'The backpack is empty.',
    emptyHint: 'What you gather on expeditions comes here.',
    'slot.weapon': 'Weapon',
    'slot.body': 'Armour',
    'slot.head': 'Head',
    'slot.hands': 'Hands',
    'slot.feet': 'Feet',
    'slot.accessory': 'Accessory',
    'slot.empty': 'Empty',
    stats: 'Attributes',
    'stat.level': 'Level',
    'stat.hp': 'HP',
    'stat.mp': 'MP',
    'stat.atk': 'ATK',
    'stat.def': 'DEF',
    bonus: '+{n} {stat}',
    gearSoon: 'Changing equipment comes later.',
    bar: 'Resources',
  },
};
export default table;
