# Fix: Wellness activities with treatment names but no real venue

## The bug

Activities like "Glow & Wellness Facial Ritual" ($239), "Personalized Wellness Treatment", "Bespoke Beauty Ritual" ship with a treatment name and a price, but no real spa attached. They're material — these are the most expensive single line items of the day — and unbookable as written.

The infrastructure already exists: `INLINE_FALLBACK_WELLNESS`, `nuclearWellnessSweep` (run during quality pass AND pre-save), and the **Wellness Venue Integrity** core rule. The bug is in the detector — `isPlaceholderWellness` (`supabase/functions/generate-itinerary/fix-placeholders.ts:315`) under-matches.

Two concrete gaps confirmed by replay test:

1. **Title keyword regex too narrow.** `WELLNESS_KEYWORD_RE` requires `spa|wellness|massage|hammam|sauna|onsen|thermal|treatment|hot spring|hot tub|jacuzzi`. Titles like "Personalized Facial Ritual", "Bespoke Beauty Ritual", "Signature Facial" — all classic luxury spa naming — slip through entirely.
2. **Generic-venue heuristic too lenient.** Common AI fillers like "Hotel Spa", "On-site Spa", "Spa", "The Spa" pass `length >= 4` and don't match the existing regex, so a wellness-titled activity with a fake-but-non-empty venue is accepted.
3. **No verification gate.** A wellness item with a long, plausible-but-unverified venue name and no `placeId`/`google_place_id`/`verified.placeId` still passes — the sweep trusts whatever the AI invented.

## Fix

All edits in `supabase/functions/generate-itinerary/fix-placeholders.ts`. No DB migration. The sweep is already wired into universalQualityPass + pre-save, so widening detection is sufficient.

### 1. Broaden the wellness title detector

Extend `WELLNESS_KEYWORD_RE` to cover the missing luxury-spa nouns:
```
\b(spa|wellness|massage|hammam|sauna|onsen|thermal|treatment|ritual|facial|skincare|beauty|pampering|hot\s*spring|hot\s*tub|jacuzzi|cryotherapy|reflexology|aromatherapy)\b
```

Add patterns to `GENERIC_WELLNESS_TITLE_PATTERNS`:
```
/^(glow|radiance|bliss|escape|serenity|tranquility|harmony|balance|renewal|refresh)\s*[&+]?\s*(wellness|spa|beauty|skincare)\b/i
/^(personalized|personalised|bespoke|signature|tailored|curated|customized|customised|exclusive|premium|luxury|private|holistic|restorative|indulgent|deluxe)\s+(facial|skincare|beauty|pampering|treatment|ritual|massage|hammam)\b/i
/^(facial|beauty|skincare|pampering)\s+(ritual|session|experience|treatment|moment|escape)\b/i
```

### 2. Tighten the generic-venue heuristic

Add to `isGenericVenue` (around line 331):
```
/^(hotel|on-?site|in-?house|on\s+property)\s+(spa|wellness|salon|gym)$/i
/^(the\s+)?(spa|wellness|salon|hammam|sauna)$/i
/\b(spa|wellness)\s+(in|at|near|by)\s+(the\s+)?(hotel|property)\b/i
```

### 3. Add a verification gate for wellness

After the existing checks in `isPlaceholderWellness`, add: if `isWellnessCat || isWellnessTitle`, the activity must have at least one of:
- `activity.metadata?.google_place_id`
- `activity.metadata?.placeId`
- `activity.verified?.placeId`
- a `location.address` of length ≥ 8 with at least one digit (a real street address)

If none of those, treat as placeholder. The existing nuclearWellnessSweep then handles the cleanup path (real fallback → free hotel-spa → strip).

### 4. Also tag `cost.amount = 0` in the strip path

When `nuclearWellnessSweep` strips an activity (line 861), defensively zero its cost first if there's a chance the row leaked into `activity_costs` upstream. Cost write happens AFTER the sweep, so this is belt-and-braces only.

### 5. Tests

Extend `supabase/functions/generate-itinerary/fix-placeholders.test.ts`:
- "Glow & Wellness Facial Ritual" with no venue → detected
- "Personalized Facial Ritual" with no venue → detected
- "Signature Facial" + venue "Hotel Spa" → detected
- "Hot Stone Massage at Spa Valmont" + address "228 Rue de Rivoli" → NOT detected
- Wellness activity with `metadata.google_place_id` set → NOT detected (verification gate works)

## Files

- `supabase/functions/generate-itinerary/fix-placeholders.ts`
- `supabase/functions/generate-itinerary/fix-placeholders.test.ts`

## Memory

Update existing core rule **Wellness Venue Integrity** (already in `mem://index.md`) to record the verification gate: "Wellness items must have placeId or a real numbered address; treatment-name-only titles (Facial Ritual, Beauty Treatment, Glow & Wellness…) are placeholders even without 'spa/wellness' in the title." No new memory file needed.
