

## Fix: "Just Tell Us" Chat Path Skips Journey Split for Multi-City Trips

### Problem

The multi-city form builder path (line 2606 in `Start.tsx`) calls `splitJourneyIfNeeded()` to break 8+ day, 2+ city trips into linked journey legs. But the "Just Tell Us" chat path (line 3046) creates the trip and navigates directly to `/trip/${trip.id}?generate=true` — it **never calls `splitJourneyIfNeeded`**. This means multi-city trips created via chat are treated as monolithic single trips instead of being split into separate linked legs.

### Fix

**File: `src/pages/Start.tsx`** — In the `onChatDetailsExtracted` handler, after collaborator insertion (~line 3044) and before navigation (line 3046), add the same journey split logic used by the form path:

```typescript
// After collaborator insertion, before navigation:
if (isChatMultiCity && chatCities.length >= 2) {
  try {
    const splitResult = await splitJourneyIfNeeded(
      trip.id,
      chatCities.map((c, i) => ({
        city: c.name,
        country: c.country || '',
        nights: c.nights,
      })),
      (details.cityTransports || []).map((t, i) => ({
        type: t,
        fromCity: chatCities[i]?.name,
        toCity: chatCities[i + 1]?.name,
      })),
      format(chatStartDate, 'yyyy-MM-dd'),
      format(chatEndDate, 'yyyy-MM-dd'),
    );

    if (splitResult.didSplit) {
      toast.success(`Journey created: ${splitResult.legCount} legs`);
      navigate(`/trip/${splitResult.firstLegTripId}?generate=true`);
      return;
    }
  } catch (splitErr) {
    console.warn('[Start] Chat journey split failed, proceeding as single trip:', splitErr);
  }
}

navigate(`/trip/${trip.id}?generate=true`);
```

### What this achieves
- Multi-city trips from "Just Tell Us" get split into linked journey legs (same as form path)
- Each leg generates its own itinerary sequentially via the existing journey chain
- Users are charged once for the full trip, but see one leg at a time
- Falls back gracefully to single-trip if split fails or conditions aren't met (< 8 days or < 2 cities)

### Files to modify

| File | Change |
|------|--------|
| `src/pages/Start.tsx` | Add `splitJourneyIfNeeded` call in `onChatDetailsExtracted` before navigation |

