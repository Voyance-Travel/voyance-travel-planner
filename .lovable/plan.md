

## Fix: Consistent Hotel Placeholder When None Provided

### Problem
When no hotel is selected, `hotelName` and `hotelAddress` stay empty. The AI has no constraint, so it hallucates a different luxury hotel each day (Conrad, Peninsula, Four Seasons, etc.).

### Fix
Replace lines 428–431 in `supabase/functions/generate-itinerary/flight-hotel-context.ts` with a placeholder that sets `hotelName = 'Your Hotel'` and adds explicit AI prompt instructions to never invent hotel names.

### Changes

**File: `supabase/functions/generate-itinerary/flight-hotel-context.ts` (lines 428–431)**

Replace the current warning-only block:
```typescript
} else if (!hotel) {
  console.log(`[FlightHotel] ⚠️ NO HOTEL DATA FOUND - hotel_selection is empty or missing`);
  console.log(`[FlightHotel] Raw hotel_selection value:`, JSON.stringify(hotelRaw));
}
```

With:
```typescript
} else if (!hotel) {
  console.log(`[FlightHotel] ⚠ NO HOTEL DATA FOUND - using placeholder`);
  hotelName = 'Your Hotel';
  hotelAddress = '';
  sections.push(`\n${'='.repeat(40)}\n ACCOMMODATION (Placeholder)\n${'='.repeat(40)}`);
  sections.push(`  🏨 Hotel: Your Hotel (not yet selected)`);
  sections.push(`  ⚠️ IMPORTANT: The traveler has NOT selected a hotel yet.`);
  sections.push(`  - Use "Your Hotel" as the hotel name in ALL days consistently.`);
  sections.push(`  - Do NOT invent or suggest specific hotel names.`);
  sections.push(`  - Do NOT generate "Breakfast at [Hotel Name]" cards — instead use "Breakfast at Your Hotel".`);
  sections.push(`  - Do NOT generate hotel-specific tips (lobby views, spa access, etc).`);
  sections.push(`  - Freshen-up and return cards should reference "Your Hotel" only.`);
}
```

Then **redeploy** the `generate-itinerary` edge function.

