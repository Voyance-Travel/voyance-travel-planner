

## Extend Venue Alias Map to Major Global Destinations

### Problem
The `VENUE_ALIASES` map currently only contains Paris landmarks. Any trip to Rome, London, Barcelona, Tokyo, etc. gets zero alias-based dedup — bilingual name variants (e.g., "Colosseum" vs "Colosseo", "Sagrada Familia" vs "Basílica de la Sagrada Família") slip through and cause cross-day repeats.

### Approach
Expand `VENUE_ALIASES` with entries for the most popular travel destinations. The fuzzy matcher (`venueNamesMatch`) and `resolveVenueAlias` already work generically — they just need more data.

### Change

**File: `supabase/functions/generate-itinerary/generation-utils.ts`** — Add alias entries for Rome, London, Barcelona, Tokyo, New York, Berlin, Lisbon, Amsterdam, and Istanbul after the existing Paris entries (before line 157's closing `}`):

```typescript
  // --- ROME ---
  'colosseum': 'colosseum',
  'colosseo': 'colosseum',
  'roman colosseum': 'colosseum',
  'roman forum': 'roman-forum',
  'foro romano': 'roman-forum',
  'vatican museums': 'vatican-museums',
  'musei vaticani': 'vatican-museums',
  'sistine chapel': 'sistine-chapel',
  'cappella sistina': 'sistine-chapel',
  'st peters basilica': 'st-peters',
  "saint peter's basilica": 'st-peters',
  'basilica di san pietro': 'st-peters',
  'trevi fountain': 'trevi',
  'fontana di trevi': 'trevi',
  'pantheon': 'pantheon',
  'spanish steps': 'spanish-steps',
  'piazza di spagna': 'spanish-steps',
  'scalinata di trinita dei monti': 'spanish-steps',
  'piazza navona': 'piazza-navona',
  'borghese gallery': 'borghese',
  'galleria borghese': 'borghese',
  'villa borghese': 'villa-borghese',
  'villa borghese gardens': 'villa-borghese',
  "castel sant'angelo": 'castel-santangelo',
  'castel santangelo': 'castel-santangelo',
  'trastevere': 'trastevere',

  // --- LONDON ---
  'tower of london': 'tower-of-london',
  'the tower of london': 'tower-of-london',
  'buckingham palace': 'buckingham',
  'big ben': 'big-ben',
  'elizabeth tower': 'big-ben',
  'houses of parliament': 'parliament',
  'palace of westminster': 'parliament',
  'westminster abbey': 'westminster-abbey',
  'british museum': 'british-museum',
  'the british museum': 'british-museum',
  'tower bridge': 'tower-bridge',
  'london bridge': 'london-bridge',
  'hyde park': 'hyde-park',
  'national gallery': 'national-gallery',
  'the national gallery': 'national-gallery',
  'tate modern': 'tate-modern',
  'st pauls cathedral': 'st-pauls',
  "saint paul's cathedral": 'st-pauls',
  'covent garden': 'covent-garden',
  'borough market': 'borough-market',
  'kensington palace': 'kensington-palace',
  'kensington gardens': 'kensington-gardens',
  'trafalgar square': 'trafalgar-square',
  'piccadilly circus': 'piccadilly-circus',

  // --- BARCELONA ---
  'sagrada familia': 'sagrada-familia',
  'la sagrada familia': 'sagrada-familia',
  'basilica de la sagrada familia': 'sagrada-familia',
  'park guell': 'park-guell',
  'parc guell': 'park-guell',
  'casa batllo': 'casa-batllo',
  'casa mila': 'casa-mila',
  'la pedrera': 'casa-mila',
  'la rambla': 'la-rambla',
  'las ramblas': 'la-rambla',
  'la boqueria': 'boqueria',
  'mercat de la boqueria': 'boqueria',
  'boqueria market': 'boqueria',
  'gothic quarter': 'gothic-quarter',
  'barri gotic': 'gothic-quarter',
  'camp nou': 'camp-nou',
  'barceloneta': 'barceloneta',
  'barceloneta beach': 'barceloneta',
  'montjuic': 'montjuic',
  'montjuic castle': 'montjuic',

  // --- TOKYO ---
  'senso-ji': 'sensoji',
  'sensoji': 'sensoji',
  'sensoji temple': 'sensoji',
  'asakusa temple': 'sensoji',
  'meiji shrine': 'meiji-shrine',
  'meiji jingu': 'meiji-shrine',
  'shibuya crossing': 'shibuya-crossing',
  'shibuya scramble': 'shibuya-crossing',
  'tokyo tower': 'tokyo-tower',
  'tokyo skytree': 'tokyo-skytree',
  'skytree': 'tokyo-skytree',
  'tsukiji market': 'tsukiji',
  'tsukiji outer market': 'tsukiji',
  'imperial palace': 'imperial-palace-tokyo',
  'tokyo imperial palace': 'imperial-palace-tokyo',
  'shinjuku gyoen': 'shinjuku-gyoen',
  'shinjuku garden': 'shinjuku-gyoen',
  'harajuku': 'harajuku',
  'takeshita street': 'harajuku',
  'akihabara': 'akihabara',

  // --- NEW YORK ---
  'statue of liberty': 'statue-of-liberty',
  'lady liberty': 'statue-of-liberty',
  'central park': 'central-park',
  'times square': 'times-square',
  'empire state building': 'empire-state',
  'empire state': 'empire-state',
  'brooklyn bridge': 'brooklyn-bridge',
  'metropolitan museum': 'met',
  'the met': 'met',
  'met museum': 'met',
  'metropolitan museum of art': 'met',
  'museum of modern art': 'moma',
  'moma': 'moma',
  'high line': 'high-line',
  'the high line': 'high-line',
  'grand central': 'grand-central',
  'grand central terminal': 'grand-central',
  'one world trade center': 'one-wtc',
  'one world observatory': 'one-wtc',
  'freedom tower': 'one-wtc',
  '9/11 memorial': '9-11-memorial',
  'world trade center memorial': '9-11-memorial',
  'top of the rock': 'top-of-the-rock',
  'rockefeller center': 'rockefeller',

  // --- BERLIN ---
  'brandenburg gate': 'brandenburg-gate',
  'brandenburger tor': 'brandenburg-gate',
  'berlin wall memorial': 'berlin-wall',
  'east side gallery': 'east-side-gallery',
  'reichstag': 'reichstag',
  'reichstag building': 'reichstag',
  'museum island': 'museum-island',
  'museumsinsel': 'museum-island',
  'checkpoint charlie': 'checkpoint-charlie',
  'alexanderplatz': 'alexanderplatz',
  'berlin cathedral': 'berlin-cathedral',
  'berliner dom': 'berlin-cathedral',
  'tiergarten': 'tiergarten',

  // --- LISBON ---
  'belem tower': 'belem-tower',
  'torre de belem': 'belem-tower',
  'jeronimos monastery': 'jeronimos',
  'mosteiro dos jeronimos': 'jeronimos',
  'alfama': 'alfama',
  'alfama district': 'alfama',
  'praca do comercio': 'praca-comercio',
  'commerce square': 'praca-comercio',
  'time out market': 'time-out-market',
  'mercado da ribeira': 'time-out-market',
  'tram 28': 'tram-28',
  'electrico 28': 'tram-28',

  // --- AMSTERDAM ---
  'anne frank house': 'anne-frank',
  'anne frank huis': 'anne-frank',
  'rijksmuseum': 'rijksmuseum',
  'the rijksmuseum': 'rijksmuseum',
  'van gogh museum': 'van-gogh-museum',
  'vondelpark': 'vondelpark',
  'dam square': 'dam-square',
  'royal palace amsterdam': 'royal-palace-amsterdam',
  'koninklijk paleis': 'royal-palace-amsterdam',
  'jordaan': 'jordaan',
  'the jordaan': 'jordaan',

  // --- ISTANBUL ---
  'hagia sophia': 'hagia-sophia',
  'ayasofya': 'hagia-sophia',
  'blue mosque': 'blue-mosque',
  'sultan ahmed mosque': 'blue-mosque',
  'sultanahmet mosque': 'blue-mosque',
  'topkapi palace': 'topkapi',
  'topkapi sarayi': 'topkapi',
  'grand bazaar': 'grand-bazaar',
  'kapali carsi': 'grand-bazaar',
  'basilica cistern': 'basilica-cistern',
  'yerebatan sarnici': 'basilica-cistern',
  'galata tower': 'galata-tower',
  'spice bazaar': 'spice-bazaar',
  'misir carsisi': 'spice-bazaar',
```

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/generation-utils.ts` | Add ~150 alias entries for 9 additional cities to `VENUE_ALIASES` |

### What Stays the Same
- `resolveVenueAlias()`, `venueNamesMatch()`, `venueMatchesAny()` — all work generically already
- The word-overlap fallback still catches unlisted venues with partial name matches
- No changes to the dedup pipeline logic itself

### Deployment
Redeploy `generate-itinerary` edge function.

