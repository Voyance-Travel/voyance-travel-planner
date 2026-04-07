

## "Wire Everything Together" — Assessment

### Already Wired

Both generation pipelines already call `universalQualityPass()` **inline**, exactly in the order you specified:

| Pipeline | File | Lines | Call Site |
|---|---|---|---|
| **Single-day** (`generate-day`) | `action-generate-day.ts` | 340–361 | Called right after AI response parsing + normalization |
| **Trip orchestrator** (`generate-trip-day`) | `action-generate-trip-day.ts` | 1012–1036 | Called after sanitization, validate/repair, and restaurant dedup |

### What `universalQualityPass()` runs (in order)

Inside `universal-quality-pass.ts`, the exact sequence matches your spec:

1. **Timing** — `enforceArrivalTiming()` (Day 1) and `enforceDepartureTiming()` (last day)
2. **Cross-day venue dedup** — fuzzy match against `usedVenueNames` from all prior days
3. **Placeholders** — `fixPlaceholdersForDay()` replaces generic meals with real restaurants via AI re-prompting + fallback database
4. **Pricing** — `checkAndApplyFreeVenue()`, `enforceMarketDiningCap()`, `enforceBarNightcapPriceCap()`, `enforceCasualVenuePriceCap()`, `enforceVenueTypePriceCap()`, `enforceTicketedAttractionPricing()`, `enforceMichelinPriceFloor()`
5. **Hotel return injection** — adds "Return to Your Hotel" at end of non-departure days
6. **Used venue accumulation** — populates `usedVenueNames` set for next day's dedup

### Not Dead Code

The concern about "standalone validator functions that never get called" does not apply here. Both `action-generate-day.ts:344` and `action-generate-trip-day.ts:1014` dynamically import and invoke `universalQualityPass()`. The orchestrator (`action-generate-trip-day.ts`) additionally runs its own restaurant-specific dedup at lines 956–1009 *before* the universal pass, giving dining double coverage.

### Conclusion

**No changes needed.** All four fixes are already wired inline in both generation code paths, running in the correct order after AI response parsing.

