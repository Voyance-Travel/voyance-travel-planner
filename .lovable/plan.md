

## Fix: Remove Phantom Hotels When No Hotel Is Booked

The function `stripPhantomHotelActivities` does not exist anywhere in the codebase. It needs to be created in `sanitization.ts` and called in the `generate-trip-day` handler after the day result is received.

### Changes

**1. `supabase/functions/generate-itinerary/sanitization.ts` — Add `stripPhantomHotelActivities`**

New exported function that removes fabricated hotel activities when no hotel is booked:

```typescript
export function stripPhantomHotelActivities(day: any, hasHotel: boolean): any {
  if (!day || hasHotel || !Array.isArray(day.activities)) return day;
  
  const PHANTOM_PATTERNS = [
    /\bcheck[\s-]?in\b/i,
    /\bcheck[\s-]?out\b/i,
    /\breturn to (?:the )?hotel\b/i,
    /\bhotel breakfast\b/i,
    /\bsettle into\b.*\bhotel\b/i,
    /\bfreshen up\b.*\bhotel\b/i,
  ];
  
  const PHANTOM_CATEGORIES = ['hotel_checkin', 'hotel_checkout', 'accommodation'];
  
  // Known luxury hotel brand patterns the AI fabricates
  const FABRICATED_HOTEL_RE = /\b(?:Hotel\s+Le\s+\w+|Le\s+Meurice|The\s+Peninsula|Ritz|Four\s+Seasons|Mandarin\s+Oriental|St\.\s*Regis|Park\s+Hyatt|Aman|Rosewood)\b/i;
  
  day.activities = day.activities.filter((act: any) => {
    if (!act) return false;
    const title = (act.title || act.name || '').toLowerCase();
    const category = (act.category || '').toLowerCase();
    
    // Remove by category
    if (PHANTOM_CATEGORIES.includes(category)) return false;
    
    // Remove by title pattern
    if (PHANTOM_PATTERNS.some(re => re.test(title))) return false;
    
    // Remove activities referencing fabricated hotel names
    if (FABRICATED_HOTEL_RE.test(act.title || '') || FABRICATED_HOTEL_RE.test(act.description || '')) return false;
    
    return true;
  });
  
  return day;
}
```

**2. `supabase/functions/generate-itinerary/index.ts` — Wire it in the `generate-trip-day` handler**

Two changes:

a) **Load `hotel_selection`** — At ~line 12905 where trip data is fetched, add `hotel_selection` to the select:
```
.select('itinerary_status, metadata, itinerary_data, hotel_selection')
```

b) **Call stripPhantomHotelActivities** — After `dayResult` is received successfully (~line 13066), determine `hasHotel` and strip phantoms:
```typescript
// Determine if user actually booked a hotel
const hasHotel = !!(tripCheck as any).hotel_selection || !!(cityInfo?.hotelName);

// Strip phantom hotel activities if no hotel booked
if (!hasHotel) {
  const { stripPhantomHotelActivities } = await import('./sanitization.ts');
  dayResult = stripPhantomHotelActivities(dayResult, false);
}
```

c) **Add to imports** — Add `stripPhantomHotelActivities` to the existing sanitization import at line 22-28.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/sanitization.ts` | Add `stripPhantomHotelActivities` function |
| `supabase/functions/generate-itinerary/index.ts` | Import new function, load `hotel_selection` in trip query, call strip after day generation |

