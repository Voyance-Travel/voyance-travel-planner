

## Fix: Store & Display Real Local Knowledge Data

### 1. Database Migration
Add local knowledge columns to `destinations` table:
- `local_tips`, `safety_tips`, `best_neighborhoods`, `common_scams` (JSONB, default `'[]'`)
- `getting_around`, `food_scene`, `nightlife_info`, `dress_code`, `tipping_custom` (TEXT)
- `emergency_numbers` (JSONB)
- `last_local_knowledge_update` (TIMESTAMPTZ)

### 2. Edge Function — Save All Enriched Data
**File: `supabase/functions/enrich-destinations/index.ts`**

- **Lines 9-18**: Add `local_tips` and `getting_around` to the `Destination` interface
- **Line 70**: Update filter to also re-enrich destinations missing local tips: `.or('default_transport_modes.is.null,default_transport_modes.eq.[],local_tips.is.null,local_tips.eq.[]')`
- **Lines 120-133**: Expand the `updates` object to save all enriched fields (local_tips, safety_tips, getting_around, best_neighborhoods, food_scene, nightlife_info, dress_code, tipping_custom, common_scams, emergency_numbers, last_local_knowledge_update)

### 3. Update Destination Type
**File: `src/lib/destinations.ts`** (lines 23-38)

Add optional fields: `transportData`, `safetyTips`, `commonScams`, `foodScene`, `tippingCustom`, `dressCode`, `nightlifeInfo`, `bestNeighborhoods`, `emergencyNumbers`

### 4. Frontend — Map New DB Fields
**File: `src/pages/DestinationDetail.tsx`** (lines 134-150)

In the `useMemo` that converts `dbDestination`, parse and pass through the new fields (`local_tips`, `safety_tips`, `common_scams`, `best_neighborhoods`, `getting_around`, `food_scene`, `nightlife_info`, `dress_code`, `tipping_custom`, `emergency_numbers`) using type casts since types.ts auto-generates.

### 5. Frontend — Enhanced "Getting Around" Card
**File: `src/pages/DestinationDetail.tsx`** (lines 470-525)

Add `gettingAround` summary text above transport modes. Use it as fallback text when no transport data exists.

### 6. Frontend — Replace Local Tips Card + Add New Cards
**File: `src/pages/DestinationDetail.tsx`** (lines 528-544)

- Remove `sm:col-span-2` from Local Tips card
- Add new cards after Local Tips (only rendered when data exists):
  - **Customs & Etiquette** — tipping + dress code (uses `Wallet` icon already imported)
  - **Food & Dining** — food scene summary (emoji icon)
  - **Safety & Awareness** — safety tips + common scams (emoji icon)

### Summary of files changed
1. **DB migration** — add 11 columns to `destinations`
2. **`supabase/functions/enrich-destinations/index.ts`** — save all enriched fields, update filter
3. **`src/lib/destinations.ts`** — extend `Destination` interface
4. **`src/pages/DestinationDetail.tsx`** — map new fields, enhance Getting Around, add new info cards

