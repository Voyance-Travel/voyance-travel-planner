## Goal

Close the activity-feedback feedback loop: pull the user's recent ratings into trip generation so the prompt steers toward consistently-loved categories and away from consistently-disliked ones.

## Schema reality check (deviates from request — heads up)

The `activity_feedback` table doesn't match the column names/values in your message. Real schema:

- `rating` is `text` with `CHECK rating IN ('loved','liked','neutral','disliked')` — **not a 1–5 integer**. So `gte('rating', 1)` / `>= 4` / `<= 2` won't compile or filter correctly.
- `tags` → actually `feedback_tags text[]`
- `notes` → actually `feedback_text text`
- There's also an `activity_category` column worth using as a fallback when `activity_type` is null.

I'll preserve the spirit of the request (top-5 loved / top-5 disliked by category, last 50, injected into prompt) while using the real columns. Confirm before I implement if you'd rather migrate `rating` to integer instead.

## Implementation

### 1. `supabase/functions/generate-itinerary/action-generate-trip.ts`

Right after the `trip_learnings` block (immediately after line 445, inside the same `try`/`catch` neighborhood), add a new sub-step **10b. Activity feedback signals**:

```ts
// 10b. Activity feedback signals (loved/disliked categories from prior ratings)
try {
  const { data: recentFeedback } = await supabase
    .from('activity_feedback')
    .select('rating, activity_type, activity_category, created_at')
    .eq('user_id', userId)
    .in('rating', ['loved', 'liked', 'disliked'])
    .order('created_at', { ascending: false })
    .limit(50);

  const tally = (rows: Array<{ activity_type: string | null; activity_category: string | null }>) => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const key = (r.activity_type || r.activity_category || '').trim().toLowerCase();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);
  };

  const rows = recentFeedback ?? [];
  const loved = tally(rows.filter(r => r.rating === 'loved' || r.rating === 'liked'));
  const disliked = tally(rows.filter(r => r.rating === 'disliked'));

  if (rows.length > 0 && (loved.length > 0 || disliked.length > 0)) {
    enrichmentContext.behavioralPreferences = {
      consistentlyLoved: loved,
      consistentlyDisliked: disliked,
      sampleSize: rows.length,
    };
    enrichmentContext.behavioralPreferencesPrompt =
      `\n## 🎯 PAST BEHAVIORAL SIGNALS (from ${rows.length} prior activity ratings)\n` +
      `- Strongly favor: ${loved.join(', ') || 'no clear pattern yet'}\n` +
      `- Actively avoid (unless directly requested): ${disliked.join(', ') || 'no clear pattern yet'}\n`;
    console.log(`[generate-trip] Behavioral signals: loved=[${loved.join('|')}] disliked=[${disliked.join('|')}] from ${rows.length} ratings`);
  }
} catch (afErr) {
  console.warn('[generate-trip] Activity feedback signals failed (non-blocking):', afErr);
}
```

Both an **object** (`behavioralPreferences`, kept on `enrichmentContext` for metadata/telemetry per your spec) and a **string** (`behavioralPreferencesPrompt`, what compile-prompt actually injects, matching the pattern used by every other enrichment field).

### 2. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

Add one line in the existing `gc.*` push chain (right after the line that pushes `pastTripLearnings`, around line 831):

```ts
if (gc.behavioralPreferencesPrompt) promptParts.push(gc.behavioralPreferencesPrompt as string);
```

This keeps the established convention (every enrichment field is gated by a `Prompt` string and pushed in compile-prompt).

## Verification

- `rg -n "behavioralPreferences" supabase/functions/` → 4 hits (object assign, string assign, log line, compile-prompt push). User asked for ≥2; we'll have 4.
- Manual: pick a test user with ≥3 `activity_feedback` rows, kick off a generation, grep edge logs for `[generate-trip] Behavioral signals: loved=[...]`. Then check the metadata column on the resulting trip — `metadata.generation_context.behavioralPreferences.consistentlyLoved` should be populated.
- Existing functions (`trip_learnings`, `recentlyUsedActivities`) are untouched.

## Out of scope

- No DB migration. We use the existing text-enum `rating`. If you want a true 1–5 numeric scale, that's a separate change touching the table, the feedback UI, and the constraint.
- We're not weighting by `feedback_tags` or `feedback_text` yet — only category counts. Easy to layer on later if you want sentiment-style signals.
- Recency decay (e.g. weight last-7-days higher) skipped; the `LIMIT 50` + recency `ORDER BY` is the only recency control.

## Confirm

1. Treat `rating='loved'` and `rating='liked'` together as the "loved bucket"? (default in plan: yes, both count as loved)
2. Use `activity_category` as a fallback when `activity_type` is null? (default: yes)
3. OK to skip `feedback_tags` / `feedback_text` for this pass? (default: yes)