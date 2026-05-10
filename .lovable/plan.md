## Goal

Add a 90-day TTL to AI destination enrichment so London-style content refreshes ~quarterly instead of being permanent. Cost stays effectively zero (~$0.004/destination/year).

## Current state

`supabase/functions/enrich-destination/index.ts:51` short-circuits on any non-null `dest.enriched_at`, so once a destination is enriched it never refreshes. There's no expiry column.

```ts
if (dest.enriched_at) {
  return jsonResponse({ success: true, skipped: true, reason: "already_enriched" });
}
```

The success path at line 211-227 sets `enriched_at` and patches text fields, then **inserts** AI activities into `public.activities` (line 256-258). The activities table has no source/expiry column and no unique constraint on `(destination_id, name)`. Re-running enrichment today would duplicate activity rows — so the TTL fix has to handle that.

## Changes

### 1. Migration — add expiry column

```sql
ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS enrichment_expires_at TIMESTAMPTZ;

-- Backfill existing rows so the next click after deploy refreshes them on schedule,
-- not all at once. Stagger over the next 90 days based on enriched_at.
UPDATE public.destinations
SET enrichment_expires_at = enriched_at + INTERVAL '90 days'
WHERE enriched_at IS NOT NULL
  AND enrichment_expires_at IS NULL;
```

No RLS change (`destinations` is publicly readable; service-role writes from the edge function).

### 2. Update the guard in `enrich-destination/index.ts`

Replace the `if (dest.enriched_at) { return ... }` block (line 51-57) with:

```ts
const now = new Date();
const expiresAt = dest.enrichment_expires_at ? new Date(dest.enrichment_expires_at) : null;
const isExpired = !expiresAt || expiresAt.getTime() <= now.getTime();
const isFresh = !!dest.enriched_at && !isExpired;

if (isFresh) {
  log("Already enriched (fresh)", { destinationId, expires_at: dest.enrichment_expires_at });
  return new Response(
    JSON.stringify({ success: true, skipped: true, reason: "already_enriched" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const isRefresh = !!dest.enriched_at && isExpired;
log(isRefresh ? "Refreshing (TTL expired)" : "First enrichment", { destinationId });
```

### 3. Set the expiry on success

In the update payload (line 211-213) add:

```ts
const enrichedAt = new Date();
const newExpiresAt = new Date(enrichedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
const updatePayload: Record<string, unknown> = {
  enriched_at: enrichedAt.toISOString(),
  enrichment_expires_at: newExpiresAt.toISOString(),
};
```

### 4. Don't duplicate activities on refresh

The current code unconditionally `INSERT`s AI activities. For a TTL refresh we need to either skip or de-dupe. Simplest correct option: on refresh, **only insert activities whose `name` doesn't already exist for this destination**. That preserves any user-curated rows and avoids duplicates.

Right before the existing insert block (line 246):

```ts
if (aiActivities.length > 0) {
  let rowsToInsert = aiActivities;

  if (isRefresh) {
    const { data: existing } = await supabaseClient
      .from("activities")
      .select("name")
      .eq("destination_id", destinationId);
    const existingNames = new Set((existing ?? []).map(r => (r.name ?? "").toLowerCase().trim()));
    rowsToInsert = aiActivities.filter(a => !existingNames.has((a.name ?? "").toLowerCase().trim()));
    log("Refresh activity dedupe", { proposed: aiActivities.length, new: rowsToInsert.length });
  }

  if (rowsToInsert.length > 0) {
    const activityRows = rowsToInsert.map(/* unchanged */);
    // …existing insert
  }
}
```

This keeps refreshes additive (new attractions get added; old rows stay). If product later wants a hard "wipe + reseed" semantic, that's a separate decision — additive is the safer default.

### Out of scope

- Photos already have a 60-day TTL via `curated_images.expires_at` — no change.
- Cross-tab dedup race (worst case: 2 calls instead of 1) — not worth fixing.
- `seedCuratedToDb()` redundant upserts in `imagePrefetch.ts` — separate cleanup.
- Manual "force refresh" admin tool — not needed; TTL handles it automatically.

## Verification

1. Run migration → `enrichment_expires_at` exists; existing enriched rows have a backfilled expiry 90 days after their `enriched_at`.
2. Click an unenriched destination → AI call fires, both `enriched_at` and `enrichment_expires_at` populate, `enrichment_expires_at ≈ enriched_at + 90 days`.
3. Click the same destination again immediately → edge function returns `skipped: true, reason: "already_enriched"`, **no** AI call (check `[ENRICH-DEST] Already enriched (fresh)` log).
4. Manually `UPDATE destinations SET enrichment_expires_at = now() - interval '1 day' WHERE id = …` → next click triggers a refresh, log shows `Refreshing (TTL expired)`, expiry advances 90 days, no duplicate activity rows (verify `SELECT count(*), name FROM activities WHERE destination_id = … GROUP BY name HAVING count(*) > 1` returns zero rows).
5. Annual cost projection per destination: 4 calls × ~$0.001 = ~$0.004/year. ✓

## Files

- New migration (adds `enrichment_expires_at`, backfills).
- `supabase/functions/enrich-destination/index.ts` — guard, update payload, refresh dedupe (~30 lines changed total).