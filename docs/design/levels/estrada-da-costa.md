# Estrada da Costa — Terra Selvagem (`estrada-da-costa`)

The design note of **Estrada da Costa**, the first lore test of the *Culto ao Baiacu Rei* game, the first level of the game's campaign
(`public/campaigns/culto-ao-baiacu-rei/levels/estrada-da-costa.json`): the prologue rescue of the Ato I notebook (quest QP01, scene
C01). A dirt road runs north along the coast; on a clearing beside it Surubin, a young catfish-folk
adept of the cult, is cornered by forest creatures. The player — the wandering knight — clears them,
Surubin thanks the Baiacu Rei first and the knight second, and joins the party. Its texts are
Brazilian Portuguese, written as the level's source text.

| | |
| --- | --- |
| **Audience** | The game's authors; anyone extending the Ato I prologue. |
| **Source of truth** | [`tools/make-estrada-da-costa.mjs`](../../../tools/make-estrada-da-costa.mjs) (the generator), [`public/campaigns/culto-ao-baiacu-rei/`](../../../public/campaigns/culto-ao-baiacu-rei/campaign.json) (its output: `campaign.json` and `levels/estrada-da-costa.json`) |
| **Related docs** | [Story script](../../specs/STORY_SCRIPT.md) · [Party](../../specs/PARTY.md) · [Combat](../../contracts/COMBAT.md) · [Pixel module](../../architecture/modules/pixel.md) (the `head: 'catfish'` spec) · [Willowmere](sample-hamlet.md) (the generator it follows) |

Play it: `game.html` (the game: title, character creation, this level), or `game.html?campaign=culto-ao-baiacu-rei&level=estrada-da-costa` to start in it. Regenerate it: `node tools/make-estrada-da-costa.mjs`
(`--check` compares without writing).

---

## Layout

| Fact | Value |
| --- | --- |
| Size | 40 × 30 tiles, small-level build path |
| Time | 16:24, clock running (golden hour falls during the scene) |
| Weather | rain (`environment.weather`, and `weather rain` at the arrival, held until C02 lets it go): C01 happens in a storm; no key changes the weather or the time. On a later visit the road rolls its weather at each turn of the day (`weatherPool`: clear 55, rain 45) |
| West | the sea (still water, level 0), a sand beach (level 1) with the wreckage of Surubin's boat (crates, a barrel), rocks and a chest (12 gold, 2 Healing Draughts) |
| Middle | dune grass with pines, the coast road (two tiles wide, bending toward the sea) from the player start in the south to the map edge in the north |
| East | the clearing (trampled dirt in flower grass) where Surubin waits, then a wooded rise (level 3) |
| Kept clear | the road, the clearing and the strip south of it, so the north-looking camera always sees the rescue |

## Story

| Event | Trigger | What happens |
| --- | --- | --- |
| `event_1` | arrive, once | cutscene: banner, a cry for help, the camera shows Surubin among the creatures; quest `resgate` starts |
| `event_2` | enter the clearing area, once, background | Surubin barks for help |
| `event_3` | group `criaturas` cleared, once | scene C01: the knight beside Surubin, his thanks (the Rei first), his introduction, the knight's answer (a choice: ironic, dry or curious; each a `player:` line with his name, `${player}`, and Surubin's reply), "Precisamos sair dessa chuva", the knight's "Até a chuva passar", `party join surubin as mystic support` |
| `event_4` | enter the north road before the rescue | the narrator turns the player back |
| `event_5` | enter the north road after the rescue, once | Surubin points at the clearing up the stream, a fire to wait out the storm; quest done; `travel clareira-do-riacho` (C02) |

Surubin's talk script cycles four lines while he is in the party. The knight is a silent
protagonist (an open question of the Ato I notebook); the player still wears the engine's
`traveler` look, which `Player.js` fixes for every level.

## The next level: Clareira do Riacho (C02, then the camp)

`levels/clareira-do-riacho.json` (34 × 28, built by the same generator): a wide clearing in the woods
with a stream down its east side (the far bank is forest) — the camp of Act I. Its weather pool is
clear 70, rain 30. The old trail from the south is scenery: the camp has no exit, travel will be by
Surubin's map (the mechanics plan, G1).

**The first night (C02).** On arriving with Surubin in the party (`arrive`, `if: party:surubin`)
the story holds a clear sky (`weather clear`), moves the clock on to 21:00, seats the two at the
fire (markers `fogo-cavaleiro` and `fogo-surubin`, after a short wait: the party takes its places
after the arrival) and plays C02 of the Ato I notebook: the colony, the knight's disdain, the map
and the strokes carved in stones. The knight's answer is a choice of three, each remembered by a
flag for Act II (`c02.estacao`, `c02.lar`, `c02.jantar`) with Surubin's reply, then "Que as marés
nos guiem.".

**The morning of day 2.** The screen fades out, the clock moves on to 7:30 (day 2) and the flag
`acampamento` is set: the camp props come (`when: acampamento`). Surubin leaves the party
(`party leave surubin`): from now on he is the camp's villager (id `surubin`, the same as on the
coast road; `when: acampamento`, `unless: party:surubin`), wandering between his tent and the map
table, with a talk script of his own (four lines in turn). The campaign has no tactics panel
(`party: { menu: false }`): Surubin only travels with the knight from the rescue to the camp. A
companion who stays in the camp later is placed the same way — a villager of the camp's level with
the same id —, so parting never makes anyone vanish. The two stand by the banner
(markers `manha-cavaleiro`, `manha-surubin`); Surubin shows the banner, the three plots and his
first sketch of the map (the camera on `estandarte`, `lote-forja`, `mesa-do-mapa`), names the
forest, the reeds and the quarry the sailors spoke of, and promises the knight the strokes carved
in stones. QP03 *Os alicerces* starts (stage `coletar`). The sky stays clear until 11:00 (a `time`
event lets the pool roll again then).

**The camp's layout** (the notebook, "O acampamento, o mapa e as obras"):

| Area | What | Ids / names |
| --- | --- | --- |
| Middle | the fire with two logs, a crate | — |
| North | Surubin's tent (`worn`), the map table (examined: the map's text), his crate and barrel | `tenda-surubin`, `mesa-do-mapa` |
| East | the banner (`pole`); the altar's place beside it (C03) | `estandarte`, marker `altar` |
| West and south | three roped plots on bare ground: forge 4 × 3.5, silo 3.5 × 3.5, lodging 5 × 3.5 | `lote-forja`, `lote-silo`, `lote-alojamento` |
| North-east | the chapel's place (QP05, phase 4), left clear | marker `capela` |

The generator fails unless the campaign places every `camp: true` type (Starfall Vale skips them).
