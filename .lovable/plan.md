# M13 — Activity avoid-list filtering

## Context

Spec calls for filtering the `searchActivities` results in `src/services/activitiesAPI.ts` against `user_preferences.avoid_categories` and `user_preferences.avoid_venues`. **Neither column exists** today (only `food_dislikes TEXT[]` is present). User chose **Add columns + filter, no UI** — schema migration ships now; UI to populate the lists is tracked separately.

## Step 1 — Migration

Add two `TEXT[]` columns to `public.user_preferences` with empty-array defaults so existing rows stay safe and filtering is a no-op until populated.

```sql
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS avoid_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoid_venues     TEXT[] NOT NULL DEFAULT '{}';
```

No RLS change — the table's existing per-user policies already cover the new columns.

After approval the Supabase types regenerate, so `avoid_categories` / `avoid_venues` become typed on the client.

## Step 2 — Filter in `src/services/activitiesAPI.ts`

Inside `searchActivities`, after the edge-function call returns and `data` is parsed, fetch the current user's avoid lists and filter the array before returning. Return shape stays `ActivitySearchResponse` (so `useActivitySearch` consumers don't break) — we filter the `activities` array in place and recompute `totalCount`.

```ts
// Apply user's avoid-list before returning.
const { data: { user } } = await supabase.auth.getUser();
let activities = (data as ActivitySearchResponse)?.activities || [];

if (user) {
  const { data: prefs } = await supabase
    .from('user_preferences')
    .select('avoid_categories, avoid_venues')
    .eq('user_id', user.id)
    .maybeSingle();

  const avoidCategories = new Set(
    (prefs?.avoid_categories || []).map((c: string) => c.toLowerCase().trim()).filter(Boolean)
  );
  const avoidVenues = Array.from(
    new Set((prefs?.avoid_venues || []).map((v: string) => v.toLowerCase().trim()).filter(Boolean))
  );

  if (avoidCategories.size > 0 || avoidVenues.length > 0) {
    activities = activities.filter((a) => {
      const cat = String(a.category || '').toLowerCase();
      const title = String(a.title || '').toLowerCase();
      if (avoidCategories.has(cat)) return false;
      for (const v of avoidVenues) {
        if (title.includes(v)) return false;
      }
      return true;
    });
  }
}

return {
  ...(data as ActivitySearchResponse),
  activities,
  totalCount: activities.length,
};
```

### Adjustments vs. spec

- **Return shape preserved**: spec ends with `return filtered` (a bare array), but the function signature is `Promise<ActivitySearchResponse>` and `useActivitySearch` consumers expect `{ activities, totalCount, … }`. We return the response object with filtered `activities` and recomputed `totalCount`.
- **`user` is fetched here**: spec assumes `user` already in scope; this function has no auth context, so we call `supabase.auth.getUser()`. Anonymous callers skip the filter (no prefs to apply).
- **Title-only venue match**: `Activity` has no `name` field — only `title`. We match `title` (lowercased substring) against each venue keyword.
- **Empty-list short-circuit** avoids the array scan when the user has no avoid entries (the common case until UI ships).

## Verification

- `grep -c "avoid_categories\|avoid_venues" src/services/activitiesAPI.ts` → ≥ 2 (both column names referenced in select + variables).
- Build passes.
- Manual: with `avoid_categories = '{food}'` set on a test row, `searchActivities` returns no rows whose `category === 'food'`.

## Out of scope

- UI to edit avoid lists (tracked separately).
- Server-side filter inside the `activities` edge function (M13 keeps it client-side per spec).
- Fuzzy / token matching for venues — substring only.
