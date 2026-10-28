/**
 * UI strings, namespace 'party' (docs/specs/I18N.md §2, docs/specs/PIXEL_UI.md §8): the tactics
 * panel's chrome, the party frames, the rule vocabulary of src/engine/level/PartyRules.js by id
 * (fields, values, presets, classes, roles, weapons), the built-in party conversation and the rule
 * toast. Owner: B-party. Registered by the feature when it starts — the `Party` constructor and
 * `partyUIClasses()` (`registerPartyStrings`), never at import — so a game nobody joins never loads
 * it.
 *
 * Node-safe (the i18n checker imports it): it imports only the import-free I18n.js and
 * PartyRules.js. PartyRules.js keeps the English identities and is the English table here
 * (`rule.<field>.label` … are made from it), so the English vocabulary has one source; `pt` (the
 * source language of the UI) writes the same ids in Portuguese.
 *
 * Keys are ids, not words: `panel.*`, `frame.*`, `toast.*`, `talk.*`, `rule.<field>.{label,help}`,
 * `rule.<field>.<value>.{label,hint}`, `preset.<id>.{label,help}`, `class.<id>.{label,help}`,
 * `role.<id>`, `weapon.<id>`.
 */
import { registerStrings, hasStrings, t } from '../../engine/i18n/I18n.js';
import { RULE_FIELDS, PARTY_PRESETS, PARTY_CLASSES } from '../../engine/level/PartyRules.js';

/** @typedef {import('../../engine/i18n/I18n.js').StringEntry} StringEntry */

/** The rule vocabulary's English, by id, from PartyRules.js (its one English source). */
function rulesEnglish() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, f] of Object.entries(RULE_FIELDS)) {
    out[`rule.${k}.label`] = f.label;
    out[`rule.${k}.help`] = f.help;
    for (const v of f.values) {
      out[`rule.${k}.${v}.label`] = f.labels[v];
      out[`rule.${k}.${v}.hint`] = f.hints[v];
    }
  }
  for (const [k, p] of Object.entries(PARTY_PRESETS)) {
    out[`preset.${k}.label`] = p.label;
    out[`preset.${k}.help`] = p.help;
  }
  for (const [k, c] of Object.entries(PARTY_CLASSES)) {
    out[`class.${k}.label`] = c.label;
    out[`class.${k}.help`] = c.help;
  }
  return out;
}

/** @type {import('../../engine/i18n/I18n.js').StringTable} */
const table = {
  pt: {
    // the tactics panel
    'panel.party': 'Grupo',
    'panel.tactics': 'Táticas',
    'panel.presets': 'Estilos',
    'panel.rules': 'Regras',
    'panel.custom': 'Personalizado',
    'panel.empty': 'Vazio',
    'panel.count': '{n} / {max}',
    'panel.presetsHelp': 'Escolha um para definir todas as regras de uma vez. Mudar uma regra abaixo torna a tática Personalizada.',
    'panel.choose': 'Escolher',
    'panel.change': 'Mudar',
    'panel.pick': 'Confirmar',
    'panel.member': 'Membro',
    'panel.close': 'Fechar',
    'panel.aria': 'Táticas do grupo',
    'panel.members': 'Membros',
    'panel.prev': '{field}: anterior',
    'panel.next': '{field}: próximo',
    'panel.of': '{i} de {n}',
    // the party frames (HUD)
    'frame.lv': 'Nv',
    'frame.down': 'Caído',
    // a rule the story set (the player's own changes make none)
    'toast.rule': '{name}: {preset}',
    // the built-in party conversation (a member's talk without a script, PARTY.md §4.3)
    'talk.line0': 'Estou logo atrás de você. Algo em mente?',
    'talk.line1': 'Vá na frente — eu acompanho.',
    'talk.line2': 'Precisa de algo? Estou ouvindo.',
    'talk.line3': 'A estrada tem sido gentil até aqui. O que foi?',
    'talk.tactics': 'Táticas…',
    'talk.part': 'Separar-se',
    'talk.carryOn': 'Seguir em frente',
    'talk.stayQ': 'Você quer que eu fique para trás?',
    'talk.stay': 'Não — fique comigo',
    'talk.leave': 'Sim, vamos nos separar',
    'talk.bye': 'Então é aqui que eu fico. Boa viagem — você sabe onde me encontrar.',
    'talk.glad': 'Ótimo. Eu ainda não estava pronto para voltar.',
    // the classes' roles and weapons (PARTY_CLASSES role / weapon ids)
    'role.melee': 'Corpo a corpo',
    'role.ranged': 'À distância',
    'role.caster': 'Conjurador',
    'weapon.spear': 'Lança',
    'weapon.bow': 'Arco',
    'weapon.staff': 'Cajado',
    // the rule vocabulary (PartyRules.js ids)
    'rule.target.label': 'Alvo',
    'rule.target.help': 'Qual inimigo atacar.',
    'rule.target.leader.label': 'O seu alvo',
    'rule.target.leader.hint': 'O alvo que você travou; sem ele, o inimigo mais perto de você.',
    'rule.target.nearest.label': 'Mais perto',
    'rule.target.nearest.hint': 'O inimigo mais perto deste membro.',
    'rule.target.weakest.label': 'Mais fraco',
    'rule.target.weakest.hint': 'O inimigo com menos HP: acaba com ele.',
    'rule.target.strongest.label': 'Mais forte',
    'rule.target.strongest.hint': 'Elites e chefes primeiro, depois o inimigo mais resistente.',
    'rule.target.ranged.label': 'Arqueiros e magos',
    'rule.target.ranged.hint': 'Arqueiros e xamãs primeiro, depois o mais perto.',
    'rule.distance.label': 'Distância',
    'rule.distance.help': 'O quanto se afasta de você numa luta.',
    'rule.distance.close.label': 'Perto',
    'rule.distance.close.hint': 'Não sai do seu lado.',
    'rule.distance.mid.label': 'Média',
    'rule.distance.mid.hint': 'Luta a poucos passos de você.',
    'rule.distance.far.label': 'Longe',
    'rule.distance.far.hint': 'Persegue livremente inimigos distantes.',
    'rule.attack.label': 'Ataque',
    'rule.attack.help': 'Quando atacar.',
    'rule.attack.free.label': 'Livre',
    'rule.attack.free.hint': 'Qualquer inimigo ao alcance.',
    'rule.attack.assist.label': 'Só ajudar',
    'rule.attack.assist.hint': 'Só inimigos que lutam com você ou com o grupo.',
    'rule.attack.never.label': 'Nunca',
    'rule.attack.never.hint': 'Não ataca.',
    'rule.skills.label': 'Habilidades',
    'rule.skills.help': 'Como usa as habilidades de combate (curas à parte).',
    'rule.skills.free.label': 'À vontade',
    'rule.skills.free.hint': 'Assim que estiverem prontas.',
    'rule.skills.save.label': 'Poupar MP',
    'rule.skills.save.hint': 'Só com MP sobrando para uma cura.',
    'rule.skills.never.label': 'Nunca',
    'rule.skills.never.hint': 'Só ataques básicos.',
    'rule.heal.label': 'Cura',
    'rule.heal.help': 'Quando curar você ou o grupo.',
    'rule.heal.never.label': 'Nunca',
    'rule.heal.never.hint': 'Guarda o MP para a luta.',
    'rule.heal.low.label': 'No sufoco',
    'rule.heal.low.hint': 'Quando alguém está quase caindo.',
    'rule.heal.half.label': 'Abaixo da metade',
    'rule.heal.half.hint': 'Quando alguém fica com menos da metade do HP.',
    'rule.heal.often.label': 'Sempre que puder',
    'rule.heal.often.hint': 'Ao menor ferimento.',
    'rule.evade.label': 'Esquiva',
    'rule.evade.help': 'Rolar para fora dos ataques marcados dos inimigos.',
    'rule.evade.on.label': 'Esquivar',
    'rule.evade.on.hint': 'Rola para fora de ataques marcados.',
    'rule.evade.off.label': 'Aguentar firme',
    'rule.evade.off.hint': 'Fica onde está e recebe o golpe.',
    'rule.retreat.label': 'Recuar',
    'rule.retreat.help': 'Voltar para perto de você quando ferido.',
    'rule.retreat.never.label': 'Nunca',
    'rule.retreat.never.hint': 'Luta até o fim.',
    'rule.retreat.low.label': 'No sufoco',
    'rule.retreat.low.hint': 'Quase caindo, recua para trás de você.',
    'rule.retreat.half.label': 'Abaixo da metade',
    'rule.retreat.half.hint': 'Com menos da metade do HP, recua para trás de você.',
    'preset.balanced.label': 'Equilibrado',
    'preset.balanced.help': 'Luta a média distância, cura quando alguém está mal, esquiva de ataques marcados.',
    'preset.aggressive.label': 'Ataque total',
    'preset.aggressive.help': 'Avança no inimigo mais perto, gasta todas as habilidades, nunca cura nem recua.',
    'preset.guardian.label': 'Me proteja',
    'preset.guardian.help': 'Fica ao seu lado e golpeia o que vier na sua direção.',
    'preset.support.label': 'Suporte',
    'preset.support.help': 'Mantém você de pé: cura sempre, só luta com quem revida.',
    'preset.hunter.label': 'Caçar magos',
    'preset.hunter.help': 'Vai longe para derrubar arqueiros e xamãs primeiro.',
    'preset.passive.label': 'Ficar atrás',
    'preset.passive.help': 'Não luta: fica perto, esquiva e cura.',
    'class.warden.label': 'Guardião',
    'class.warden.help': 'Estocadas de lança de perto, um golpe em arco e Remendo para curar.',
    'class.ranger.label': 'Patrulheiro',
    'class.ranger.help': 'Flechas à distância, uma rajada e Remendo para curar.',
    'class.mystic.label': 'Místico',
    'class.mystic.help': 'Dardos de brasa, um clarão que explode nos inimigos e um Remendo mais forte.',
  },
  en: {
    // the tactics panel
    'panel.party': 'Party',
    'panel.tactics': 'Tactics',
    'panel.presets': 'Presets',
    'panel.rules': 'Rules',
    'panel.custom': 'Custom',
    'panel.empty': 'Empty',
    'panel.count': '{n} / {max}',
    'panel.presetsHelp': 'Pick one to set every rule at once. Changing a rule below makes the tactic Custom.',
    'panel.choose': 'Choose',
    'panel.change': 'Change',
    'panel.pick': 'Pick',
    'panel.member': 'Member',
    'panel.close': 'Close',
    'panel.aria': 'Party tactics',
    'panel.members': 'Members',
    'panel.prev': 'Previous {field}',
    'panel.next': 'Next {field}',
    'panel.of': '{i} of {n}',
    // the party frames (HUD)
    'frame.lv': 'Lv',
    'frame.down': 'Down',
    // a rule the story set (the player's own changes make none)
    'toast.rule': '{name}: {preset}',
    // the built-in party conversation (a member's talk without a script, PARTY.md §4.3)
    'talk.line0': 'Right behind you. Something on your mind?',
    'talk.line1': 'Lead on — I will keep pace.',
    'talk.line2': 'Need something? I am listening.',
    'talk.line3': 'The road has been kind so far. What is it?',
    'talk.tactics': 'Tactics…',
    'talk.part': 'Part ways',
    'talk.carryOn': 'Carry on',
    'talk.stayQ': 'You want me to stay behind?',
    'talk.stay': 'No — stay with me',
    'talk.leave': 'Yes, part ways',
    'talk.bye': 'Then this is where I leave you. Safe travels — you know where to find me.',
    'talk.glad': 'Good. I was not ready to turn back yet.',
    // the classes' roles and weapons (PARTY_CLASSES role / weapon ids)
    'role.melee': 'Melee',
    'role.ranged': 'Ranged',
    'role.caster': 'Caster',
    'weapon.spear': 'Spear',
    'weapon.bow': 'Bow',
    'weapon.staff': 'Staff',
    ...rulesEnglish(),
  },
};
export default table;

/**
 * Register the 'party' namespace (idempotent: a namespace already there is left as it is). The
 * `Party` constructor and `partyUIClasses()` call it, so the panel and the frames have their
 * strings wherever the party UI is made.
 * @param {{ force?: boolean }} [o] force: register it again (tests)
 */
export function registerPartyStrings({ force = false } = {}) {
  if (force || !hasStrings('party')) registerStrings('party', table);
}

/**
 * `t('party.<key>')`, else `fallback` when the key has no entry in any language (a name a level or
 * a save brings that the tables do not know).
 * @param {string} key without the 'party.' prefix
 * @param {string} fallback
 * @param {Record<string, any>} [vars]
 */
export function pt(key, fallback, vars) {
  const full = `party.${key}`;
  const s = t(full, vars);
  return s === full ? fallback : s;
}

/** A class's label in the page's language (by PARTY_CLASSES id; the id itself for an unknown one). @param {string} id */
export const classLabel = (id) => pt(`class.${id}.label`, Object.hasOwn(PARTY_CLASSES, id) ? PARTY_CLASSES[id].label : id);
/** A class's help line in the page's language. @param {string} id */
export const classHelp = (id) => pt(`class.${id}.help`, Object.hasOwn(PARTY_CLASSES, id) ? PARTY_CLASSES[id].help : '');
/** A role's word (melee / ranged / caster). @param {string} id */
export const roleLabel = (id) => pt(`role.${id}`, id);
/** A weapon's word (spear / bow / staff). @param {string} id */
export const weaponLabel = (id) => pt(`weapon.${id}`, id);
/** A preset's label in the page's language; 'custom' is the panel's Custom. @param {string} id */
export const presetLabel = (id) => (id === 'custom' ? pt('panel.custom', 'Custom') : pt(`preset.${id}.label`, Object.hasOwn(PARTY_PRESETS, id) ? PARTY_PRESETS[id].label : id));

/**
 * RULE_FIELDS in the page's language (the same shape and ids, labels, help and hints translated):
 * what the tactics panel shows. English: the same text as RULE_FIELDS; Portuguese: the `pt` table.
 * @returns {Record<string, { label: string, help: string, values: string[], labels: Record<string, string>, hints: Record<string, string> }>}
 */
export function localFields() {
  /** @type {Record<string, { label: string, help: string, values: string[], labels: Record<string, string>, hints: Record<string, string> }>} */
  const out = {};
  for (const [k, f] of Object.entries(RULE_FIELDS)) {
    /** @type {Record<string, string>} */
    const labels = {};
    /** @type {Record<string, string>} */
    const hints = {};
    for (const v of f.values) {
      labels[v] = pt(`rule.${k}.${v}.label`, f.labels[v]);
      hints[v] = pt(`rule.${k}.${v}.hint`, f.hints[v]);
    }
    out[k] = { label: pt(`rule.${k}.label`, f.label), help: pt(`rule.${k}.help`, f.help), values: [...f.values], labels, hints };
  }
  return out;
}

/**
 * PARTY_PRESETS in the page's language (ids and rules untouched).
 * @returns {Record<string, { label: string, help: string, rule: import('../../engine/level/PartyRules.js').PartyRule }>}
 */
export function localPresets() {
  /** @type {Record<string, { label: string, help: string, rule: import('../../engine/level/PartyRules.js').PartyRule }>} */
  const out = {};
  for (const [k, p] of Object.entries(PARTY_PRESETS)) out[k] = { label: presetLabel(k), help: pt(`preset.${k}.help`, p.help), rule: { ...p.rule } };
  return out;
}
