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
| 🌭 Dachshund | `dachshund.glb` |
| 🦴 Golden Retriever | `golden.glb` |

## Suggested workflow (MagicaVoxel)

1. Model the dog in [MagicaVoxel](https://ephtracy.github.io/) (free).
2. Export as `.vox` and convert with `models/vox_to_glb.py` (see below) —
   this avoids relying on MagicaVoxel's own `.glb` exporter, which doesn't
   handle every scene the same way. Or export `.obj`/`.glb` directly and
   convert/re-export via Blender if you need more control.
3. Orientation matters: the dog should face **-Z** (nose pointing toward
   negative Z), stand upright on **Y = 0**, and be roughly **1 unit tall**
   at the shoulder — that's the scale the park camera and per-dog size
   variation are tuned for. If it renders too big/small/sideways, that's
   the first thing to check.
4. Drop the exported file in this folder with the exact name from the
   table above.

## Converting a raw `.vox` file

`vox_to_glb.py` (no dependencies beyond Python 3) parses a MagicaVoxel
`.vox` file directly and writes a `.glb`, without needing MagicaVoxel's
own exporter or any other 3D software:

```bash
python3 models/vox_to_glb.py path/to/model.vox models/dachshund.glb 0.1
```

The third argument is world units per voxel — `0.1` makes an 8-voxel-tall
model about 0.8 units tall, comparable to the procedural dogs. If a
model looks too big/small, that's the number to adjust; re-run and
compare in the park.

It picks whichever model in the file has the most voxels (some
MagicaVoxel exports include an empty placeholder model — this skips it),
groups voxels by palette color into a few merged cube meshes, and centers
the result. It assumes the standard MagicaVoxel authoring convention
(Z-up) with the model's **head at the high-Y end** — if your model faces
the other way after conversion, flip the sign in the `oz` line inside the
script. It always produces a static model (no leg articulation), since
merged voxel art doesn't have separate movable parts — see the note below
if you want animation instead.

## Starting from the procedural terrier shape

If you'd rather sculpt from the existing procedural dog than start blank,
`voxelize_terrier.py` rasterizes the exact box geometry `buildDogMesh()`
draws for the default "🐕 Medium dog" look (same positions, sizes, and
colors, ear angles included) into a `.vox` file you can open directly in
MagicaVoxel:

```bash
python3 models/voxelize_terrier.py terrier.vox
```

Useful as a base to reshape into a different breed (stretch it into a
dachshund, shrink the legs, etc.) while keeping the proportions/parts
this project already renders correctly, rather than starting from
nothing. It's a one-way export (voxel grid, not editable box params) —
regenerate from scratch if you want to tweak the *procedural* shape
itself, don't hand-edit and expect it to sync back to app.js.

## Deriving multiple breeds from one hand-edited base

`build_breed_variants.py` takes a single hand-sculpted/touched-up base
`.vox` (assumed to already match `voxelize_terrier.py`'s axis convention —
i.e. it started life as that script's output and was edited in
MagicaVoxel) and derives several breed `.glb`s from it programmatically,
without needing to re-sculpt each one by hand:

```bash
python3 models/build_breed_variants.py base.vox models/golden.glb models/dachshund.glb
```

- **Golden retriever**: recolor only — same geometry as the base, just a
  golden coat and warmer dark accents.
- **Dachshund**: recolored to a hot-dog-bun palette with a mustard stripe
  down the spine, torso stretched length-wise, and legs shortened by
  compressing the low-height voxels and dropping the rest of the body
  to meet them.

Both outputs use adjacency-based face culling — skip any face between
two solid voxels, since it's never visible — which took file size from
~4.7MB down to ~350KB per model for a ~6,500-voxel base. Worth doing for
any hand-sculpted (as opposed to sparse procedural) model; `vox_to_glb.py`
above doesn't need this since the source dachshund_run.vox was only 369
voxels.

Tune `TORSO_START`/`TORSO_END`/`LEG_HEIGHT`/`STRETCH`/`LEG_SCALE` at the
top of the script if you start from a differently-proportioned base —
they were picked by inspecting this project's specific base file's
layout (ASCII-art print the top-down and side silhouettes to find the
right cutoffs before assuming these numbers carry over).

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
