# Custom breed models

Drop a `.glb` file here per breed archetype and it automatically replaces
the procedural box dog for that breed — no code changes needed. Missing
files just fall back to the procedural version, so you can add these one
at a time.

## File names

| Look (form dropdown) | File |
|---|---|
| 🐕 Medium dog | `terrier.glb` |
| 🐶 Puppy face | `puppy.glb` |
| 🐩 Curly-coated | `poodle.glb` |
| 🦮 Big & steady | `labrador.glb` |
| 🐕‍🦺 Working breed | `shepherd.glb` |

## Suggested workflow (MagicaVoxel)

1. Model the dog in [MagicaVoxel](https://ephtracy.github.io/) (free).
2. Export as `.glb` — MagicaVoxel can export directly, or export `.obj` and
   convert/re-export via Blender if you need more control.
3. Orientation matters: the dog should face **-Z** (nose pointing toward
   negative Z), stand upright on **Y = 0**, and be roughly **1 unit tall**
   at the shoulder — that's the scale the park camera and per-dog size
   variation are tuned for. If it renders too big/small/sideways, that's
   the first thing to check.
4. Drop the exported file in this folder with the exact name from the
   table above.

## Optional: rigging for the walk animation

A static model works fine out of the box — it'll still bob and turn to
face its direction of travel, same as every dog in the park. If you want
real leg-swing and tail-wag animation too, name these objects/empties in
your scene before export (Blender's Outliner, or MagicaVoxel's object
names):

- `head` — bobs isn't applied here, but reserved for future use
- `tail` — wags side to side
- `legFL`, `legFR`, `legBL`, `legBR` — front-left/right and back-left/right
  leg pivots; each should be a small group/empty positioned at the hip,
  with the leg geometry hanging *below* it (like a hinge), matching the
  same pattern the procedural legs use

All four leg names must be present for leg-swing to activate — if only
some exist, the app skips leg animation entirely and falls back to just
root-level bob/turn (partial rigging isn't currently supported).
