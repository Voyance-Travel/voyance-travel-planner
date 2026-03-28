

## Fix: Suppress False Hours Warnings (Blue Note Case)

**Problem**: The hours data "Thursday: Open 06:00–10:30" is clearly wrong for a jazz club with evening performances. The system trusts it blindly and shows a scary amber warning.

**Root cause**: `isVenueOpenOnDay()` in `truth-anchors.ts` parses hours and flags conflicts without any plausibility check. Google Places sometimes returns incorrect hours (especially for venues with irregular schedules like live music clubs).

---

### Fix: Add hours plausibility guard

**File: `supabase/functions/generate-itinerary/truth-anchors.ts`** — in `isVenueOpenOnDay()` (line ~466), before returning the "not within range" violation:

Add a check: if ALL parsed time ranges close before noon (720 mins) AND the scheduled time is evening (≥17:00 / 1020 mins), the hours data is almost certainly wrong. Return `isOpen: true` instead of flagging a violation.

```typescript
if (!withinRange) {
  // Plausibility guard: if hours show venue closing before noon
  // but activity is scheduled for evening, the hours data is suspect
  const allCloseBeforeNoon = timeRanges.every(r => {
    const effectiveClose = r.close <= r.open ? r.close + 1440 : r.close;
    return effectiveClose <= 720; // noon
  });
  if (allCloseBeforeNoon && scheduledMins >= 1020) { // 17:00+
    // Hours data is implausible for an evening activity — suppress warning
    return { isOpen: true };
  }
  
  return { isOpen: false, reason: `...` };
}
```

This catches the exact pattern: morning-only hours (06:00–10:30) with an evening activity (20:45). It won't affect legitimate warnings like a museum closing at 5 PM when scheduled at 6 PM.

**Additionally**, in `index.ts` Stage 4.5 (line ~7327), add the same category-aware guard: for categories like `nightlife`, `entertainment`, `bar`, `jazz`, `club` — if the hours look implausible (close before noon), skip the closedRisk tag entirely.

---

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/truth-anchors.ts` | Add plausibility guard in `isVenueOpenOnDay()` — suppress false violations when hours close before noon but activity is evening |
| `supabase/functions/generate-itinerary/index.ts` | Add category-aware plausibility check in Stage 4.5 before tagging `closedRisk` |

