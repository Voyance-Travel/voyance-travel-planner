

## Fix: "Travel to Taxi to..." Transit Naming Variant

### Problem
The AI wraps a specific transport mode inside a generic "Travel to" prefix, producing "Travel to Taxi to Four Seasons Ritz" instead of "Taxi to Four Seasons Ritz".

### Change

**File: `supabase/functions/generate-itinerary/sanitization.ts`** — line 277, add one new regex before the semicolon that closes the chain:

```typescript
// "Travel to Taxi/Walk/Bus/Metro/Tram/Train to X" → "Taxi/Walk/Bus/... to X"
.replace(/^Travel\s+to\s+(Taxi|Walk|Bus|Metro|Tram|Train|Drive|Ride|Ferry|Uber)\s+to\s+/i, '$1 to ')
```

This single generic pattern with a capture group covers all transport modes in one line, keeping the more specific mode (e.g., "Taxi") and dropping the redundant "Travel to" wrapper. It should be added **before** the existing patterns (e.g., at line 269, before "Return to") so it fires first — otherwise the existing `$1` capture on "Travel" would incorrectly preserve "Travel to" instead of promoting the inner mode.

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — 1 regex line added at line 269

