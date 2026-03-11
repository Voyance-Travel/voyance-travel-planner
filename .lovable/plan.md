

## Fix 22P: Three Minor Issues

### Issue 1: Enforce `blockedWindows` in compiler

Add Step 5e in `compile-day-schema.ts` (both edge function and src copies) between keep-activities and conflict resolution. For each blocked window, remove or shrink empty slots that overlap.

**New helper function** `applyBlockedWindows(slots, blockedWindows)`:
- For each empty slot with a timeWindow, check overlap against each blocked window
- Full overlap → remove the slot
- Partial overlap → shrink the timeWindow to exclude the blocked period
- Filled/locked slots are never touched
- Re-index positions after removals

**Files to edit (2):**
- `supabase/functions/generate-itinerary/schema/compile-day-schema.ts` — add inline helper + Step 5e call
- `src/lib/schema-compiler/compile-day-schema.ts` — same

### Issue 2: Add missing fields to `SerializerContext` interface

Add the 4 extra fields that `index.ts` already passes but the interface doesn't declare:

```typescript
transportPreferences?: string;
voyancePicks?: string;
tripTypeContext?: string;
collaboratorAttribution?: string;
```

**Files to edit (2):**
- `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts` — add fields to `SerializerContext`
- `src/lib/schema-compiler/schema-to-prompt.ts` — same

### Issue 3: Fix `aiCallMs` timing

Capture `aiCallStart` right before the AI fetch loop (line ~8236) and use it instead of `compileStart` in the validation block.

**File to edit (1):**
- `supabase/functions/generate-itinerary/index.ts`
  - Add `let aiCallStart = Date.now();` before line 8236 (`try { let data...`)
  - Change line 8423 from `Date.now() - (compileStart || Date.now())` to `Date.now() - aiCallStart`

### Summary: 5 file edits total (no new files)

