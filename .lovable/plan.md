## Objective
Stop the automatic full-regeneration of itineraries on page load in `TripDetail.tsx`. The LLM produces different content on every call, so a silent auto-resume overwrites the user's saved itinerary with different restaurants, activities, themes, and prices (Dublin bug, 2026-05-14). The user must explicitly click "Regenerate".

## Changes

### File: `src/pages/TripDetail.tsx`

#### Change 1 — Disable auto-resume for incomplete trips (lines 1674-1686)

Replace this block:

```typescript
if (expectedTotal > 0 && actualDays > 0 && actualDays < expectedTotal) {
  console.warn(`[TripDetail] Self-heal: trip marked ready but only ${actualDays}/${expectedTotal} days. Triggering resume.`);
  // Auto-retry once before showing stalled UI to the user
  if (!autoResumeAttemptedRef.current) {
    autoResumeAttemptedRef.current = true;
    console.log('[TripDetail] Auto-resuming incomplete generation (first attempt)');
    setTimeout(() => {
      handleResumeGeneration();
    }, 1500);
  } else {
    setGenerationStalled(true);
  }
}
```

With:

```typescript
if (expectedTotal > 0 && actualDays > 0 && actualDays < expectedTotal) {
  console.warn(`[TripDetail] Self-heal: trip marked ready but only ${actualDays}/${expectedTotal} days. NOT auto-resuming — user must click Regenerate. Setting stalled UI.`);
  // Do NOT auto-fire generate-trip on page load. The LLM produces different
  // content each call and a silent regen overwrites the user's existing
  // itinerary with entirely different restaurants/activities/themes (Dublin
  // bug, 2026-05-14). The user must explicitly opt in.
  setGenerationStalled(true);
}
```

#### Change 2 — Disable auto-resume for failed trips (lines 1897-1906)

Replace this block:

```typescript
if (expectedTotal > 0 && actualDays === 0) {
  if (!autoResumeAttemptedRef.current) {
    autoResumeAttemptedRef.current = true;
    console.warn('[TripDetail] Self-heal: trip failed with 0 days. Auto-resuming once.');
    setTimeout(() => { handleResumeGeneration(); }, 1500);
  } else {
    console.warn('[TripDetail] Self-heal: trip still failed after auto-resume. Showing stalled UI.');
    setGenerationStalled(true);
  }
}
```

With:

```typescript
if (expectedTotal > 0 && actualDays === 0) {
  console.warn('[TripDetail] Self-heal: trip failed with 0 days. NOT auto-resuming — user must click Regenerate.');
  setGenerationStalled(true);
}
```

## Out of scope
- `handleResumeGeneration` function itself — still used for explicit user-clicked "Regenerate"
- Queued-leg self-heal (line ~784)
- Stuck-leg self-heal (line ~967)

## Acceptance criteria (post-implementation grep checks)
1. `grep -n "Auto-resuming incomplete generation" src/pages/TripDetail.tsx` → 0 hits
2. `grep -n "NOT auto-resuming" src/pages/TripDetail.tsx` → 2 hits
3. `grep -n "setTimeout(() => { handleResumeGeneration" src/pages/TripDetail.tsx` → 0 hits
4. `grep -c "handleResumeGeneration" src/pages/TripDetail.tsx` → ≥2 hits (function definition + explicit click handler)
5. `autoResumeAttemptedRef` no longer referenced inside the two blocks above

## Post-deploy test
Open the Dublin trip URL. Hard refresh. The itinerary must NOT change on reload. The same pre-refresh content must persist. If the trip is genuinely incomplete, a stalled banner shows with a "Regenerate" button the user must click.