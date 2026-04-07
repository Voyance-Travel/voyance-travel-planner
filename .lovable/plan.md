

## Cross-Day Venue Dedup — Assessment

### Current State

The codebase already has **two layers** of cross-day venue dedup that fully cover the user's spec:

#### 1. Prompt-Level Blocklist (compile-prompt.ts, lines 1079-1093)
Already injects a "VENUE DEDUP — DO NOT REVISIT THESE LOCATIONS" block into the AI prompt with the full list of used venues. This matches the user's `buildVenueBlocklistPrompt` concept but is more detailed (includes guidance about name variations like "Louvre Museum" vs "Louvre Museum Exploration").

#### 2. Post-Generation Dedup (universal-quality-pass.ts, Step 7)
Already filters activities against `usedVenueNames` set using fuzzy matching (`venueNamesMatch` with 80% word-overlap threshold). This is **more robust** than the user's `removeRepeatedVenues` which uses exact `Set.has()` — the current code catches near-matches like "Sagrada Familia" vs "La Sagrada Familia".

### Comparison

| Feature | User Spec | Current Code |
|---|---|---|
| Prompt blocklist | `buildVenueBlocklistPrompt` — simple list | `compile-prompt.ts` — detailed with anti-variation guidance ✓ |
| Post-gen filter | `removeRepeatedVenues` — exact match via `Set.has()` | `universal-quality-pass.ts` Step 7 — fuzzy match via `venueNamesMatch` ✓ |
| Skip categories | STAY, TRANSPORT, TRAVEL, FLIGHT | Same + LOGISTICS, ACCOMMODATION ✓ |
| Skip dining | Not handled | Skips dining/restaurant (handled by separate restaurant dedup) ✓ |
| Hotel exclusion | `venue === 'your hotel'` | Same ✓ |
| Venue tracking | Not shown | Step 9 updates `usedVenueNames` set after each day ✓ |

### Conclusion

**No changes needed.** The current implementation is a strict superset of the user's spec — it has fuzzy matching instead of exact matching, richer prompt injection, and additional category exclusions. Changing to exact `Set.has()` would be a regression.

