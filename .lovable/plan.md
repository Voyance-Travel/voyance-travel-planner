

# Additive Revisions — What's Actually Missing

## Analysis of Current State

After reviewing all files, here's what already exists vs. what needs adding:

| Fix | Status | What's Missing |
|-----|--------|----------------|
| Fix 1 (CRITICAL REMINDERS 9-10) | **Missing** | Items 9 and 10 not yet added |
| Fix 2 (FAKE_ADDRESS_PATTERNS) | **Partially missing** | New city-name and country patterns not added |
| Fix 3 (BLOCKED_RESTAURANT_NAMES) | **Partially done** | Some names already added (sakura house, golden dragon, traditional house); ~10 still missing |
| Fix 3 (GENERIC_RESTAURANT_PATTERNS) | **Partially done** | 3 patterns exist but the paradise/heaven/delight pattern is missing; `isGenericRestaurantName` helper not needed (inline check already works) |
| Fix 4 (FAILSAFE_FALLBACKS) | **Mostly done** | Tokyo, Buenos Aires, Marrakech, Bangkok, Amsterdam already exist. **Casablanca is missing**. Format mismatch — prompt requests flat `{name, cuisine, price, address}` arrays but existing object uses `{name, neighborhood, address}` nested by meal type. Will add Casablanca in existing format. |
| Fix 4 (CITY_ALIASES) | **Partially done** | Latin-script aliases exist. Japanese/Arabic/Thai script aliases (東京, مراكش, กรุงเทพ, etc.) are missing |
| Fix 5 (hotelName in chat-trip-planner) | **Already done** | hotelName exists in both schema and system prompt |
| Fix 6 (PRE-PLANNED ITINERARY) | **Already done** | Full 10-rule block exists |
| Fix 6 (mustDoActivities description) | **Already done** | "Capture EVERYTHING" sentence present |

## Changes to Make

### File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

**1. Add CRITICAL REMINDERS items 9-10** (after line 1236, after item 8)

Append two new lines:
```
9. ACTIVITY COUNT CHECK: Every day must have minimum 3 paid activities + 2 free activities. If your output has fewer, you are under-generating. Add more.
10. MORNING GAP CHECK: If there is nothing between breakfast (8-9am) and lunch (12-1pm), you left a 3-hour gap. Fill it with at least 1 paid activity + 1 free activity.
```

### File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

**2. Add new FAKE_ADDRESS_PATTERNS entries** (append to array at ~line 851)

Add city-only name patterns and country-suffix pattern:
```
/^tokyo$/i, /^barcelona$/i, /^amsterdam$/i, /^lisbon$/i, /^bangkok$/i,
/^marrakech$/i, /^buenos aires$/i, /^new york$/i, /^dubai$/i, /^sydney$/i,
/^[a-z\s]+,?\s*(morocco|portugal|thailand|netherlands|argentina|australia|brazil|mexico|turkey|greece|croatia|czech republic|austria|hungary|poland|ireland|scotland|switzerland|belgium|norway|sweden|denmark|egypt|india|south korea|vietnam|colombia|peru|chile|south africa|kenya|singapore|malaysia|indonesia|philippines|new zealand|canada|united states|usa)$/i,
```

**3. Add missing BLOCKED_RESTAURANT_NAMES** (append to array at ~line 841)

Add only the entries not already present:
```
'tokyo kitchen', 'sushi paradise', 'le petit bistro', 'la maison',
'chez pierre', 'brasserie centrale', 'the local spot',
'hidden gem restaurant', 'authentic kitchen',
'sunset terrace', 'rooftop bar and grill',
```

**4. Add missing GENERIC_RESTAURANT_PATTERN** (append to array at ~line 847)

The `paradise/heaven/delight` pattern is not covered by existing patterns:
```
/\b(paradise|heaven|delight|oasis|haven|nirvana)\b/i,
```

**5. Add Casablanca to FAILSAFE_FALLBACKS** (after amsterdam entry, ~line 2031)

Add in existing format (nested by meal type with `{name, neighborhood, address}`):
```typescript
'casablanca': {
  breakfast: [
    { name: 'La Sqala', neighborhood: 'Old Medina', address: 'Blvd des Almohades, Casablanca' },
    { name: 'Café Basmane', neighborhood: 'Centre', address: 'Rue Mohammed El Qorri, Casablanca' },
  ],
  lunch: [
    { name: "Rick's Café", neighborhood: 'Old Medina', address: '248 Blvd Sour Jdid, Casablanca' },
    { name: 'Le Cabestan', neighborhood: 'Ain Diab', address: '90 Blvd de la Corniche, Casablanca' },
  ],
  dinner: [
    { name: 'La Bodega', neighborhood: 'Centre', address: '129 Rue Allal Ben Abdellah, Casablanca' },
    { name: 'Le Port de Pêche', neighborhood: 'Port', address: 'Port de Casablanca, Casablanca' },
  ],
},
```

**6. Add script-based CITY_ALIASES** (append to existing entries, ~line 2055)

```typescript
'casablanca': ['الدار البيضاء', 'casa'],
```
And add script aliases to existing entries:
- tokyo: add `'東京'`
- buenos aires: add `'ブエノスアイレス'` (though unlikely, included per prompt)
- bangkok: add `'กรุงเทพ'`, `'กรุงเทพมหานคร'`

### What's NOT changed
- No removals or rewrites of any existing entries
- No changes to chat-trip-planner (Fixes 5 and 6 already fully deployed)
- No structural changes to FAILSAFE_FALLBACKS format
- No changes to generation chain, streaming, validation, or auth

