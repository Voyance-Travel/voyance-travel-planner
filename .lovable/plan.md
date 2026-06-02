## Fix Kyoto departure-transit undercount

Your diagnosis is correct, with one important addition: this isn't just a missing Kyoto row. Kyoto **and** Osaka both exist in `destinations`, but **2,226 of 2,246 rows** sit at the exact value `45` — the column was seeded with the generic fallback for every destination, then never curated. The 45-min fallback in `generation-utils.ts:535` is firing because the DB value *is* 45, not because the lookup missed.

### Scope of this plan (narrow, matches your ask)

Data-only update for the KIX cluster. No code changes.

```sql
-- Kansai International (KIX) serves both Kyoto and Osaka
UPDATE destinations
SET airport_transfer_minutes = 75   -- Haruka Express Kyoto ↔ KIX
WHERE city ILIKE 'kyoto' AND country = 'Japan';

UPDATE destinations
SET airport_transfer_minutes = 50   -- Nankai Rapi:t / JR Kanku Osaka ↔ KIX
WHERE city ILIKE 'osaka' AND country = 'Japan';
```

Run via the insert tool (data change, not a migration). Effect propagates immediately to the next generation — no code deploy needed.

### Out of scope (flagging only)

- **`airportLinker.ts` Kyoto → KIX mapping**: you noted this. Touching it crosses into code; leaving it for a follow-up unless you say otherwise.
- **Remaining 2,224 destinations at the default 45**: every other city (Paris/CDG ~60, NYC/JFK ~60, Bangkok/BKK ~55, etc.) has the same undercount. Same code path, same symptom. A bulk curation pass is the real fix; this plan only patches the two cities you flagged.

### Verification after apply

```sql
SELECT city, airport_transfer_minutes FROM destinations
WHERE city IN ('Kyoto','Osaka') AND country = 'Japan';
```

Next generated Kyoto trip should show ~75 min departure buffer feeding into the 180-min flight buffer rule.

Want me to (a) apply just Kyoto + Osaka as planned, or (b) expand to a curated batch of the top ~30 destinations in the same pass?