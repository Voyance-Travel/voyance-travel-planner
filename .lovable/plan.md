

# Universal Blocked Restaurant Name Patterns

## Changes

### Both files: `action-generate-trip-day.ts` and `action-generate-day.ts`

**1. Expand `BLOCKED_RESTAURANT_NAMES`** — add new entries for Asian/Latin/African hallucinations and common English-language fakes:
- `'bistrot du marché'`, `'sakura house'`, `'golden dragon'`, `'jade palace'`, `'riad des épices'`, `'el rincón'`, `'la esquina'`, `'mercado central restaurant'`, `'the local kitchen'`, `'the hidden gem'`, `'the secret garden'`, `'authentic taste'`, `'local flavors'`, `'traditional house'`

**2. Add `GENERIC_RESTAURANT_PATTERNS`** array right after the blocked names list:
```typescript
const GENERIC_RESTAURANT_PATTERNS = [
  /^the .+ (restaurant|kitchen|cafe|bistro|bar|grill|house|place|spot|table|corner)$/i,
  /^(restaurant|cafe|bistro|bar) (de |du |del |della |des |di )/i,
  /^(local|traditional|authentic|hidden|secret|cozy|charming|quaint) /i,
];
```

**3. Add pattern check** inside the filter callback, right after the `BLOCKED_RESTAURANT_NAMES` loop (after line 851 in trip-day, after line 365 in day):
```typescript
for (const pattern of GENERIC_RESTAURANT_PATTERNS) {
  if (pattern.test(name)) {
    console.log(`[HALLUCINATION FILTER] Removed generic-pattern restaurant: ${name}`);
    return false;
  }
}
```

### Files modified
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — lines 826-851
- `supabase/functions/generate-itinerary/action-generate-day.ts` — lines 341-365

No other code touched. Existing filter logic, address patterns, and dedup remain unchanged.

