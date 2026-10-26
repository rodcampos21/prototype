# Luminati → Godot 4 port

> **Purpose.** How the Godot version of Luminati (`godot/`) is built, how to run and re-bake it,
> how every part of the three.js engine maps to it, and the phased plan for porting the rest.
>
> **Status.** Phase 1 (the explorable diorama) is done; phases 2–8 are planned below.
> Branch: `godot-port`. Target: **Godot 4.7** (Forward+; the Compatibility renderer also runs it).

---

## 1. The approach in one paragraph

Luminati generates almost all of its content procedurally in JavaScript — 3 000 lines of pixel
textures, 3 800 lines of character sheets, 2 000 lines of terrain geometry (cliffs, stair flights,
grass fringes, baked ambient occlusion), the props, trees and ground foliage. Rewriting those
generators in GDScript first would take months before anything appeared on screen and would drift
from the original look. So the port splits the engine in two:

| | Where it lives | How it gets to Godot |
| --- | --- | --- |
| **Content generators** (textures, sprite sheets, terrain, props, trees, foliage, water geometry) | the JavaScript engine, unchanged | **baked**: `tools/godot-bake` boots the real game in a headless browser, lets it build a level, and writes what it built (meshes, materials, PNGs, gameplay data) into `godot/` |
| **Everything that runs** (shaders, lighting, day / night, camera, movement and collisions, villagers, conversations, HUD, input) | **GDScript and Godot shaders** in `godot/` | ported by hand, module by module, against the JavaScript source and its specs |

The bake is an asset pipeline, like exporting from Blender: re-run it when a level or a generator
changes. Phase 7 of the plan moves the generators themselves into Godot (an editor importer for
the level JSON), at which point the browser step goes away.

## 2. Running it

1. Open Godot 4.7 → *Import* → `godot/project.godot` → *Edit*. The first open imports the baked
   textures (a few seconds).
2. Press **F5**. Emberfall loads.

| Key | Action |
| --- | --- |
| W A S D / arrows, Shift | move, run |
| Space / Enter / F | talk, read signs, knock on doors; advance the dialog; ↑ ↓ pick a choice |
| Q / E, Z / X or wheel | turn, zoom |
| T / R | next time of day / next weather look |
| P | photo mode (HUD off) |
| Page Up / Page Down | previous / next baked level |

Command line (after `--`): `--level=<id>`, `--time=<hours>`, `--shot=<file.png> --frames=<n>`
(render and save a screenshot, then quit), `--talk=<npc id>`, `--yaw=<deg>`, `--distance=<u>`,
`--noshadow=1`, `--debug=<1 albedo | 2 vertex colour | 3 normal | 4 ambient | 5 no normal maps>`.

## 3. Re-baking levels

```bash
npm install                                   # three.js (and puppeteer-core) for the bake
CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" node tools/godot-bake/bake.mjs
node tools/godot-bake/bake.mjs emberfall      # just one level
```

The bake starts its own small static server (`tools/godot-bake/server.mjs`, no Vite needed), opens
`game.html?autostart=1&level=<id>` for each level, runs `tools/godot-bake/extract.js` in the page
and writes:

| Output | Contents |
| --- | --- |
| `godot/levels/<id>/world.json` | manifest: every mesh (world matrix, attributes, material groups), every material (kind, maps, three.js parameters and uniforms), sprite sheets, and the gameplay data — the resolved tile grid, static colliders, bridge walk surfaces, interactables with their texts, point-light descriptors, emissive materials, villagers (their definitions and baked sheets), the player, the camera framing (near / mid / far bounds, high-ground tilt), the 24-hour palette and sun / moon paths, regions, and the normalised level itself (`levelData`) |
| `godot/levels/<id>/world.bin.gz` | vertex, index, instance (MultiMesh layout) and tile data |
| `godot/assets/baked/textures/*.png` | every texture, by content hash (shared between levels). Canvas textures are written bottom-up, so Godot samples them with three.js' own UVs |
| `godot/assets/baked/sprites/*.png` | the character sheets (32 × 32 frames; rows down / left / right / up) |
| `godot/levels/index.json` | the baked levels (the level switcher reads it) |

Images that no level uses any more are deleted at the end of a bake.

## 4. How the engine maps to Godot

| three.js engine | Godot port | Notes |
| --- | --- | --- |
| `TileMap` geometry, `Props`, `Trees`, `GroundDetail`/`Foliage`, `Water` mesh | baked → `scripts/luminati/baked_world.gd` (ArrayMesh, MultiMesh) | winding flipped (three CCW → Godot CW); world matrices kept; windmill sails turn about their pivot |
| `TileMap` queries: `getHeight`, `isWalkable`, `move`, colliders, walk surfaces | `scripts/luminati/tile_map.gd` | line-by-line port; **parity test** `godot/tests/tilemap_parity.tscn` replays 600 heights / walkability queries and 600 moves recorded in the browser |
| `MeshLambertMaterial` + TileMap / Wind / decal patches | `shaders/lum_surface.gdshaderinc`, variants by `#define` (`scripts/luminati/materials.gd`) | Lambert with three's intensities (Godot energy = three intensity, `light()` divides by π²: Godot's LIGHT_COLOR carries π, three's BRDF divides by π); hemisphere fill added in `light()` on the sun's pass; derivative tangent frame for normal maps (made handedness-safe for Godot's y-down targets); TileMap organic UV variation, decal mask, wall bounce; wind sway and leaf-card billboards (sun-facing in the shadow pass) |
| `Sprite3D` (characters) | `scripts/luminati/character_sprite.gd`, `shaders/lum_sprite*.gdshader` | cylindrical billboard, bent normals + wrap diffuse, warm fill, sun-facing shadow proxy, blob shadow |
| `Foliage` | `shaders/lum_ground_foliage.gdshader` | per-instance yaw billboard, gust sway, frame strips |
| `Water`, waterfalls, plunge pools | `shaders/lum_water.gdshader`, `lum_waterfall*.gdshader` | depth bands, flow-mapped ripples, foam, glints (HDR specular in `light()`) |
| `Flame`, glow cards | `shaders/lum_flame.gdshader`, `lum_glow.gdshader` | |
| `Sky` | `shaders/lum_sky.gdshader` (sky shader) | gradient, pixel sun / moon / stars / clouds, sea of clouds |
| `LightingSystem` (24 h palette, PCHIP, sun / moon paths, point-light flicker, emissives) + `Weather` looks | `scripts/luminati/lighting.gd` | the game's merged keyframes come from the bake; clear / rain / snow lighting, overcast tint, zoom fog |
| FogExp2 + fog start | `lum_fog()` → `FOG` in every shader | |
| PostFX: bloom → ACES → grade | Godot glow (threshold 1.05) → `shaders/lum_grade.gdshader` (three's ACES fit + the grade: sharpen, CA, white balance, contrast, saturation, split toning, vignette, grain, dither) | needs `rendering/viewport/hdr_2d` (Forward+). In the Compatibility renderer Godot's ACES is matched to three's instead |
| PostFX tilt-shift DOF | Godot camera DOF (depth band around the player) | true tilt-shift band: phase 2 |
| `CameraRig` + `Game._updatePlayCamera` | `scripts/luminati/camera_rig.gd` | follow + look-ahead, Q / E within ±60°, zoom, near / mid / far bounds, high-ground pitch, edge-aware yaw |
| `Player`, `Npc` (wander / post / perform) | `scripts/game/player.gd`, `npc.gd` | |
| `dialogue.js` (Emberfall's scripts, level dialogue + rest / shop / music actions) | `scripts/game/dialogue.gd` | |
| `DialogBox`, HUD, prompt, banner, fader | `scripts/ui/dialog_box.gd`, `hud.gd` | Jersey 15 / 10 and Tiny5 (OFL, `godot/assets/fonts/`) |
| `Game` (interaction, regions, time / weather / photo keys, rest) | `scripts/game/game.gd` | |

## 5. The phases

| # | Phase | Contents | State |
| --- | --- | --- | --- |
| 1 | **The diorama** | bake pipeline; all six shipped levels; terrain, props, trees, foliage, water, flames, sky; 24 h lighting, shadows, fog, bloom, ACES + grade; player, villagers, conversations (Emberfall's scripts and level dialogue with choices), signs / doors / wells; camera; HUD; time, weather looks, photo mode, level switching | **done** |
| 2 | **Atmosphere and life** | GPU particles (dust motes, fireflies, chimney smoke, embers, waterfall mist and spray, falling leaves / petals, rain and snow with settled snow cover), god rays, critters (chickens, ducks, cats, butterflies) and the child's chase, the player's x-ray silhouette, footstep dust, a true tilt-shift DOF (CompositorEffect), the lamp-glass dimming, Weather's god-ray / particle levels | planned |
| 3 | **Sound** | the procedural sound effects and music: rendered from the engine's `AudioSystem` with an OfflineAudioContext by the bake (OGG), played by an AudioDirector port (ambience: fire crackle, waterfall roar, rain) | planned |
| 4 | **Stories and campaigns** | the story-script language (parser + runtime: flags, items, quests, events, cutscenes, objects that come and go), the journal, campaigns (exits / entrances, rooms set aside, the travel fader), saves, *The Ferryman's Lantern* and *Emberfall — Open Doors* | planned |
| 5 | **Combat and party** | Cinderwatch Pass: sword combos, dodges, skills, enemies and their AI, the boss Cinderheart, loot, shops, waystones, chests, telegraphs, the combat HUD; companions and tactics | planned |
| 6 | **Languages and menus** | Japanese and Simplified Chinese (the `public/i18n/` tables, CJK fonts), the title screen, the world map and minimap, the controls legend, the debug panel | planned |
| 7 | **Native world building** | the generators in Godot — an editor import plugin that turns a level JSON into a scene (TileMap geometry, props, foliage) without the browser; level editing in the Godot editor | planned |
| 8 | **Ship** | export presets (Windows / Linux / Web), performance passes on the 128 × 128 levels (visibility ranges, merged shadow casters), input remapping, settings menu | planned |

## 6. Known differences (phase 1)

- Depth of field is Godot's (a depth band around the player), not the engine's tilt-shift screen
  band, and it needs Forward+ (the Compatibility renderer has none).
- No particles, god rays, critters, sound or music yet (phases 2–3). The bard's music toggles a
  flag only.
- Villagers with a story `talk` script or the combat `drillmaster` / `shopkeeper` scripts speak
  their plain level dialogue until phases 4–5.
- Big levels (Starfall Vale, Gildhaven: 128 × 128) load more slowly than in the browser (all
  meshes are built at start) and are not yet tuned for draw calls.
- Levels are English only (phase 6).
- Developed and checked on the Compatibility renderer (this port's CI machine has no Vulkan). The
  shaders handle both renderers' colour spaces (`lum_in` / `lum_out` in
  `shaders/lum_common.gdshaderinc`); the Compatibility renderer has no bloom or DOF.

## 7. Verification

- `godot --headless --path godot res://tests/tilemap_parity.tscn -- --level=emberfall`: the
  walking rules against the browser's TileMap.
- `godot --path godot -- --shot=shot.png --frames=40` (with a display): a screenshot to compare
  with the browser game at the same hour (`?autostart=1`, `__game.setTime(17.2)`).
- `godot/tests/light_calibration.tscn`: measures Godot's light units (the factor π the shaders
  divide by).
