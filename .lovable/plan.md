

## Remaining Fixes from Cross-City Audit

Most bug classes from this audit (1-4, 6-7) are already addressed by Prompts 45-51 which have been implemented. Three gaps remain:

### Already Fixed (no action needed)
- **Bug 1** (Michelin underpricing): `KNOWN_FINE_DINING_STARS` already has Paris, Berlin, Rome restaurants
- **Bug 2** (Time generation): Midnight activity stripping + prompt rules exist
- **Bug 3** (Ticketed attractions Free): `KNOWN_TICKETED_ATTRACTIONS` + `enforceTicketedAttractionPricing` exist
- **Bug 4** (Breakfast repeats): Hotel breakfast limited to arrival/departure days + city fallbacks exist
- **Bug 6** (Casual venue overpricing): `enforceBarNightcapPriceCap` + `enforceCasualVenuePriceCap` exist
- **Bug 7** (Arrival sequencing): Prompt rules about Day 1 exist

### Remaining Gaps — 3 Changes

#### 1. Add known-free viewpoint patterns to `sanitization.ts`

Bug 5: "Eiffel Tower Evening Sparkle Viewing" charged €60 when it's a free activity (watching from Trocadéro/Champ de Mars). The `ALWAYS_FREE_VENUE_PATTERNS` don't catch this because "Eiffel Tower" isn't a free-venue keyword.

Add a `KNOWN_FREE_VIEWPOINTS` list with entries like:
- `eiffel tower.*sparkle`, `eiffel tower.*illumination`, `eiffel tower.*viewing` (watching from outside)
- `colosseum.*view` (external viewpoint, not entry)
- `acropolis.*view` (viewing from Philopappos Hill)

In `checkAndApplyFreeVenue`, after the main pattern check, also check against these viewpoint patterns. Only match if the activity description/title suggests watching from outside (contains "from", "stroll", "viewing", "watch") and does NOT contain "ticket", "entry", "climb", "ascend", "summit".

#### 2. Add Paris, Berlin, Rome, London to `FALLBACK_RESTAURANTS` in `repair-day.ts`

Bug 8: "Lunch at a bistro" with venue "the destination" appears because `FALLBACK_RESTAURANTS` only has Lisbon, Porto, and Barcelona. When the generic venue repair fires for Paris, it finds no fallback and keeps the placeholder.

Add 3-5 entries per meal type for each city:
- **Paris**: breakfast (Café de Flore, Carette, Du Pain et des Idées), lunch (Le Comptoir, Chez Janou, Bouillon Chartier), dinner (Le Petit Cler, Chez l'Ami Jean, Le Baratin)
- **Berlin**: breakfast (The Barn, House of Small Wonder, Brammibal's), lunch (Curry 36, Monsieur Vuong, Katz Orange), dinner (Nobelhart & Schmutzig, Pauly Saal, Ora)
- **Rome**: breakfast (Roscioli Caffè, Sciascia Caffè, Barnum Café), lunch (Da Enzo al 29, Armando al Pantheon, Trattoria Da Teo), dinner (Roscioli, Pierluigi, Felice a Testaccio)
- **London**: breakfast (The Wolseley, Dishoom, Buns from Home), lunch (Padella, Barrafina, Brasserie Zédel), dinner (St. John, The Palomar, Quo Vadis)

#### 3. Add city-name validation to day titles in `validate-day.ts`

Bug 9: Berlin Day 3 titled "Palatial Goodbyes and Viennese Charm" — wrong city reference.

Add a `WRONG_CITY_RE` check in `validateDayTitle` (or as a new validation):
- Build a set of city demonyms that should NOT appear for the current destination (e.g., if destination is Berlin, flag "Viennese", "Parisian", "Roman")
- If a day title contains a wrong-city demonym, flag it as a warning
- In repair, strip the offending phrase or replace with the correct demonym

### Files to edit

| File | Change |
|------|--------|
| `sanitization.ts` | Add `KNOWN_FREE_VIEWPOINTS` patterns and check in `checkAndApplyFreeVenue` |
| `pipeline/repair-day.ts` | Add Paris, Berlin, Rome, London to `FALLBACK_RESTAURANTS` |
| `pipeline/validate-day.ts` | Add wrong-city demonym check for day titles |

