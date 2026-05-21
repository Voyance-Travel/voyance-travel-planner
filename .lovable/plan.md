# MVP Blocker Fix Plan

Four blockers, one shared theme: the itinerary surfaces look unfinished at the exact moment a user decides whether to trust the product. Each fix is scoped and independently shippable.

---

## 1. Scheduling Engine — overlaps, fake "5 min" transits, bad distances

**Where it lives**
- `supabase/functions/_shared/timing-cascade.ts` — `enforceTimingAndBuffers`, `estimateTransit`, `getEffectiveMinBuffer`.
- Used at save (`action-save-itinerary` STEP 2.9) and at repair (`repair-day` §16). UI must read the engine's result, never recompute.

**Root issues observed**
- a. `estimateTransit` returns `null` whenever either endpoint is missing lat/lng → the cascade falls back to a flat 15-min default and the LLM-emitted "5 min walk" cards survive unedited.
- b. When coordinates exist but are wrong/poisoned (e.g. one venue carries the city centroid), Haversine yields nonsense distances and the "transit gap" warnings render against rendered times, producing the visible 5-min/overlap/conflict spam.
- c. The cascade only shifts the *next* card forward; it never corrects a transit card's *own* duration when that duration is implausible vs the geo distance.

**Fix**
1. In `estimateTransit`: when either endpoint lacks coords, fall back to a **named-venue lookup** via `verified_venues` (already imported elsewhere in `_shared`) before returning null. If still unknown, return a conservative `{method:'taxi', durationMinutes: 15}` placeholder tagged `unverified:true` so downstream UI can dim it rather than asserting "5 min".
2. Add a **transit-card self-correction pass** in `enforceTimingAndBuffers`: for any activity whose `category` is transit/walking, recompute `durationMinutes` from `estimateTransit(prev,next)` and overwrite. Cap walking at the existing `WALK_LUXURY/HARD` thresholds from `_shared/transit-mode.ts` so "5 min walk Manhattan→Brooklyn" becomes a taxi card.
3. Surface a single repair log per day: `[CASCADE] day=N corrected_transits=K reflowed=M unverified=U` so we can watch the regression rate.
4. Add `src/lib/itinerary/healthCascadePreview.ts` consumer guard: if a transit card is `unverified`, suppress the "5 min conflict" warning text — it's the engine's own placeholder, not a real conflict.

**Acceptance**
- `Baretto → Evvai` (or any same-evening pair) shows a real duration/mode, not "5 min".
- Cross-borough/cross-river pairs render as taxi/transit with realistic minutes.
- TripHealth conflict count drops on existing trips with no user action; sentinel `[CASCADE]` logs show corrections.

---

## 2. "Closed" badge with no context

**Where it lives**
- `src/components/reviews/ReviewsDrawer.tsx` L222–243.

**Fix (UI only, no business logic change)**
- Replace `"Closed now"` with a context-aware label using existing `place.openingHours`:
  - If today's opening line is known and the venue opens later today → `"Opens at 7:30 PM"`.
  - If today is a closed day → `"Closed today — open tomorrow at 9:00 AM"`.
  - If the activity's scheduled `startTime` falls *inside* the venue's hours, suppress the badge entirely (the schedule is correct; the badge is just outdated `open_now`).
- Tone down color: amber (`text-amber-600`) when the venue opens later today; red only when it's closed for the entire day.

**Acceptance**
- A dinner card scheduled at 8 PM at a venue that opens at 7:30 PM shows no scary "Closed" badge.
- Currently-closed-but-opens-later venues show "Opens at HH:MM" in amber, not red.

---

## 3. Wrong hero image (MAM showing European coastal city)

**Where it lives**
- `src/hooks/useActivityImage.ts` — `fetchFromSharedTables` at L72–93 does `.ilike('name', '%MAM%')` with **no destination filter**. Three-letter acronyms match dozens of unrelated rows globally.

**Fix**
1. Tighten `fetchFromSharedTables` to filter by `destination` (the `attractions`/`activities` tables already carry a `city` or `destination_id` column — pick whichever exists in `src/integrations/supabase/types.ts`).
2. Refuse to match when the search term is ≤ 4 chars AND has no destination scoping signal (the existing `STRIP_PREFIXES` doesn't help here).
3. Run `isUntrustedHeroUrl` (already in `src/lib/heroUrlPolicy.ts`) on the returned URL — drop and fall through to curated/edge-function if it fails.
4. One-shot cache purge: clear `voyance_photo_*` localStorage keys whose cached `source = 'shared_attraction'` on next page load, since poisoned URLs are already cached in the user's browser.

**Acceptance**
- MAM São Paulo Day-3 card renders a São Paulo-bound image (or the category fallback), never Dubrovnik.
- New trips: zero cross-city image leaks across 10 sample destinations.

---

## 4. Hedging description ("Pinacoteca Contemporânea or the nearby MAM")

**Where it lives**
- Generator prompt: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` and `prompt-library.ts`.
- Save-time scrubber: `supabase/functions/_shared/scrub-activity.ts` (already wired at repair §10b + save normalizeDays + UI sanitizer per the Unified Output Validation Layer memory).

**Fix**
1. Add a **HARD RULE** block in `prompt-library.ts`: "Commit to ONE venue per activity. Never write 'or the nearby X', 'or alternatively Y', 'either A or B'. The `title`, `venue.name`, and `description` MUST name the same single venue."
2. Add `scrubHedgedAlternatives` to `_shared/scrub-activity.ts`: when description matches `/\b(or the nearby|or alternatively|either .+ or|or a nearby)\b/i`, strip the dependent clause and keep the committed venue (the one already in `title`/`venue.name`).
3. Add a `VENUE_NAME_MISMATCH` code to `applyValidationGate` (`_shared/validation-gate.ts`): when `description` mentions a venue proper-noun that differs from `title`/`venue.name`, force-blank the description and let `_shared/description-fill.ts` re-fill cleanly.

**Acceptance**
- MAM card description names only MAM.
- Regression test: feed a known hedging snippet through `scrubActivity` and assert the alternative is stripped.

---

## Out of scope
- No matcher / DNA / cost-table changes.
- No new edge functions.
- No UI redesign — only the Closed badge copy/color and image source filter.

## Ship order
1. (#3) Image filter — single file, highest demo-credibility return.
2. (#2) Closed badge copy — single component.
3. (#4) Hedging scrub + prompt rule — two files plus a unit test.
4. (#1) Scheduling engine — most code, ship last and watch `[CASCADE]` logs for a day before extending.
