
Root cause found (not guessed): the crash is a hooks-order violation in `src/pages/TripDetail.tsx`.

- `useTripHeroImage(...)` is called **after** early returns (`if (loading) return ...`, `if (error || !trip) return ...`, and active-trip redirect).
- On first render (loading=true), that hook is not called; on later render it is called.
- This causes React invariant **#310** (“Rendered more hooks than during the previous render”), which triggers your “Small detour” fallback.
- The Unsplash 404s are real but secondary; they are image-source failures, not the React crash cause.

Implementation plan:

1. Fix hook-order bug in `TripDetail.tsx` (primary unblock)
- Refactor hero image logic into a child component (e.g. `TripHeroBanner`) that receives a fully loaded `trip`.
- Move `useTripHeroImage` into that child so the parent `TripDetail` no longer conditionally calls a hook.
- Keep parent early returns as-is; render child only in the successful trip state.

2. Harden hero image recovery for stale seeded URLs
- In `src/hooks/useTripHeroImage.ts`, allow replacing `metadata.hero_image` when existing value is a broken legacy URL (especially `images.unsplash.com`) and a working fallback (`curated/db_curated/api`) is found.
- This prevents repeated dead-image attempts every time the trip is opened.

3. Reduce recurring Unsplash noise for known dead curated URLs
- In `src/utils/destinationImages.ts`, update/skip known dead entries (the two IDs from your logs: Busan/Jeju).
- Keep graceful fallback chain intact so one bad URL never degrades the page.

4. Validate end-to-end (must pass before closing)
- Open My Trips → past trip → View Itinerary.
- Confirm no “Small detour” loop.
- Confirm no React #310 in console.
- Confirm hero/activity images still render via fallback chain when a URL fails.

Technical details (exact files):
- `src/pages/TripDetail.tsx` — remove conditional hook call pattern by component refactor.
- `src/hooks/useTripHeroImage.ts` — promote fallback URL persistence over stale seeded unsplash values.
- `src/utils/destinationImages.ts` — replace/skip dead curated Unsplash IDs shown in error logs.
