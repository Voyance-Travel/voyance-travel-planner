I agree: once the itinerary says checkout and depart for the flight, the only valid next step is airport/station logistics. No stroll, lunch, shopping, or sightseeing should appear after that point.

Plan:

1. Add a hard departure-barrier cleanup in the backend repair pipeline
   - In the itinerary day repair code, treat the first checkout/airport-transfer/security/flight sequence as a terminal chain on departure days.
   - Remove AI-generated non-logistics activities that appear after checkout when a flight/train departure exists.
   - Preserve only true logistics after checkout: transfer to airport/station, security/boarding, flight/train card.
   - Never delete user-locked activities; instead flag them as a blocking sequencing warning so the presentation gate can show that the user’s locked item conflicts with departure logistics.

2. Re-run sequence repair after injected departure cards
   - The current repair runs before the guaranteed airport-transfer/flight cards are injected, so it can miss the exact failure you’re seeing.
   - After checkout and departure transport are guaranteed, run the departure sequence repair again so newly injected cards become hard barriers too.

3. Strengthen the final save-time safety net
   - Add the same departure-day barrier to `save-itinerary`, so even if a generation path misses it, the persisted itinerary is cleaned before the user sees it.
   - This catches full-trip generation, single-day regeneration, and any manual save path consistently.

4. Tighten prompt instructions so the model stops producing the bad pattern
   - Update departure-day prompt language from “don’t schedule after departure buffer” to “after checkout, only airport/station logistics may follow.”
   - Explicit valid order:

```text
breakfast / final short nearby item
checkout
transfer to airport/station
security / boarding
flight/train
```

   - Explicit invalid order:

```text
checkout
transfer/depart for flight
lunch / stroll / museum / shopping
airport
```

5. Add regression coverage
   - Add a test fixture with: checkout, departure transfer, lunch, stroll, flight.
   - Assert lunch/stroll are removed or blocked, and final order is checkout -> transfer -> flight.

Files I expect to touch:
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/universal-quality-pass.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- Existing/new itinerary generation tests around departure sequencing