/**
 * UI strings, namespace 'game' (docs/specs/I18N.md §2): the game's own lines (controls, toasts,
 * prompts, loading steps). Owner: G-game (docs/specs/PIXEL_UI.md §8). A core namespace: registered
 * by the UI root (strings/index.js), so `t('game.<key>')` works on every page with a UI — and by
 * src/main.js at the top of boot (the loading screen's steps and error page are in it).
 *
 * Keys are ids, not words; `pt` is the source, `en` its translation — each a table of key → string
 * (`{var}` slots) or function.
 *
 * - `controls.<id>`: the controls legend's rows (Game.js CONTROLS, JOURNAL_CONTROL, PARTY_CONTROL;
 *   the row's `id` is the key's last part).
 * - `prompt.<id>`: the interaction prompt's built-in verbs (Game.js `promptLabel`: an interactable's
 *   built-in label Talk / Examine / Knock / Read / Look / Enter / Rest / Open → its id,
 *   ContentKeys.js `BUILTIN_LABELS`) — also when an exit's or an event's data label is one of them.
 *   Any other data label is a content unit (`loc(textKeyOf(object, 'label'), label)`).
 * - `toast.*`: the game's toasts, whole sentences (the weather indoors is `toast.outside.<weather>`;
 *   the time of day toasts the clock's phase name, HUD.js `phaseName`).
 * - `default.*`: the code defaults that stand in for blank data (I18N.md §4.8: UI strings, never
 *   content): a villager without a name, a sign without a speaker, a waystone without a name, the
 *   chest's and the waystone's examine lines on a peaceful level, an interactable without text, the
 *   title screen's subtitle / prompt / credit, a villager's item for sale (`item`; its identity stays
 *   'Crisp Apple'). A name written into data — the catalog's Signpost, Villager and Waystone, the
 *   Untitled boot gives a level without a name, the Untitled campaign of a campaign without one —
 *   is data: a common term (`term()`).
 * - `load.*`: the loading screen's steps (src/main.js, Game.js, World.js).
 * - `page.title`, `error.*`: the browser tab's title and the loading screen's error page (src/main.js).
 *
 * Latin stays Latin (I18N.md §2): key names (WASD, Shift, P, Esc …) and the engine's name.
 */
/** @type {import('../I18n.js').StringTable} */
const table = {
  pt: {
    'controls.move': 'Andar',
    'controls.run': 'Correr',
    'controls.talk': 'Falar / Examinar',
    'controls.camera': 'Girar câmera',
    'controls.zoom': 'Zoom (ou rodinha)',
    'controls.map': 'Mapa-múndi',
    'controls.photo': 'Modo foto',
    'controls.music': 'Música',
    'controls.debug': 'Painel de depuração',
    'controls.journal': 'Diário',
    'controls.party': 'Grupo',

    'prompt.talk': 'Falar',
    'prompt.examine': 'Examinar',
    'prompt.knock': 'Bater',
    'prompt.read': 'Ler',
    'prompt.look': 'Olhar',
    'prompt.enter': 'Entrar',
    'prompt.rest': 'Descansar',
    'prompt.open': 'Abrir',
    'prompt.chop': 'Cortar',
    'prompt.store': 'Guardar',
    'prompt.break': 'Quebrar',
    'prompt.gather': 'Colher',
    'prompt.pickup': 'Pegar',

    'toast.noParty': 'Ninguém viaja com você.',
    /** a resource spent (Game.harvest): {item} the item's name, {n} how many */
    'toast.gathered': '+{n} {item}',
    /** a resource struck while foes are near */
    'toast.foesGather': 'Não dá para trabalhar com inimigos por perto',
    'toast.weather.clear': 'Céu limpo',
    'toast.weather.rain': 'Chuva',
    'toast.weather.snow': 'Neve',
    'toast.outside.clear': 'Céu limpo lá fora',
    'toast.outside.rain': 'Chuva lá fora',
    'toast.outside.snow': 'Neve lá fora',
    'toast.foes': 'Não com inimigos por perto',
    'toast.photo': 'Modo foto · {P} ou {Esc} para voltar',
    'toast.rested': 'Você se sente descansado.',
    'toast.musicOn': '♪ Música ligada',
    'toast.musicOff': 'Música desligada',

    'default.signpost': 'Placa',
    'default.villager': 'Morador',
    'default.waystone': 'Pedra-guia',
    'default.chest': 'O baú está bem trancado.',
    'default.waystoneText': 'Uma velha pedra-guia vibra baixinho.',
    'default.nothing': 'Nada digno de nota.',
    'default.subtitle': 'Uma fase do Luminati 2.5D',
    'default.prompt': 'Aperte qualquer tecla',
    'default.credit': 'Luminati, engine de pixel art 2.5D · three.js',
    'default.item': 'Maçã crocante',

    'load.map': 'Lendo o mapa',
    'load.textures': 'Pintando as texturas',
    'load.land': 'Erguendo o terreno',
    'load.village': 'Construindo a vila',
    'load.forest': 'Plantando a floresta',
    'load.water': 'Deixando a água correr',
    'load.meadow': 'Fazendo o campo crescer',
    'load.lights': 'Acendendo as lanternas',
    'load.merge': 'Juntando as malhas',
    'load.villagers': 'Acordando os moradores',
    'load.blades': 'Afiando as lâminas',
    'load.warmup': 'Aquecendo as lanternas',
    'load.ready': 'Pronto',

    'page.title': '{name} — Luminati, engine de pixel art 2.5D',
    'error.load': 'Não foi possível carregar {what}: {why}',
    'error.campaign': 'a campanha "{name}"',
    'error.level': 'a fase "{name}"',
    'error.default': 'a fase {name}',
    'error.json': 'a fase não é um JSON válido ({why})',
    'error.missing': '{file} não existe',
    'error.unknown': 'Algo deu errado — veja o console.',
    'error.play': 'Jogar {name}',
    'error.editor': 'Abrir o editor de fases',
  },
  en: {
    'controls.move': 'Move',
    'controls.run': 'Run',
    'controls.talk': 'Talk / Examine',
    'controls.camera': 'Rotate camera',
    'controls.zoom': 'Zoom (or wheel)',
    'controls.map': 'World map',
    'controls.photo': 'Photo mode',
    'controls.music': 'Music',
    'controls.debug': 'Debug panel',
    'controls.journal': 'Journal',
    'controls.party': 'Party',

    'prompt.talk': 'Talk',
    'prompt.examine': 'Examine',
    'prompt.knock': 'Knock',
    'prompt.read': 'Read',
    'prompt.look': 'Look',
    'prompt.enter': 'Enter',
    'prompt.rest': 'Rest',
    'prompt.open': 'Open',
    'prompt.chop': 'Chop',
    'prompt.store': 'Store',
    'prompt.break': 'Break',
    'prompt.gather': 'Gather',
    'prompt.pickup': 'Pick up',

    'toast.noParty': 'No one travels with you.',
    'toast.gathered': '+{n} {item}',
    'toast.foesGather': 'Not with foes nearby',
    'toast.weather.clear': 'Clear skies',
    'toast.weather.rain': 'Rain',
    'toast.weather.snow': 'Snowfall',
    'toast.outside.clear': 'Clear skies outside',
    'toast.outside.rain': 'Rain outside',
    'toast.outside.snow': 'Snowfall outside',
    'toast.foes': 'Not while foes are near',
    'toast.photo': 'Photo mode · {P} or {Esc} to return',
    'toast.rested': 'You feel well rested.',
    'toast.musicOn': '♪ Music on',
    'toast.musicOff': 'Music off',

    'default.signpost': 'Signpost',
    'default.villager': 'Villager',
    'default.waystone': 'Waystone',
    'default.chest': 'The chest is locked tight.',
    'default.waystoneText': 'An old waystone hums quietly.',
    'default.nothing': 'Nothing of note.',
    'default.subtitle': 'A Luminati 2.5D Level',
    'default.prompt': 'Press any key',
    'default.credit': 'Luminati 2.5D Pixel-Art Engine · three.js',
    'default.item': 'Crisp Apple',

    'load.map': 'Reading the map',
    'load.textures': 'Painting textures',
    'load.land': 'Raising the land',
    'load.village': 'Building the village',
    'load.forest': 'Planting the forest',
    'load.water': 'Letting the water run',
    'load.meadow': 'Growing the meadow',
    'load.lights': 'Lighting the lanterns',
    'load.merge': 'Merging meshes',
    'load.villagers': 'Waking the villagers',
    'load.blades': 'Sharpening blades',
    'load.warmup': 'Warming up the lanterns',
    'load.ready': 'Ready',

    'page.title': '{name} — Luminati 2.5D Pixel-Art Engine',
    'error.load': 'Could not load {what}: {why}',
    'error.campaign': 'campaign "{name}"',
    'error.level': 'level "{name}"',
    'error.default': 'the {name} level',
    'error.json': 'the level is not valid JSON ({why})',
    'error.missing': '{file} does not exist',
    'error.unknown': 'Something went wrong — see the console.',
    'error.play': 'Play {name}',
    'error.editor': 'Open the level editor',
  },
};
export default table;
