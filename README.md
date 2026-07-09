# Wescue Dog Park

A gamified prototype for [Wescue](https://wescue.com): a virtual dog park where each roaming dog represents a real shelter listing. Posting a dog (simulating a shelter's real listing) spawns it walking into the park; clicking a dog opens an adoption card with a link back to the real listing.

The park is a 3D voxel scene rendered with [Three.js](https://threejs.org) (loaded from a CDN via an import map — no build step) and drawn at a low internal resolution, then upscaled with nearest-neighbor filtering for a chunky "3D pixel art" look. Dog data is seeded as mock listings and backed by `localStorage`. It's meant to validate the concept before wiring it to real data from the main [wescue](../wescue) app.

## Running it

Just open `index.html` in a browser, or serve the folder (needed for the ES module import to work over `file://` in some browsers):

```bash
npx serve .
```

## How it works

- `SEED_DOGS` in `app.js` seeds a handful of mock shelter dogs on first load.
- Each dog is a small group of boxes (body, head, snout, ears, tail, 4 legs) built in `buildDogMesh()` — no external 3D models. Coat color comes from the "look" emoji picked in the form via `EMOJI_COLOR`.
- Dogs wander to random points in the park; legs swing in a simple trot cycle and the body bobs slightly while moving.
- **Post a Shelter Dog** opens a form simulating a real shelter listing. Submitting it spawns the dog in through the gate and persists it to `localStorage`.
- Clicking a dog raycasts against the 3D scene, then opens a card with its bio, shelter, and a "Meet on Wescue" link (the `url` field from the listing).
- A running count of dogs in the park and pets given is shown in the header, for a bit of gamified feedback.

## Next steps toward real data

- Replace `SEED_DOGS` / the add-dog form with a read from the real `dogs` table in the [wescue](../wescue) Supabase project (status = `available`).
- Subscribe to new dog inserts (Supabase Realtime) so the park updates live as shelters post dogs, instead of only via the local form.
- Swap procedural voxel dogs for nicer hand-authored voxel models (e.g. designed in MagicaVoxel, exported to `.glb`) if the blocky look needs more polish.
