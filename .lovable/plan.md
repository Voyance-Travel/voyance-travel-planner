

## Fix: End-of-Day Hotel Return Card Dropped by 23:30 Cutoff

### Root Cause

The repair pipeline has two "past 23:30" cutoff filters (lines 1780-1793 and 1843-1854) that drop any activity whose `startTime` exceeds 23:30. When dinner runs late (e.g., 8:45 PM → 11:15 PM as in the screenshot), the bookend-injected "Return to Hotel" card starts at ~11:35 PM, which exceeds the cutoff and gets silently dropped. The preceding transport card ("Travel to Hotel") starts at 11:15 PM, just under the cutoff, so it survives — leaving the day ending with a transport card but no accommodation card.

This affects all days (not just post-hotel-switch) where dinner ends late, but it's most visible after a hotel switch because the new hotel context makes it obvious.

### Fix

Exempt end-of-day "Return to Hotel" accommodation cards from the 23:30 cutoff. These are structural bookend cards that should always be preserved — a traveler always returns to their hotel at the end of the day, regardless of how late dinner runs.

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

At both cutoff filters (~line 1782 and ~line 1846), add an exemption for accommodation-category activities that are hotel returns (contain "return to" in title or are the last accommodation card). Specifically:

```typescript
// In both 23:30 cutoff filters, exempt structural end-of-day cards:
activities = activities.filter((act: any) => {
  const s = parseTimeToMinutes(act.startTime || '');
  if (s !== null && s > cutoff) {
    const cat = (act.category || '').toLowerCase();
    const title = (act.title || '').toLowerCase();
    // Exempt end-of-day hotel returns and their transport
    if (cat === 'accommodation' && (title.includes('return to') || title.includes('freshen up'))) {
      return true; // Keep structural bookend
    }
    if (cat === 'transport' || cat === 'transportation') {
      // Keep transport to hotel at end of day
      if (title.includes('hotel') || (act.location?.name || '').toLowerCase().includes('hotel')) {
        return true;
      }
    }
    // ... existing drop logic
    return false;
  }
  return true;
});
```

### Impact
- End-of-day "Return to Hotel" cards preserved even when dinner runs past 11 PM
- Transport-to-hotel cards also preserved (they're the bridge)
- Non-structural activities (sightseeing, dining) past 23:30 still correctly dropped
- Single file change, two filter blocks updated

### Files
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — exempt bookend cards from 23:30 cutoff

