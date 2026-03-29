

## Fix: Remove AI Self-Commentary and Generic Placeholders

**File**: `supabase/functions/generate-itinerary/sanitization.ts`

### Part A: AI Self-Commentary Regex

Add one new `.replace()` call to the `sanitizeAITextField` chain (after line 86, before the empty-parens cleanup):

```typescript
// AI self-referential commentary
.replace(/(?:^|\.\s*)This\s+(?:addresses|fulfills|satisfies|aligns with|caters to|speaks to|reflects)\s+(?:the|your|their)\s+\w+\s+(?:interest|preference|request|need|requirement)\b[^.]*\.?/gi, '')
```

### Part B: Generic Placeholder Replacement

**1. Update `sanitizeAITextField` signature** (line 70) to accept optional `destination`:
```typescript
export function sanitizeAITextField(text: string | undefined | null, destination?: string): string {
```

**2. Add destination replacement** before the final `.trim()` (line 92):
```typescript
// Replace generic "the destination" with actual city name
let result = text
  .replace(...)  // existing chain
  .replace(/^[,;|:\s-]+|[,;|:\s-]+$/g, '');

if (destination) {
  result = result.replace(/\b(?:the destination|the city|this destination|this city)\b/gi, destination);
}

return result.trim();
```

This requires refactoring the single chained return into a `let result = ...` then conditional replace then `return result.trim()`.

**3. Update `sanitizeGeneratedDay` signature** (line 98) to accept and pass `destination`:
```typescript
export function sanitizeGeneratedDay(day: any, dayNumber: number, destination?: string): any {
```

Then update every `sanitizeAITextField(...)` call inside it (lines 101-150) to pass `destination` as second arg.

### Wire destination in `index.ts`

**4. Stage 2 calls** (lines 2421, 2429): `dayDestination` is already available at line 1999. Change:
```typescript
sanitizeGeneratedDay(..., dayNumber)  →  sanitizeGeneratedDay(..., dayNumber, dayDestination)
```

**5. Generate-trip-day handler calls** (lines 10321, 10330): `cityInfo?.cityName || destination` is available. Change:
```typescript
sanitizeGeneratedDay(..., dayNumber)  →  sanitizeGeneratedDay(..., dayNumber, cityInfo?.cityName || destination)
```

### Summary

| File | Change |
|---|---|
| `sanitization.ts` | Add self-commentary regex, add `destination` param to both functions, replace "the destination" with city name |
| `index.ts` | Pass destination to `sanitizeGeneratedDay` at 4 call sites |

