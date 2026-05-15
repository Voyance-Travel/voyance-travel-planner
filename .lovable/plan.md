## Diagnosis

The hero fallback is still not fixed because the resolver only checks whether a stored URL is “trusted” by host/pattern. It does **not** verify that the object actually exists before choosing it.

What I found:
- `destinations` has canonical hero URLs for Dublin, Copenhagen, Barcelona, Paris, and Bali.
- Paris and Bali objects load successfully.
- Barcelona’s canonical object returns `400 {"message":"Object not found"}`:
  - `site-images/photo-1583422409516-2895a77efed6`
- The app then falls back to a generated SVG gradient, producing the brown/tan blank hero.
- Browser network also showed multiple `site-images/photo-*` requests blocked/failing because the URL points to missing storage objects.
- There are already valid destination-bucket assets for Barcelona and Copenhagen:
  - `destination-images/destination/barcelona-1.jpg`
  - `destination-images/destination/barcelona-2.jpg`
  - `destination-images/destination/copenhagen-0.jpg`, etc.
- `src/data/destinationStorageImages.ts` already contains a stable internal map for many destinations, including Barcelona/Copenhagen/Bali/Paris, but the trip hero path (`useTripHeroImage`) does not use it.

## Plan

1. **Add a stable internal destination fallback tier**
   - In `useTripHeroImage`, import the existing `DESTINATION_STORAGE_IMAGES` map.
   - Resolve a destination key like `Barcelona` → `barcelona` and use `imageUrl` from that map before falling through to API/gradient.
   - This gives Barcelona/Copenhagen/Paris/Bali and other mapped cities a real internal image even if `destinations.hero_image_url` is stale or missing.

2. **Do not let broken canonical URLs become terminal**
   - When canonical/seeded images fail `onError`, continue down the resolver chain to mapped storage image / DB curated / API before gradient.
   - Keep the current trust-policy checks, but add the missing “file failed to load” behavior to the source chain.

3. **Patch known bad canonical rows through code path, not a fragile one-off**
   - Barcelona should display `destination-images/destination/barcelona-1.jpg` from the existing stable map when the stored `site-images/photo-158342...` 404s.
   - Copenhagen and Dublin should still display canonical if loadable; if they fail later, they also get the same durable fallback route.

4. **Add lightweight diagnostics**
   - Log a clear warning when a hero source fails and the resolver advances, e.g. `[useTripHeroImage] source failed; trying next hero tier`.
   - This makes future “blank hero” regressions traceable without guessing.

5. **Verify with the requested cities**
   - Re-check the relevant grep/import path.
   - Reproduce Barcelona in preview and confirm the hero `<img>` is no longer a `data:image/svg` gradient after the bad canonical URL fails.
   - Confirm the loaded URL is an internal `destination-images/destination/barcelona-*.jpg` image.

No database schema change is needed.