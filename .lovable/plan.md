

## Fix Phantom Pricing on Gardens and Viewpoints

### Problem
"Peaceful Outlook at Jardim do Recolhimento" priced at ~€23/pp despite being a free public garden. The existing tier1FreePatterns already include `jardim` and `garden`, but two gaps exist:
1. Missing keywords: `outlook`, `vista`, `panoram` (the title says "Outlook")
2. The `<= 30` cost cap on line 324 may exclude activities where cost is stored as a group total (e.g., 2 travelers × €23 = €46)
3. No exclusion for paid experiences (guided tours, ticketed gardens)

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

**Change 1: Expand tier1FreePatterns** (line 321)
Add missing keywords to the existing regex:
- `outlook`, `vista`, `panoram` (viewpoint variants)
- `evening\s+(?:walk|stroll)`, `morning\s+(?:walk|stroll)`, `historic\s+walk` (walk variants — note: `stroll` and `walk` are already there, but compound forms aren't)

**Change 2: Raise cost cap for tier1** (line 324)
Change `act.cost.amount <= 30` to `act.cost.amount <= 50` for the outer condition. This catches cases where the cost might be stored as a group total for 2 travelers. Tier1 venues (parks, gardens, viewpoints) are high-confidence free, so a higher cap is safe.

**Change 3: Add paid experience exclusion** (inside the tier1 check, after line 344)
Before zeroing the cost, check that the activity isn't a paid experience:
```
const isPaidExperience = (act as any).booking_required ||
  /\b(tour|guided|ticket|admission|entry|botanical|botânico|botanico)\b/i.test(allTextFields);
```
If `isPaidExperience` is true, skip the free override. This protects botanical gardens, guided tours, and ticketed attractions.

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — expand tier1 keywords, raise cost cap, add paid experience exclusion

### Verification
Generate a 4-day Lisbon trip. Gardens (Jardim), viewpoints (Miradouro), and public outlook points should be Free. Paid attractions (museums, botanical gardens, guided tours) should retain prices.

