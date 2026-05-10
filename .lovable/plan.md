## Goal

Stop letting low-quality images leak into the cache. Add cheap rule-based gates *before* any LLM call, fail closed on LLM errors, surface real source dimensions for Google Places, and capture rejected candidates for admin review + future model training.

## Findings that change the original spec

- **`scoreImageQuality` is dead code.** Defined at line 1304 but never called. The active selection path is `rankImageCandidates` (line 1595) which on error returns `candidates[0]` — that's the real fail-open path.
- **Existing `scoreImageQuality` already fails closed semantically** (`pass: false` on both error paths). The misleading part is the `score: 0.5` value. We'll switch to `0.0` for clarity *and* wire the function in so it actually runs.
- **Google Places candidates hardcode `width: 1200, height: 800`** (line 598). The aspect-ratio filter would be a no-op against portrait Google photos unless we plumb real dimensions from the places-v1 photo metadata (`photo.widthPx` / `photo.heightPx`).

## Scope

**Backend:** `supabase/functions/destination-images/index.ts`
**Migration:** `curated_images.user_report_count` column, new `image_quality_log` table + RLS
**No frontend changes.**

## Backend changes

### 1. New helper `passesBasicQuality` (cheap, runs first)

Inserted just above `scoreImageQuality` (~line 1289):

```ts
function passesBasicQuality(image: DestinationImage, entityType: string):
  { passes: boolean; reason?: string } {
  const w = image.width ?? 0;
  const h = image.height ?? 0;

  // Skip dimension checks for data URLs and AI-generated images (always 1024²)
  if (image.url.startsWith('data:') || image.source === 'lovable_ai') {
    return { passes: true };
  }

  // Hero/destination shots: ≥1.4:1 landscape, ≥1600px wide
  // Activity/venue: relaxed — many real venue shots are square
  if (entityType === 'destination' && h > 0) {
    const ratio = w / h;
    if (ratio < 1.4) return { passes: false, reason: 'aspect_ratio_too_narrow' };
    if (w < 1600) return { passes: false, reason: 'resolution_too_low' };
  }

  // URL red flags (low yield on Google CDN, useful on Wikimedia/TripAdvisor)
  const url = image.url.toLowerCase();
  const redFlags = ['selfie', '/menu', 'receipt', 'me-and', 'us-at', 'family-photo'];
  if (redFlags.some(f => url.includes(f))) {
    return { passes: false, reason: 'url_contains_red_flag' };
  }

  return { passes: true };
}
```

### 2. Plumb real Google Places dimensions

In `getGooglePlacesPhoto` (line ~592–599), replace the hardcoded `width: 1200, height: 800` with the photo metadata returned by places-v1:

```ts
width: best.place?.photos?.[0]?.widthPx ?? 1200,
height: best.place?.photos?.[0]?.heightPx ?? 800,
```

Without this, the aspect-ratio rule is decorative for the most common candidate source.

### 3. Fix the *real* fail-open in `rankImageCandidates` and wire the gates in

Refactor the candidate selection inside `fetchImageTiered` (around line 1593) to:

```ts
// 3a. Drop candidates that fail the cheap basic gate
const filtered: DestinationImage[] = [];
for (const c of candidates) {
  const basic = passesBasicQuality(c, entityType);
  if (basic.passes) {
    filtered.push(c);
  } else {
    logRejectedImage(supabase, {
      destination, image_url: c.url, source: c.source,
      rejected_reason: basic.reason, basic_check_result: basic,
      llm_score: null,
    });
  }
}
if (filtered.length === 0) {
  // All candidates failed basic gate — fall through to TripAdvisor / Wikimedia / AI
}

// 3b. Run LLM ranking only on survivors
let bestImage: DestinationImage | null = null;
if (filtered.length === 1) {
  bestImage = filtered[0];
} else if (filtered.length > 1 && lovableApiKey) {
  bestImage = await rankImageCandidates(filtered, cleanName, lovableApiKey);
} else if (filtered.length > 1) {
  bestImage = filtered[0];
}
```

Update `rankImageCandidates` error path (line 866 + 880) to return `null` instead of `candidates[0]`, and let the caller decide what to do (use first survivor of basic gate). This is the actual fail-closed flip the user wants.

### 4. Fix the misleading `0.5` returns in `scoreImageQuality`

Lines 1362 + 1399: change `score: 0.5` → `score: 0.0`. Keeps `pass: false` (already correct). This is cosmetic until/unless the function gets called, but matches the user's intent.

### 5. Logging helper

```ts
async function logRejectedImage(supabase: any, row: {
  destination: string;
  image_url: string;
  source: string;
  rejected_reason?: string;
  llm_score?: number | null;
  basic_check_result?: any;
}) {
  // Fire-and-forget — never block the request on logging
  supabase.from('image_quality_log').insert({
    ...row,
    created_at: new Date().toISOString(),
  }).then((r: any) => {
    if (r.error) console.warn('[quality-log] insert failed', r.error.message);
  });
}
```

### 6. Honor `user_report_count` in cache reads

In the curated-cache lookup (lines 71 + 91 + 215): add `.lt('user_report_count', 3)` to the query so flagged rows are skipped and the function falls through to higher tiers.

## Database migration

```sql
-- Per-row report counter on the cache
ALTER TABLE public.curated_images
  ADD COLUMN IF NOT EXISTS user_report_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_curated_images_report_count
  ON public.curated_images (user_report_count)
  WHERE user_report_count >= 3;

-- New audit table for rejected candidates
CREATE TABLE IF NOT EXISTS public.image_quality_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination TEXT,
  image_url TEXT NOT NULL,
  source TEXT,
  rejected_reason TEXT,
  llm_score NUMERIC,
  basic_check_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_quality_log_created_at
  ON public.image_quality_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_quality_log_destination
  ON public.image_quality_log (destination);

ALTER TABLE public.image_quality_log ENABLE ROW LEVEL SECURITY;

-- Edge functions write via service role (bypasses RLS); admins read.
-- Reuse existing has_role(auth.uid(), 'admin') pattern.
CREATE POLICY "Admins can read image quality log"
  ON public.image_quality_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
```

## Verification

1. **Force LLM error** — temporarily make `rankImageCandidates` throw. Expect: response uses next basic-gate survivor or falls through to TripAdvisor/Wikimedia/AI; never returns the LLM-rejected candidate.
2. **Portrait Google photo** — call with a venue whose top Google photo is portrait (after step 2 plumbs real dims). Expect: `image_quality_log` row with `rejected_reason='aspect_ratio_too_narrow'`, response uses next candidate.
3. **Cache stays clean** — check `curated_images` after 10 runs: no rows from rejected URLs.
4. **`user_report_count`** — manually set a row to 3, refetch the destination: expect the cache miss path to run and produce a different image.
5. **Admin log** — `select count(*), rejected_reason from image_quality_log group by rejected_reason` shows distribution.

## Open scope decisions (low risk, going with defaults)

- Aspect-ratio + min-width gates apply **only when `entityType === 'destination'`**. Square restaurant/hotel shots are legitimate and shouldn't be filtered.
- `image_quality_log` writes are fire-and-forget — never block image response on logging.
- `rankImageCandidates` returns `null` on error (not `candidates[0]`); caller picks first basic-gate survivor as the deterministic fallback.

## Out of scope

- Wiring `scoreImageQuality` (vision model) into the pipeline. It stays dead code; we only fix the misleading return values per spec. If you want it actually running per-candidate, that's a follow-up (extra credits per request, latency cost).
- Admin UI for the report counter / quality log. Spec calls them future features.
- Backfilling `user_report_count = 0` on existing rows (handled by `DEFAULT 0`).
