

## Cross-Day Venue Deduplication — Assessment

### Already Implemented

The exact scenario described ("Tuileries Garden" vs "Jardin des Tuileries") is explicitly handled:

| Mechanism | Location | What It Does |
|---|---|---|
| **Venue Alias Map** | `generation-utils.ts:116-118` | Maps both `"tuileries garden"` and `"jardin des tuileries"` → `"tuileries"` |
| **Alias Resolution in Match** | `generation-utils.ts:374-376` | `venueNamesMatch()` resolves both names to their alias before comparing |
| **Diacritics Stripping** | `generation-utils.ts:64-73` | `normalizeVenueName()` strips accents (é→e, etc.) |
| **Word-Overlap Fallback** | `generation-utils.ts:380-385` | 50-80% word overlap catches names not in the alias map |
| **Substring Containment** | `generation-utils.ts:378` | Catches partial matches like "Louvre" vs "Louvre Museum" |
| **Cross-Day Execution** | `universal-quality-pass.ts:93-115` | Runs dedup against `usedVenueNames` from all previous days |
| **Venue Accumulation** | `universal-quality-pass.ts:143-152` | After each day, adds venues to the shared set for next day's dedup |

The alias map already covers 80+ venues across Paris, Rome, London, Tokyo, Barcelona, Berlin, and more — all with bilingual variant resolution.

### Conclusion

**No changes needed.** The "Tuileries Garden" / "Jardin des Tuileries" case is handled by an explicit alias entry. If this dedup is still not firing in practice, the issue would be in how `usedVenueNames` is passed between days in the orchestrator — but the matching logic itself is correct and comprehensive.

