

## Raise Michelin Price Floor in repair-costs + Preserve Fine Dining Dedup

### Root Cause

The sanitization floor logic in `sanitization.ts` (lines 595–639) correctly sets Belcanto to €180. However, `action-repair-costs.ts` runs AFTER sanitization and writes to the `activity_costs` table using generic `cost_reference` lookups. It has NO Michelin floor logic. The UI's Payments tab reads from `activity_costs`, so the sanitized floor gets overwritten with the reference table's generic dining value (~€166 or whatever the reference says).

### Plan

#### 1. Add Michelin floor enforcement to `action-repair-costs.ts`

After the cost-reference lookup (around line 176), before pushing to `rows`, add the same Michelin-aware floor logic:

- Define `knownMichelinHigh` / `knownMichelinMid` / `knownUpscale` regexes (same as sanitization.ts) and per-star floor constants
- After resolving `costPerPerson` from reference tables, check if the activity matches a known Michelin restaurant and enforce the floor
- This ensures `activity_costs` rows respect the same minimums as the JSONB data

#### 2. Extract shared Michelin floor constants

To avoid duplication, extract the Michelin regexes and floor constants into a shared export from `sanitization.ts`:

```typescript
export const KNOWN_MICHELIN_HIGH = /\b(belcanto|feitoria|fifty\s*seconds|fortaleza\s*do\s*guincho)\b/i;
export const KNOWN_MICHELIN_MID = /\b(alma|eleven|epur|cura|loco|eneko|...)\b/i;
export const KNOWN_UPSCALE = /\b(il\s*gallo|ceia|enoteca|...)\b/i;
export const MICHELIN_FLOOR = { high: 180, mid: 120, upscale: 60 };
```

Then import and use in both `sanitization.ts` and `action-repair-costs.ts`.

#### 3. No changes to fine dining dedup

The `deduplicateEveningFineDining` logic in `sanitization.ts` (lines 683–720) is already working correctly and will be preserved as-is.

#### 4. No prompt changes needed

The prompt rules in `compile-prompt.ts` already include Michelin pricing minimums and single-dinner-per-evening rules.

### Files to edit

| File | Change |
|------|--------|
| `sanitization.ts` | Export Michelin floor constants and regexes as shared constants |
| `action-repair-costs.ts` | Import shared constants; apply Michelin floor after cost-reference lookup |

### Verification

- Generate a Lisbon trip → Belcanto should be ≥€180/pp in both the itinerary view AND the Payments tab
- Check `activity_costs` table rows for Michelin restaurants — all should respect per-star floors
- Double fine dining dedup continues to work (no regression)
