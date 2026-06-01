## Fix: Edinburgh weather shows 79°F (should be ~62°F)

The weather edge function's fallback forecast lacks a climate band for the British Isles, so Edinburgh falls through to the generic `default` summer band (high 82°F). London is also miscategorized as central-`europe` (high 79°F), which is too warm for the UK.

### Changes — `supabase/functions/weather/index.ts`

**1. Add `british_isles` to `seasonalPatterns` (line 347–352):**
```js
'british_isles': {
  winter: { high: 44, low: 36, condition: 'Cloudy' },
  spring: { high: 54, low: 42, condition: 'Partly Cloudy' },
  summer: { high: 64, low: 52, condition: 'Partly Cloudy' },
  fall:   { high: 54, low: 42, condition: 'Cloudy' },
}
```

**2. Update `regionMapping` (line 354–359):** move `london` out of `europe`, add UK/Ireland cities:
```js
'london': 'british_isles', 'edinburgh': 'british_isles',
'glasgow': 'british_isles', 'manchester': 'british_isles',
'birmingham': 'british_isles', 'liverpool': 'british_isles',
'dublin': 'british_isles',
```

Paris/Berlin/Amsterdam stay on `europe`.

### Scope
- Data-only patch to one edge function. No logic, no schema, no UI changes.
- Only affects the `source: 'fallback'` path (when the live weather API is unavailable / rate-limited).
