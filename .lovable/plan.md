

## Fix: Morning Hotel Phantom Activities on Hotel-Change Days

### Problem
On Day 3 (a hotel-change day: Four Seasons Ritz → Palácio Ludovice), two "Return to Hotel" activities appear at 12:07 AM and 12:22 AM at the start of the day. These are nonsensical — the traveler woke up at the hotel, they don't need to "return" at midnight.

**Root cause**: The morning phantom strip in `repairBookends` (line 2333) explicitly skips hotel-change days (`!isHotelChange`). This was likely to preserve legitimate check-in/checkout activities on transition days, but it also lets through phantom "Return to Hotel" activities with midnight timestamps.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (lines 2329-2359)

Modify the morning phantom strip to also run on hotel-change days, but only strip accommodation activities that are clearly phantoms — specifically "Return to" and "Freshen Up" activities with pre-dawn times (before 06:00). Check-in/checkout activities are already excluded by the `!isCheckinOrCheckout` guard.

```typescript
// Line 2333: Change from:
if (!isFirstDay && !isDepartureDay && !isHotelChange) {

// To:
if (!isFirstDay && !isDepartureDay) {
```

Then inside the while loop, add an additional guard for hotel-change days: only strip if the activity has a pre-dawn time (before 06:00) to avoid removing legitimate mid-day activities like a new hotel check-in:

```typescript
if (isAccom(first) && isHotelRelated(first) && !isCheckinOrCheckout(first)) {
  // On hotel-change days, only strip if the activity is pre-dawn (phantom from AI)
  if (isHotelChange) {
    const startMins = parseTimeToMinutes(first.startTime || '08:00');
    if (startMins !== null && startMins >= 360) continue; // 06:00 — skip, likely legitimate
  }
  // ... existing removal logic
}
```

This ensures:
- Normal days: all morning hotel phantoms stripped (unchanged behavior)
- Hotel-change days: only pre-dawn (00:00-05:59) hotel phantoms stripped; legitimate activities like "Check-in at New Hotel" at 14:00 are preserved

### Files
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — modify morning phantom strip condition (~5 lines changed)

