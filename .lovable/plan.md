# M12 — Quick preview validates first dining venue

## Context

`supabase/functions/generate-quick-preview/index.ts` returns 3-day previews with this shape:

```ts
interface QuickPreviewDay { dayNumber: number; headline: string; description: string; }
```

There is **no** `activities[]`, `venueName`, or `title` on the day — the AI emits prose-style `headline` (5–8 words referencing a real place) and `description` (20–30 words with 2–3 real venues). The spec assumes an activities array, so we adapt the same intent (validate the first dining venue) to this preview shape.

## Change

After the `Promise.all([...])` returns at lines 535–539 in the request handler, **before** assembling `result` at line 556, run one Places text-search against the first dining-flagged day.

```ts
// ── First-dining venue validation — catches obvious AI hallucinations
//    before showing the preview. One Places search per preview (~$0.017),
//    cache-first via cachedGooglePlacesTextSearch.
try {
  const previewDays = aiResult.days || [];
  const DINING_RE = /breakfast|brunch|lunch|dinner|cafe|café|restaurant|trattoria|osteria|izakaya|ramen|bistro|bakery|bar|pub/i;
  const matchIdx = previewDays.findIndex((d: any) =>
    DINING_RE.test(`${d?.headline || ''} ${d?.description || ''}`)
  );
  if (matchIdx >= 0) {
    const d = previewDays[matchIdx];
    // Use the headline (concise, place-anchored) as the search query when it
    // contains the dining keyword; otherwise fall back to the description.
    const queryStr = DINING_RE.test(d.headline || '') ? d.headline : d.description;
    if (queryStr && queryStr.trim().length > 0) {
      const { cachedGooglePlacesTextSearch } = await import('../_shared/google-api.ts');
      const validation = await cachedGooglePlacesTextSearch(
        {
          textQuery: `${queryStr} ${destination}`.slice(0, 240),
          maxResultCount: 1,
          languageCode: 'en',
          fieldMask: 'places.id,places.displayName,places.formattedAddress',
        },
        { actionType: 'quick_preview_venue_validation', reason: `validate dining day ${d.dayNumber}` }
      );
      const found = validation.ok && (validation.data?.places?.length ?? 0) > 0;
      if (!found) {
        console.warn('[quick-preview] First dining venue not verified on Google Places:', {
          query: queryStr, destination,
        });
        (previewDays[matchIdx] as any)._venueValidation = 'first_dining_unverified';
      }
    }
  }
} catch (valErr) {
  console.warn('[quick-preview] Venue validation failed (non-blocking):', valErr);
}
```

Then the existing `result.days = aiResult.days || []` already carries the `_venueValidation` flag through to the frontend.

## Adjustments vs. user spec

- **No `activities[]` exists** in QuickPreviewDay. We instead match the dining regex against `headline + description` and use the matching string as the search query — this is the closest semantic equivalent. The spec's `firstDining.venueName || firstDining.title` is mapped to `headline || description`.
- **Place stamp on the matched day**, not always `previewDays[0]` — if Day 2 is the first dining-flagged day, the warning attaches there.
- **Truncate query to 240 chars** to avoid sending a long description as `textQuery`.
- **Frontend copy** ("Preview venues are AI-generated; final itinerary uses verified venues") is out of scope here — backend just stamps the flag.

## Verification

- `grep -c "quick_preview_venue_validation\|_venueValidation" supabase/functions/generate-quick-preview/index.ts` → ≥ 2
- Deploy `generate-quick-preview`.
- Spot-check `[quick-preview] First dining venue not verified` warning appears on a hallucinated preview; cache HIT log on a popular destination's second invocation.

## Out of scope

- Frontend banner reading `_venueValidation`.
- Validating non-dining venues or more than the first day.
- Type-extending `QuickPreviewDay` — the field is attached via `as any`, deliberately optional/loose so the frontend can ignore it.
