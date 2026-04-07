

## Expand Free Venue Patterns

### What Changes

Two files need updating — the backend regex (single combined pattern) and the frontend pattern array — plus the corresponding test file.

### 1. Backend: `supabase/functions/generate-itinerary/sanitization.ts`

**Line 17 — `ALWAYS_FREE_VENUE_PATTERNS`**: Expand the single regex to add:
- Bridges: `pont\s+\w+|bridge`
- Religious (free entry): `basilique|cathédrale|église` (basilica/cathedral/church already present)
- Paris-specific free venues: `champs.?[eé]lys[eé]es|montmartre|sacr[eé].?c[oœ]ur|tuileries|champ\s+de\s+mars|palais.?royal.*garden`
- Walking patterns: `neighborhood\s+walk|seine.*walk|walk.*seine`
- Squares/promenades: `place\s+de|parc|esplanade` (some already in Tier 2, promote)
- Île Saint-Louis: `[iî]le\s+saint.?louis`

**Line 20 — `TIER2_FREE_VENUE_PATTERNS`**: Remove `bridge|promenade|boardwalk` from Tier 2 since they're being promoted to Tier 1 (always free).

**Line 23 — `PAID_EXPERIENCE_RE`**: Add `musée|orangerie|galerie` to the paid exclusion so museums inside free venues (e.g., l'Orangerie in Tuileries) are not zeroed.

### 2. Frontend: `src/lib/cost-estimation.ts`

**Lines 519-540 — `FREE_VENUE_PATTERNS` array**: Add new patterns:
- `/\bpont\s+\w+\b/i` and `/\bbridge\b/i`
- `/\bbasilique\b/i`, `/\bcath[eé]drale\b/i`, `/\b[eé]glise\b/i`, `/\bchurch\b/i`
- `/\bchamps.?[eé]lys[eé]es\b/i`, `/\bmontmartre\b/i`, `/\bsacr[eé].?c[oœ]ur\b/i`
- `/\btuileries\b/i`, `/\bchamp\s+de\s+mars\b/i`, `/\bpalais.?royal.*garden\b/i`
- `/\bseine.*walk|walk.*seine\b/i`, `/\bparc\b/i`
- `/\b[iî]le\s+saint.?louis\b/i`

**Lines 545-556 — `PAID_OVERRIDE_PATTERNS`**: Add `/\b(?:musée|orangerie|galerie)\b/i` to the ticketed attractions line.

### 3. Tests: `supabase/functions/generate-itinerary/sanitization_free_venue_test.ts`

Add test cases for:
- `Pont Neuf` → true
- `Sacré-Cœur` → true  
- `Champs-Élysées` → true
- `Tuileries Garden` → true
- `Musée de l'Orangerie` → false (paid exclusion)

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/sanitization.ts` | Expand `ALWAYS_FREE_VENUE_PATTERNS`, trim `TIER2`, add musée to `PAID_EXPERIENCE_RE` |
| `src/lib/cost-estimation.ts` | Add new patterns to `FREE_VENUE_PATTERNS`, add musée/orangerie to `PAID_OVERRIDE_PATTERNS` |
| `supabase/functions/generate-itinerary/sanitization_free_venue_test.ts` | Add test cases for new patterns |

### What We're NOT Changing
- `checkAndApplyFreeVenue` function logic — already works correctly with the expanded patterns
- `generation-core.ts` / `action-repair-costs.ts` — they import the shared pattern, so they get the expansion automatically

