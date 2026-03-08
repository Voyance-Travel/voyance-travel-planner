

## Multi-City Generation: Per-City Progress Tracking

### What's Actually Happening
The backend **already auto-chains** day-by-day across all cities (London → Paris → Rome). The self-chain loop in `generate-trip-day` works correctly. The problem is purely a **progress visibility** issue — users can't see which city is generating, and the `trip_cities.generation_status` column (which already exists in the DB) is never updated.

### Database
No migration needed — `trip_cities.generation_status` column already exists with default `'pending'`.

### Changes

**File 1: `supabase/functions/generate-itinerary/index.ts`**

**A. Heartbeat includes current city (line ~12845-12857)**
Add `generation_current_city: cityInfo?.cityName || null` to the metadata heartbeat write. The `cityInfo` from `dayCityMap` is already resolved at this point.

**B. Mark city 'generating' on first day of each city (after heartbeat, ~12857)**
When `dayNumber` is the first day of a new city (detected by comparing `dayCityMap[dayNumber-1]` vs `dayCityMap[dayNumber-2]`), update `trip_cities` row:
```sql
UPDATE trip_cities SET generation_status = 'generating' WHERE trip_id = ? AND city_name = ?
```

**C. Mark city 'generated' on last day of each city (after day save, ~13091-13123)**
After saving a day, check if next day belongs to a different city. If so, mark current city as `'generated'`. On final day (`dayNumber >= totalDays`), also mark last city as `'generated'`. Add to both the completion branch and the self-chain branch:
```typescript
if (isMultiCity && dayCityMap) {
  const cityInfo = dayCityMap[dayNumber - 1];
  const nextCityInfo = dayNumber < totalDays ? dayCityMap[dayNumber] : null;
  if (cityInfo && (!nextCityInfo || nextCityInfo.cityName !== cityInfo.cityName)) {
    await supabase.from('trip_cities')
      .update({ generation_status: 'generated' } as any)
      .eq('trip_id', tripId)
      .eq('city_name', cityInfo.cityName);
  }
}
```

**D. Include current city in both metadata writes (lines ~13097-13103 and ~13117-13122)**
Add `generation_current_city: null` (completion) or `generation_current_city: dayCityMap?.[dayNumber]?.cityName || null` (self-chain) to both metadata update blocks.

---

**File 2: `src/hooks/useGenerationPoller.ts`**

**A. Add `currentCity` to `GenerationPollState` interface (line ~27)**
```typescript
currentCity?: string | null;
```

**B. Extract current city from metadata in poll (line ~113)**
```typescript
const currentCity = (meta.generation_current_city as string) || null;
```

**C. Pass `currentCity` through all `setState` calls**
Add `currentCity` to every `setState({...})` call (polling, ready, failed, stalled states).

**D. Add `trip_cities` subscription to realtime channel (line ~346)**
Add a second `postgres_changes` listener for `trip_cities` table filtered by `trip_id`:
```typescript
.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'trip_cities',
  filter: `trip_id=eq.${tripId}`,
}, () => { poll(); })
```

---

**File 3: `src/components/planner/shared/GenerationPhases.tsx`**

**A. Add props for multi-city progress (line ~23)**
```typescript
interface GenerationPhasesProps {
  // ... existing
  currentCity?: string | null;
  isMultiCity?: boolean;
  tripCities?: Array<{ city_name: string; generation_status: string }>;
}
```

**B. Show current city in header text (line ~273-277)**
Update `headerText` to include city name when multi-city:
```typescript
const headerText = allVisibleDaysDone
  ? 'Finalizing your itinerary…'
  : displayCompletedDays === 0
    ? `Crafting Day 1 of ${totalDays > 0 ? totalDays : 'your trip'}${currentCity ? ` — ${currentCity}` : ''}`
    : `Building Day ${nextDay} of ${totalDays}${currentCity ? ` — ${currentCity}` : ''}`;
```

**C. Add city checklist below progress bar (after line ~322)**
For multi-city trips, show a horizontal row of city badges with status icons:
- ✓ green check = `generated`
- ⟳ spinning = `generating`  
- ○ muted circle = `pending`

```tsx
{isMultiCity && tripCities && tripCities.length > 1 && (
  <div className="flex items-center gap-2 mb-4 justify-center flex-wrap">
    {tripCities.map((city, i) => (
      <div key={i} className="flex items-center gap-1 text-xs">
        {city.generation_status === 'generated' ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : city.generation_status === 'generating' ? (
          <Loader2 className="h-3 w-3 text-primary animate-spin" />
        ) : (
          <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />
        )}
        <span className={city.generation_status === 'generated' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
          {city.city_name}
        </span>
      </div>
    ))}
  </div>
)}
```

---

**File 4: `src/components/itinerary/ItineraryGenerator.tsx` (line ~1136-1145)**

Pass new props to `GenerationPhases`:
- Fetch `tripCities` using the existing `useTripCities` hook (already imported patterns exist)
- Pass `currentCity={poller.currentCity}`, `isMultiCity={isMultiCity}`, `tripCities={tripCitiesData}`

**File 5: `src/pages/TripDetail.tsx` (line ~1623-1632)**

Same — pass `currentCity`, `isMultiCity`, `tripCities` to the `GenerationPhases` component used in the TripDetail generation view.

---

### What stays the same
- Day-by-day self-chaining logic — already works across cities
- AI prompts, credit deduction, enrichment — unchanged
- Stall detection and auto-resume — unchanged
- totalDays calculation — backend already writes corrected value to `generation_total_days` and poller already reads it

### Files to modify
| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add city tracking to heartbeat + mark city generating/generated |
| `src/hooks/useGenerationPoller.ts` | Expose `currentCity`, subscribe to `trip_cities` realtime |
| `src/components/planner/shared/GenerationPhases.tsx` | Show city name in header + city checklist |
| `src/components/itinerary/ItineraryGenerator.tsx` | Pass city props to GenerationPhases |
| `src/pages/TripDetail.tsx` | Pass city props to GenerationPhases |

