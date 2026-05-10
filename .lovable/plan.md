## Goal

Close gaps in `src/utils/destinationImages.ts` so iconic destinations (notably **Venice**, the bug report trigger) get reliable hero photos instead of falling back to whatever the database returns.

## Scope

Single-file edit: `src/utils/destinationImages.ts`, inside `CURATED_DESTINATION_IMAGES` (line 29+).

## Audit results vs. requested list

Already present (will skip — no duplicates):
- `santorini` (line 51)
- `hanoi` (line 157)

To add (29 new keys, 2–3 Unsplash URLs each):

**Europe (14):** venice, naples, stockholm, helsinki, oslo, athens, madrid, granada, sevilla, cinque-terre, nice, geneva, brussels, bruges

**Asia (6):** shanghai, beijing, phuket, manila, mumbai, delhi

**Americas (5):** quito, lima, santiago, toronto, montreal

**Middle East (4):** tel-aviv, jerusalem, amman, beirut

Multi-word keys use hyphens (`cinque-terre`, `tel-aviv`) to match the file's existing convention (e.g. `new-orleans`, `mexico-city`, `cape-town`, `hong-kong` — to be confirmed during edit by quick re-grep).

Result: 86 → ~115 destinations, matching the brief.

## Photo selection rules

- Source: unsplash.com, sorted by "Most popular", landscape orientation
- Subject: the iconic landmark per the user's prompt (Grand Canal for Venice, Vesuvius for Naples, Acropolis for Athens, Alhambra for Granada, etc.)
- Avoid: crowds, interiors, portraits
- URL format: `https://images.unsplash.com/photo-XXXXXXXXX?w=1200` (matches the file's existing convention — `normalizeUnsplashUrl` upgrades width at render time)
- 2–3 URLs per destination (pattern of existing entries)

## Technical details

- Pure data addition; no logic changes, no new imports.
- Lookup is already case-insensitive / normalized by surrounding code, so lowercase hyphenated keys are sufficient.
- No migration, no test changes required.

## Verification

1. `grep -c "':" src/utils/destinationImages.ts` confirms ~29 new entries (86 → ~115).
2. Open a Venice trip in preview → header shows Grand Canal, not a database fallback.
3. Spot-check Naples, Stockholm, Athens, Shanghai, Toronto, Tel Aviv preview headers.
4. Existing destinations (Paris, Rome, Tokyo) unaffected.

## Out of scope

- No changes to `normalizeUnsplashUrl`, lookup logic, or DB image pipeline.
- No local asset imports (all new entries use hotlinked Unsplash URLs).
- No backfill of older trips' cached header images.
