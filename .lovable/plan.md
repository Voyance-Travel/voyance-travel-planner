# Fix: AI stub venue names ("Café Matinal", "Table du Quartier", etc.)

## What's happening

The AI is emitting French-styled stub restaurant names — **"Café Matinal"** (Day 4 breakfast), **"Table du Quartier"** (Day 3 lunch), and the rest of the family ("Bistrot du Marché", "Le Comptoir du Midi", "Brasserie de la Gare", "Boulangerie du Quartier"). These are explicitly listed in the **Meal Rules** core memory as BANNED but slip through every guard:

1. `GENERIC_RESTAURANT_PATTERNS` in `action-generate-day.ts:391` and `action-generate-trip-day.ts:974` only match `^the X kitchen$` / `^(restaurant|cafe|bistro|bar) de …` / `^(local|traditional|…)`. None match the "Noun du Filler" shape (`Table du Quartier`) or noun + adjective shape (`Café Matinal`).
2. `GENERIC_VENUE_PATTERNS` in `pipeline/validate-day.ts:24` and `PLACEHOLDER_TITLE_PATTERNS` / `PLACEHOLDER_VENUE_PATTERNS` in `fix-placeholders.ts` don't catch them either.
3. Worst: the dead `GENERIC_VENUE_TEMPLATES` constant in `fix-placeholders.ts:467-484` literally enumerates these exact strings ("Café Matinal", "Table du Quartier", "Boulangerie du Quartier", "Bistrot du Marché", …). It is unused at runtime but proves the system "knows" they're stubs while no detector catches them.

## Fix

### 1. Add an AI-stub pattern set

In `fix-placeholders.ts`, alongside `PLACEHOLDER_VENUE_PATTERNS`:

```ts
// AI-generated French/Italian stub venue patterns
// (e.g. "Table du Quartier", "Café Matinal", "Le Petit Comptoir")
export const AI_STUB_VENUE_PATTERNS: RegExp[] = [
  // <Venue-noun> (du|de la|des|de|del|della) <generic filler>
  /^(le |la |il |el )?(table|bistrot|brasserie|caf[eé]|comptoir|boulangerie|p[âa]tisserie|trattoria|osteria|taverna|restaurant|maison|petit|grand|bar|cave)\s+(du|de la|des|de|del|della|dei)\s+(quartier|march[ée]|coin|place|soir|midi|matin|gare|arts|jardin|vins|coeur|nord|sud|est|ouest|centre|village|port|pont)\b/i,
  // "Café Matinal" / "Le Petit Matin" / "La Petite Place"
  /^(le |la )?(petit|petite|grand|grande|caf[eé])\s+(matin|matinal|matinale|soir|midi|jardin|comptoir|march[ée]|place|coin)\b/i,
  // Catch-all for the legacy template strings (case-insensitive exact)
  /^(caf[eé] matinal|boulangerie du quartier|le petit matin|caf[eé] des arts|p[âa]tisserie du coin|bistrot du march[ée]|le comptoir du midi|brasserie du coin|caf[eé] de la place|table du quartier|restaurant le jardin|la table du soir|le petit comptoir|brasserie de la gare|restaurant du march[ée]|le bar du coin|comptoir des vins|le petit bar|bar de la place|cave [àa] vins)$/i,
];

export function matchesAIStubVenue(name: string): boolean {
  return AI_STUB_VENUE_PATTERNS.some(re => re.test((name || '').trim()));
}
```

### 2. Wire it into every guard

- **`fix-placeholders.ts` `isPlaceholderMeal`** — return `true` when `matchesAIStubVenue(title)` or `matchesAIStubVenue(venue)` matches. Lets `nuclearPlaceholderSweep` repair these.
- **`pipeline/validate-day.ts` `checkGenericVenues`** — push `GENERIC_VENUE` error (severity `'error'`, `autoRepairable: true`) when `matchesAIStubVenue(title) || matchesAIStubVenue(locationName)`. The existing repair pipeline replaces them via fallback DB / Google Places.
- **`action-generate-day.ts:402` and `action-generate-trip-day.ts:989` hallucination filter** — drop dining activities where `matchesAIStubVenue(name)` matches. Log: `[HALLUCINATION FILTER] Removed AI stub-pattern restaurant: <name>`.

### 3. Decommission the dead template pool

Remove `GENERIC_VENUE_TEMPLATES` and `getNextTemplateVenue` from `fix-placeholders.ts`. Remaining consumers:
- `day-validation.ts:7` — imports but never references at runtime (TRY 3 already recycles real fallback-DB venues; comment at line 1066 confirms). Drop the import.
- `fix-placeholders.test.ts:10,134` — drop the import and delete the now-meaningless "every meal slot has at least 3 options" sanity test.

This eliminates the worst regression risk: the constant simply will not exist for any future code path to grab.

### 4. Tests

Add to `fix-placeholders.test.ts`:

```ts
Deno.test("AI stub venues: French stubs are flagged", () => {
  assertEquals(matchesAIStubVenue("Café Matinal"), true);
  assertEquals(matchesAIStubVenue("Table du Quartier"), true);
  assertEquals(matchesAIStubVenue("Bistrot du Marché"), true);
  assertEquals(matchesAIStubVenue("Le Comptoir du Midi"), true);
  assertEquals(matchesAIStubVenue("Brasserie de la Gare"), true);
  assertEquals(matchesAIStubVenue("Boulangerie du Quartier"), true);
});

Deno.test("AI stub venues: real Paris restaurants are NOT flagged", () => {
  assertEquals(matchesAIStubVenue("Septime"), false);
  assertEquals(matchesAIStubVenue("Le Comptoir du Relais"), false); // real (Camdeborde)
  assertEquals(matchesAIStubVenue("Café de Flore"), false);
  assertEquals(matchesAIStubVenue("Chez L'Ami Jean"), false);
  assertEquals(matchesAIStubVenue("Le Jules Verne"), false);
});

Deno.test("isPlaceholderMeal flags AI stub venue names", () => {
  const act = { category: "dining", title: "Breakfast at Café Matinal", location: { name: "Café Matinal" } };
  assertEquals(isPlaceholderMeal(act, "Paris"), true);
});
```

> Note on `Le Comptoir du Relais` (real Yves Camdeborde restaurant): the first pattern requires the trailing word to be in the generic-filler set (`quartier|marché|coin|place|soir|midi|matin|gare|arts|...`); "Relais" is not, so it's safely excluded. `Le Comptoir du Midi` IS a stub and gets caught.

## Files

- `supabase/functions/generate-itinerary/fix-placeholders.ts` — add `AI_STUB_VENUE_PATTERNS`/`matchesAIStubVenue`, hook into `isPlaceholderMeal`, remove dead `GENERIC_VENUE_TEMPLATES`/`getNextTemplateVenue`
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` — call `matchesAIStubVenue` in `checkGenericVenues`
- `supabase/functions/generate-itinerary/action-generate-day.ts` — extend hallucination filter
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — extend hallucination filter
- `supabase/functions/generate-itinerary/day-validation.ts` — drop unused `GENERIC_VENUE_TEMPLATES` import
- `supabase/functions/generate-itinerary/fix-placeholders.test.ts` — new tests, drop dead-template test

No DB migration. No client changes. Memory is already covered by the **Meal Rules** core entry.
