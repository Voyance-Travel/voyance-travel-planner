

# Universal Failsafe Restaurant Replacement Logic

## Changes

### File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

**1. Add 5 new city entries to `FAILSAFE_FALLBACKS`** (after the `'london'` entry ending around line 1961, before the closing `};`):
- `'tokyo'` — 2 breakfast, 2 lunch, 2 dinner (Tsukiji Tamura, Bills, Afuri, Tonkatsu Maisen, Gonpachi, Ukai Toriyama)
- `'buenos aires'` — 2 each (Cuervo Café, Ninina, El Sanjuanino, Don Julio, Proper, Paraje Arévalo)
- `'marrakech'` — 2 each (Café des Épices, NOMAD, Le Jardin, Dar Zellij, Al Fassia, La Mamounia Le Marocain)
- `'bangkok'` — 2 each (Roast Coffee, Broccoli Revolution, Jay Fai, Supanniga, Bo.lan, Gaggan Anand)
- `'amsterdam'` — 2 each (Bakers & Roasters, The Breakfast Club, Foodhallen, Pluk, Restaurant Bak, Rijks)

All entries include real names, neighborhoods, and verified addresses.

**2. Add 5 new entries to `CITY_ALIASES`** (after `'london'` entry, around line 1980):
- `'tokyo': ['tōkyō', 'tokio']`
- `'buenos aires': ['bsas']`
- `'marrakech': ['marrakesh', 'مراكش']`
- `'bangkok': ['krung thep']`
- `'amsterdam': ['a\'dam']`

### What's NOT changed
- No changes to replacement/removal logic
- No changes to existing city entries
- No changes to hallucination filter, venue dedup, departure cutoff, or activity count
- Only `action-generate-trip-day.ts` is modified

