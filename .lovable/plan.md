
The two visible artifacts are **"the of Paris"** (Petit Palais description) and **"the's historic mosque"** (Hammam description). Both patterns already have repairs in the *server-side* sanitizer (`supabase/functions/generate-itinerary/sanitization.ts` lines 1067–1098), but those only run at generation. Existing trip descriptions render through the *client-side* `src/utils/textSanitizer.ts.sanitizeText`, which only handles `the's` and em-dashes — so the legacy text leaks through unfixed.

## Fix

Port the two relevant repairs into the client sanitizer so existing trips read clean on render, no regeneration required.

### Edit `src/utils/textSanitizer.ts` — extend `sanitizeText`

```ts
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    // Fix orphaned possessive: "the's" / "the' s" → "the city's"
    .replace(/\bthe'\s?s\b/gi, "the city's")
    // "the of Paris" / "the of Light" → "the City of Paris"
    .replace(/\bthe\s+of\s+(?=[A-Z])/g, 'the City of ')
    // Dangling article before punctuation: "in the." → "in the city."
    .replace(
      /\b(in|to|of|over|for|about|around|across|throughout|from|into|toward|towards|through|within|near)\s+the([.!?,;])/gi,
      '$1 the city$2'
    );
}
```

The two new patterns are direct ports of the server logic — same regex, same replacement — so behavior is consistent across generation and render.

### Verify

`sanitizeText` is called from EditorialItinerary description rendering and the concierge sheet, so both broken strings will be repaired on the next page render with no DB write or regeneration.

### Memory

Update `mem://technical/itinerary/text-sanitization-layer` to note: the orphaned-article repairs ("the of X", trailing "the.") now live in **both** the server sanitizer and the client `sanitizeText` so legacy descriptions render correctly.

## Files

- `src/utils/textSanitizer.ts` — add two regex passes
- `mem://technical/itinerary/text-sanitization-layer` — note client/server parity

## Out of scope

- No DB rewrite (the render-time fix covers all existing trips).
- No prompt changes (server-side guard already prevents new occurrences).

Approve?
