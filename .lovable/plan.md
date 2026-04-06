

## Expand Michelin Fine Dining Price Floor List

### Problem
"Fifty Seconds by Martín Berasategui" matched the `knownMichelinHigh` regex (line 376: `fifty\s*seconds`) but the user reports it was priced at €28/pp, suggesting the regex didn't fire. Looking more closely, the regex requires word boundary `\b` before "fifty" — this should work. However, the list is incomplete for other restaurants and the user wants a broader expansion.

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/sanitization.ts`** (lines 375-386)

Expand the three tiered regex patterns:

**`knownMichelinHigh`** (floor €150) — add:
- `fortaleza do guincho` (keep existing `belcanto`, `feitoria`, `fifty seconds`)

**`knownMichelinMid`** (floor €120) — add:
- `100 maneiras`, `cem maneiras`, `casa da comida`, `pedro lemos`, `antiqvvm`, `largo do paço`, `euskalduna`, `casa de chá da boa nova`, `boa nova`
- (keep existing `alma`, `eleven`, `epur`, `cura`, `loco`, `eneko`)

**`knownUpscale`** (floor €60) — add:
- `mini bar`, `sacramento`, `solar dos presuntos`, `the yeatman`, `yeatman`
- (keep existing `il gallo`, `ceia`, `enoteca`, `sommelier`)

Replace the three regex lines (376-378) with expanded versions using the same structure.

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — expand the three tiered fine dining regex lists at lines 376-378

### Verification
Generate a 4-day Lisbon trip. If Fifty Seconds, Loco, 100 Maneiras, or any listed restaurant appears, confirm it's priced at or above its tier floor. Check console for `[UNDERPRICED]` correction logs.

