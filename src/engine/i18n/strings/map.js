/**
 * UI strings, namespace 'map' (docs/specs/I18N.md §2): the minimap and the world map. Owner: B-map
 * (docs/specs/PIXEL_UI.md §8). A core namespace: registered by the UI root (strings/index.js), so
 * `t('map.<key>')` works on every page with a UI.
 *
 * Keys are ids, not words; `pt` is the source, `en` its translation — each a table of key → string
 * (`{var}` slots) or function. The compass letter stays Latin in every language (I18N.md §2: key
 * names and abbreviations), as does each keycap; the legend's words follow the glossary
 * (docs/specs/I18N_GLOSSARY.md §6). Region names, the map's title and subtitle arrive translated from
 * the game (PIXEL_UI.md §8.1); the world map only sets them (in capitals).
 */
/** @type {import('../I18n.js').StringTable} */
const table = {
  pt: {
    /** the minimap's compass letter (Latin in every language) */
    north: 'N',
    /** the world map's small tracked label, before the map's title */
    title: 'Mapa-múndi',
    /** the legend's section heading */
    legend: 'Legenda',
    'legend.you': 'Você',
    'legend.villager': 'Morador',
    'legend.companion': 'Companheiro',
    /** one row for the three small gems (signs, doors and wells): a list, the language's own separator */
    'legend.poi': 'Placa · porta · poço',
    'legend.campfire': 'Fogueira',
    'legend.enemy': 'Inimigo',
    'legend.waystone': 'Pedra-guia',
    'legend.chest': 'Baú',
    /** a tree to chop, a stone to break, herbs to pick (a green, a grey and a pink dot) */
    'legend.resource': 'Recurso para coletar',
    /** the return mast of an expedition: where the way home starts */
    'legend.return': 'Caminho de volta',
    'legend.building': 'Construção',
    'legend.road': 'Estrada',
    'legend.water': 'Água',
    'legend.forest': 'Floresta',
    /** the section heading over the region the player stands in (the region's name under it) */
    here: 'Você está em',
    /** the key hint's label after N, Tab and Esc */
    close: 'Fechar',
    /** the world map window's accessible name */
    aria: 'Mapa-múndi',
  },
  en: {
    north: 'N',
    title: 'World Map',
    legend: 'Legend',
    'legend.you': 'You',
    'legend.villager': 'Villager',
    'legend.companion': 'Companion',
    'legend.poi': 'Sign · door · well',
    'legend.campfire': 'Campfire',
    'legend.enemy': 'Enemy',
    'legend.waystone': 'Waystone',
    'legend.chest': 'Chest',
    'legend.resource': 'Resource to gather',
    'legend.return': 'Way back',
    'legend.building': 'Building',
    'legend.road': 'Road',
    'legend.water': 'Water',
    'legend.forest': 'Forest',
    here: 'You are in',
    close: 'Close',
    aria: 'World map',
  },
};
export default table;
