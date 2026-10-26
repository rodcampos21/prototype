# Custom characters (previews)

Character specs for the engine's sprite generator (`createCharacterSheet` in
`src/engine/pixel/CharacterSprites.js`), with the rendered sheet (32 × 32 frames; rows down / left /
right / up) and a walk-cycle preview. Not used by any level yet.

| Character | Files |
| --- | --- |
| White-haired knight | `knight.json`, `knight.png`, `knight_walk.gif` |
| Catfish mage | `catfish.json`, `catfish.png`, `catfish_walk.gif` |

The catfish uses a fish head (`hairStyle: "fin"`, `beard: "barbels"`, `face: "fish"`) that the
engine does not have yet: `fish-head.patch` adds those templates to `CharacterSprites.js`.
