# Wescue Dog Park

A gamified prototype for [Wescue](https://wescue.com): a virtual dog park where each roaming dog represents a real shelter listing. Posting a dog (simulating a shelter's real listing) spawns it walking into the park; clicking a dog opens an adoption card with a link back to the real listing.

This is a standalone, dependency-free prototype (plain HTML/CSS/JS, no build step) seeded with mock dogs and backed by `localStorage`. It's meant to validate the concept before wiring it to real data from the main [wescue](../wescue) app.

## Running it

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## How it works

- `SEED_DOGS` in `app.js` seeds a handful of mock shelter dogs on first load.
- Each dog wanders to a new random point in the park every couple of seconds via CSS transitions.
- **Post a Shelter Dog** opens a form simulating a real shelter listing. Submitting it adds the dog to the park (spawning in through the gate) and persists it to `localStorage`.
- Clicking a dog opens a card with its bio, shelter, and a "Meet on Wescue" link (the `url` field from the listing).
- A running count of dogs in the park and pets given is shown in the header, for a bit of gamified feedback.

## Next steps toward real data

- Replace `SEED_DOGS` / the add-dog form with a read from the real `dogs` table in the [wescue](../wescue) Supabase project (status = `available`).
- Subscribe to new dog inserts (Supabase Realtime) so the park updates live as shelters post dogs, instead of only via the local form.
- Swap emoji sprites for actual dog photos/breed art.
