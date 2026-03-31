

## Fix: Replace Fabricated Hotel Names with "Your Hotel" Instead of Deleting Activities

### Problem
When no hotel is booked, the AI fabricates specific hotel names (e.g., "The Pantheon Iconic Rome Hotel") instead of using "Your Hotel". Currently, `stripPhantomHotelActivities` **deletes** matching activities, breaking the day's schedule structure. Also, `FABRICATED_HOTEL_RE` only matches known luxury brands and misses many fabricated names.

### Fix

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Two changes:

**1. Add a broad fabricated-hotel-name regex** that catches any proper-noun hotel pattern, not just known luxury brands:

```typescript
// Broad pattern: any proper-noun hotel name that isn't "Your Hotel" / "The Hotel"
const BROAD_HOTEL_NAME_RE = /(?:The\s+)?(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Hotel|Resort|Inn|Suites?|Lodge|Palace|Boutique\s+Hotel)\b/g;
```

**2. Change `stripPhantomHotelActivities` from deleting activities to replacing fabricated names with "Your Hotel"**. Instead of filtering out activities, iterate and do in-place replacement on `title`, `name`, `description`, and `location`:

```typescript
export function stripPhantomHotelActivities(day: any, hasHotel: boolean): any {
  if (!day || hasHotel || !Array.isArray(day.activities)) return day;

  let replacements = 0;
  for (const act of day.activities) {
    if (!act) continue;
    const title = act.title || act.name || '';
    // Skip already-generic placeholders
    if (isGenericPlaceholder(title)) continue;

    // Replace fabricated hotel names in all text fields
    for (const field of ['title', 'name', 'description', 'location']) {
      if (typeof act[field] === 'string' && (FABRICATED_HOTEL_RE.test(act[field]) || BROAD_HOTEL_NAME_RE.test(act[field]))) {
        act[field] = act[field]
          .replace(FABRICATED_HOTEL_RE, 'Your Hotel')
          .replace(BROAD_HOTEL_NAME_RE, 'Your Hotel');
        replacements++;
      }
    }
  }

  if (replacements > 0) {
    console.log(`[stripPhantomHotelActivities] Replaced fabricated hotel names in ${replacements} fields with "Your Hotel"`);
  }
  return day;
}
```

The broad regex is guarded by: (a) only runs when `hasHotel === false`, (b) skips activities already matching generic placeholders, (c) won't match "Your Hotel" or "The Hotel" (no proper-noun word before "Hotel").

### Summary

| File | Change |
|---|---|
| `sanitization.ts` | Add broad fabricated-hotel regex; change from deleting activities to replacing names with "Your Hotel" |

