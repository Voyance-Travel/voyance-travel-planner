

## Fix: `generate-itinerary` Edge Function Boot Failure

### Root Cause

The `generate-itinerary` edge function **cannot boot at all** due to a syntax error:

```
Uncaught SyntaxError: Identifier 'usedVenueNames' has already been declared
  at day-validation.ts:1078:9
```

Two `const usedVenueNames` declarations exist in the same function scope:
- **Line 798**: Used for the PRE-PASS 0 venue-swap guard
- **Line 929**: Used for the missing-meal injection logic

Since the function never boots, it cannot respond to CORS preflight (OPTIONS) requests, causing the browser error you're seeing.

### Fix

**File: `supabase/functions/generate-itinerary/day-validation.ts`**

Rename the second `usedVenueNames` (line 929) to `usedVenueNamesForInjection` (or similar), and update its three references on lines ~947, ~957 to use the new name.

This is a one-variable rename — no logic changes needed.

### What This Fixes
- The edge function will boot successfully
- CORS preflight will respond correctly
- Itinerary generation will work again from travelwithvoyance.com

