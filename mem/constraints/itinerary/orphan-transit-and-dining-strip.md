---
name: Orphan Transit & Nuclear Dining Strip
description: pruneOrphanTransits drops "Walk to X" connectors when target dropped by upstream filters; diacritic-safe + majority-token match + save-time net
type: constraint
---

`pruneOrphanTransits` (`supabase/functions/_shared/orphan-transit.ts`) drops transit cards whose `to <X>` target is absent from the day. Locked / user-pinned exempt. Logistics targets (airport / station / port / hbf / gare / stazione, or `transportation.kind ∈ {departure, airport_transfer, flight_transfer}`) exempt from end-of-day drop.

## Match tiers (Case 2)

1. **Substring** on diacritic-stripped normalized blob.
2. **Strict AND** on all length≥4 tokens of the target (legacy behavior).
3. **Majority** on significant (non-stopword) tokens — only when ≥2 significant tokens exist; threshold = ceil(N/2).

`normalize()` now NFD-decomposes + strips combining marks **before** punctuation strip so `"Café Chris"` → `"cafe chris"`. STOP_TOKENS list (`the/a/an/and/at/in/on/of/to/for/with/de/la/le/les/el/il/van/het/der/die/das/museum/house/restaurant/cafe/bar/hotel/shop/store/park/plaza/square`) defines low-signal tokens dropped from the majority set. Closes Amsterdam "Walk to Cafe Chris" diacritic miss + "Walk to Anne Frank House" vs "Anne Frank Museum" partial-name miss.

## Wiring (4 sites)

- `pipeline/enrich-day.ts` — after cross-city filter.
- `universal-quality-pass.ts` Step 4d + terminal.
- `action-generate-trip-day.ts` — post-repair + retry after meal guard.
- `_shared/schedule-executioner.ts` — final orchestrator pass (sentinel `ORPHAN_TRANSIT_DROPPED`).
- `action-save-itinerary.ts` **STEP 2.68** — save-time safety net for chat/manual edit/undo paths that don't re-run the executioner (sentinel `[SAVE_ORPHAN_TRANSIT]`).

## Companion

`nuclearDiningStrip` mirrors `nuclearWellnessSweep` with splice + preceding-transit cleanup; wired in enrich-day, quality Step 4d, terminalCleanup 1e.

## Tests

`supabase/functions/_shared/__tests__/orphan-transit.test.ts` (9 cases): logistics exemptions, end-of-day drop, mid-day Case 2, departure-kind exemption, diacritic match, majority match, negative over-trigger guard.
