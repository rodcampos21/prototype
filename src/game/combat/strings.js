/**
 * UI strings, namespace 'combat' (docs/specs/I18N.md §2): the combat's own words — enemy names by
 * kind (defs.js keeps the English identities: the level generators import it), skill names by id,
 * the shop's wares by id (`shopWare` / `buy` / `priceOf` / the `purchase` event keep the English
 * names), the loot feed, level-ups, the results card, the death screen, waystones, the combat legend
 * rows (by the `id` of bindings.js) and the pad hint. Registered by `CombatSystem`'s constructor
 * before `ui.enableCombat()` (never at import: CombatSystem's chunk is the combat chunk), so a
 * peaceful level never holds it. Owner: B-combat (docs/specs/PIXEL_UI.md §8).
 *
 * Import-free and Node-safe: `tools/lib/i18n.mjs` (`uiGlossary`) imports it in Node. Keys are ids;
 * `pt` is the source, `en` its translation — each a table of key → string (`{var}` slots),
 * `{ one, other }` (counts, `tn`) or a function (English articles). The terms follow the glossary
 * (docs/specs/I18N_GLOSSARY.md).
 *
 * The wares' gains are templates filled from rules.js (`{n}`: SHOP_WARES' amount, DRAUGHT_HEAL in
 * per cent: `shopOffers`); an upgrade's toast is a sentence per language (`upgraded.*`, not
 * `obtained` round the loot feed's "HP máx. +20"). The floating 'Guard' / 'Perfect!' words are the
 * world labels' ('worldfx' namespace). A place (`{place}`: a waystone's name, `place.camp`,
 * `place.start`) stands after a colon or a dash in Portuguese, so no article or contraction is
 * needed.
 */

/**
 * A place with the English article: 'the camp' stays, 'Crossroads Waystone' → 'the Crossroads
 * Waystone' (the English templates only).
 * @param {unknown} place
 */
const the = (place) => {
  const s = String(place ?? '');
  return /^the /i.test(s) ? s : `the ${s}`;
};

/** @type {{ pt: Record<string, any>, en: Record<string, any> }} */
const table = {
  pt: {
    // enemies (ENEMY_DEFS by kind) and the boss's epithet; an elite of a kind without a name
    'enemy.slime': 'Gosma de Musgo',
    'enemy.goblin': 'Goblin dos Espinheiros',
    'enemy.archer': 'Arqueiro de Espinhos',
    'enemy.shaman': 'Xamã Amaldiçoador',
    'enemy.bat': 'Morcego de Brasa',
    'enemy.boar': 'Javali Couro-de-Ferro',
    'enemy.dummy': 'Boneco de Palha',
    'enemy.golem': 'Coração de Brasa',
    'epithet.golem': 'O Último Fogo do Desfiladeiro',
    elite: '{name} de Elite',
    // the Códex (codex.js): a page's stats, drops and description by kind
    'codex.locale': 'pt-BR',
    'codex.stat.hp': 'HP',
    'codex.stat.atk': 'Ataque',
    'codex.stat.def': 'Defesa',
    'codex.stat.poise': 'Postura',
    'codex.stat.speed': 'Velocidade',
    'codex.stat.xp': 'XP',
    'codex.stat.gold': 'Ouro',
    'codex.perLevel': '+{n} por nível',
    'codex.perLevelPct': '+{n} % por nível',
    'codex.pct': '{n} %',
    'codex.drop.heart': 'Coração',
    'codex.drop.mana': 'Fagulha de mana',
    'codex.drop.draught': 'Poção de Cura',
    'codex.text.slime': 'Uma bolha de gel verde-azulado com um tufo de musgo na cabeça. Vaga pela mata aos pulinhos e salta em cima de quem chega perto. Sozinha é frágil e lenta; o perigo é que quase nunca anda sozinha.',
    // skills (rules.js SKILLS by id) and the draught slot
    'skill.skill1': 'Golpe Giratório',
    'skill.skill2': 'Dardo de Brasa',
    'skill.skill3': 'Nova Radiante',
    'skill.draught': 'Poção de Cura',
    // the shop's wares (rules.js SHOP_WARES by id: shown, never looked up)
    'ware.draught.name': 'Poção de Cura',
    'ware.draught.gain': 'cura {n} %',
    'ware.whetstone.name': 'Pedra de Amolar',
    'ware.whetstone.gain': 'ATQ +{n}',
    'ware.tonic.name': 'Tônico de Casca-de-Ferro',
    'ware.tonic.gain': 'HP máx. +{n}',
    'ware.charm.name': 'Amuleto de Proteção',
    'ware.charm.gain': 'DEF +{n}',
    // the loot feed and the upgrade toast
    'loot.gold': '+{n} de ouro',
    'loot.heart': 'Coração +{n} HP',
    'loot.mana': 'Fagulha de mana +{n} MP',
    'loot.draught': 'Poção de Cura',
    'upgrade.maxHp': 'HP máx. +{n}',
    'upgrade.maxMp': 'MP máx. +{n}',
    'upgrade.attack': 'ATQ +{n}',
    'upgrade.core': 'Núcleo do Coração de Brasa',
    'upgrade.other': 'Melhoria',
    obtained: 'Obtido: {item}',
    // an upgrade's toast (a chest's, the core's)
    'upgraded.maxHp': 'Obtido: HP máx. +{n}',
    'upgraded.maxMp': 'Obtido: MP máx. +{n}',
    'upgraded.attack': 'Obtido: ATQ +{n}',
    'upgraded.core': 'Obtido: {item} · HP máx. +{n}',
    'draught.full': 'A vida já está cheia',
    // the level-up card
    'level.title': 'Nível {n}',
    'gain.maxHp': 'HP máx. +{n}',
    'gain.atk': 'ATQ +{n}',
    'gain.learned': '{skill} aprendido',
    // the boss: its banner, the victory, the results card
    'victory.title': 'Vitória',
    'victory.sub': 'Os fogos do desfiladeiro se calaram',
    'results.title': '{place} — Concluído',
    'results.foes': { one: '{n} inimigo', other: '{n} inimigos' },
    'results.falls': { one: '{n} queda', other: '{n} quedas' },
    'results.dodges': { one: '{n} esquiva perfeita', other: '{n} esquivas perfeitas' },
    'results.lv': 'Nv {n}',
    // the death screen and the respawn
    'death.title': 'Você Caiu',
    'death.prompt': 'Aperte qualquer tecla para se reerguer — {place}',
    'death.risen': 'Você se reergue — {place}',
    // the level's spawn as a checkpoint (Waystones.js: 'camp' near a waystone, else 'start')
    'place.camp': 'Acampamento',
    'place.start': 'Ponto de partida',
    // waystones
    'waystone.attuned': 'Em sintonia: {place}',
    'waystone.silent': 'A pedra se cala enquanto há inimigos por perto',
    'waystone.rested': 'Descansou — {place}',
    // the combat legend (bindings.js rows by id) and the one-time pad hint
    'controls.move': 'Andar',
    'controls.run': 'Correr',
    'controls.attack': 'Atacar (combo)',
    'controls.dodge': 'Rolar / esquivar',
    'controls.skills': 'Habilidades (ou 1-3)',
    'controls.skillsPad': 'Habilidades',
    'controls.draught': 'Poção de Cura',
    'controls.lock': 'Travar mira / próximo',
    'controls.interact': 'Falar / Descansar / Abrir',
    'controls.rotate': 'Girar câmera',
    'controls.zoom': 'Zoom (ou rodinha)',
    'controls.zoomPad': 'Zoom',
    'controls.map': 'Mapa-múndi',
    'controls.toggles': 'Foto / Música',
    'controls.photo': 'Foto',
    padHint: 'Controle: X ataca · B rola · LT+X/Y/B habilidades · Y poção · RS trava mira · analógico direito zoom · clique no LS foto',
  },
  en: {
    'enemy.slime': 'Moss Slime',
    'enemy.goblin': 'Bramble Goblin',
    'enemy.archer': 'Thorn Archer',
    'enemy.shaman': 'Hex Shaman',
    'enemy.bat': 'Cinder Bat',
    'enemy.boar': 'Ironhide Boar',
    'enemy.dummy': 'Straw Dummy',
    'enemy.golem': 'Cinderheart',
    'epithet.golem': 'The Last Fire of the Pass',
    elite: 'Elite {name}',
    'codex.locale': 'en-US',
    'codex.stat.hp': 'HP',
    'codex.stat.atk': 'Attack',
    'codex.stat.def': 'Defense',
    'codex.stat.poise': 'Poise',
    'codex.stat.speed': 'Speed',
    'codex.stat.xp': 'XP',
    'codex.stat.gold': 'Gold',
    'codex.perLevel': '+{n} per level',
    'codex.perLevelPct': '+{n}% per level',
    'codex.pct': '{n}%',
    'codex.drop.heart': 'Heart',
    'codex.drop.mana': 'Mana mote',
    'codex.drop.draught': 'Healing Draught',
    'codex.text.slime': 'A blob of teal gel with a tuft of moss on top. It roams the woods in little hops and leaps on whoever comes close. Alone it is frail and slow; the trouble is that it is hardly ever alone.',
    'skill.skill1': 'Whirl Slash',
    'skill.skill2': 'Ember Bolt',
    'skill.skill3': 'Radiant Nova',
    'skill.draught': 'Healing Draught',
    'ware.draught.name': 'Healing Draught',
    'ware.draught.gain': 'heals {n} %',
    'ware.whetstone.name': 'Whetstone',
    'ware.whetstone.gain': 'ATK +{n}',
    'ware.tonic.name': 'Ironbark Tonic',
    'ware.tonic.gain': 'Max HP +{n}',
    'ware.charm.name': 'Warding Charm',
    'ware.charm.gain': 'DEF +{n}',
    'loot.gold': '+{n} gold',
    'loot.heart': 'Heart +{n} HP',
    'loot.mana': 'Mana mote +{n} MP',
    'loot.draught': 'Healing Draught',
    'upgrade.maxHp': 'Max HP +{n}',
    'upgrade.maxMp': 'Max MP +{n}',
    'upgrade.attack': 'ATK +{n}',
    'upgrade.core': 'Cinderheart Core',
    'upgrade.other': 'Upgrade',
    obtained: 'Obtained: {item}',
    'upgraded.maxHp': 'Obtained: Max HP +{n}',
    'upgraded.maxMp': 'Obtained: Max MP +{n}',
    'upgraded.attack': 'Obtained: ATK +{n}',
    'upgraded.core': 'Obtained: {item} · Max HP +{n}',
    'draught.full': 'Already at full health',
    'level.title': 'Level {n}',
    'gain.maxHp': 'Max HP +{n}',
    'gain.atk': 'ATK +{n}',
    'gain.learned': '{skill} learned',
    'victory.title': 'Victory',
    'victory.sub': 'The fires of the pass are quiet',
    'results.title': '{place} — Cleared',
    'results.foes': { one: '{n} foe', other: '{n} foes' },
    'results.falls': { one: '{n} fall', other: '{n} falls' },
    'results.dodges': { one: '{n} perfect dodge', other: '{n} perfect dodges' },
    'results.lv': 'Lv {n}',
    'death.title': 'You Have Fallen',
    'death.prompt': (v) => `Press any key to rise at ${the(v.place)}`,
    'death.risen': (v) => `You rise at ${the(v.place)}`,
    'place.camp': 'the camp',
    'place.start': 'the start',
    'waystone.attuned': '{place} attuned',
    'waystone.silent': 'The stone is silent while foes are near',
    'waystone.rested': (v) => `Rested at ${the(v.place)}`,
    'controls.move': 'Move',
    'controls.run': 'Run',
    'controls.attack': 'Attack (combo)',
    'controls.dodge': 'Dodge roll',
    'controls.skills': 'Skills (or 1-3)',
    'controls.skillsPad': 'Skills',
    'controls.draught': 'Healing Draught',
    'controls.lock': 'Lock on / next',
    'controls.interact': 'Talk / Rest / Open',
    'controls.rotate': 'Rotate camera',
    'controls.zoom': 'Zoom (or wheel)',
    'controls.zoomPad': 'Zoom',
    'controls.map': 'World map',
    'controls.toggles': 'Photo / Music',
    'controls.photo': 'Photo',
    padHint: 'Pad: X attack · B roll · LT+X/Y/B skills · Y draught · RS lock · right stick zoom · LS click photo',
  },
};

export default table;
