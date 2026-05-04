# Budget Coach: protect what matters

## Problem
The coach correctly ranks the most expensive items first, but it has no concept of *trip intent*. For a luxury food trip it cheerfully proposes swapping L'Arpège → Septime and Le Cinq → Café de Flore — the two anchors the entire itinerary was designed around. There's no way to tell it "don't touch dining" or to dismiss a single bad suggestion.

## Solution
Three layers of control, smallest commitment first:

### 1. Trip-level "Protected categories" chips (persisted)
Above the coach panel, render a small row of toggle chips:

```
Don't suggest swaps for:  [ Dining ]  [ Hotels ]  [ Tours ]  [ Transit ]  [ Activities ]
```

- Multi-select. Default `[]`.
- Persisted per-trip in `trip_budget_settings.coach_protected_categories text[]` (new column, defaults to `'{}'`).
- Toggling a chip immediately re-fetches suggestions (cache key includes the protection set).

### 2. Auto-seed protections from trip DNA / archetype
On first render, if `coach_protected_categories` is `null` (never set), seed defaults from the trip's `blended_dna` / `dna_snapshot`:

| DNA signal | Seeded protections |
|---|---|
| `gourmand`, `food`, `luminary`, `michelin`, `culinary` | Dining |
| `luxe`, `luxury`, `palace` | Hotels, Dining |
| `cultural`, `museums-first` | Tours |
| (none of the above) | `[]` |

Seeded values are pre-checked but fully overridable. After the first save, we never auto-mutate the user's set again.

### 3. Per-suggestion "Don't suggest again"
On every suggestion card, add a small `×` next to "Apply":

```
[ Apply ] [ × Don't suggest ]
```

Clicking `×`:
- Removes the suggestion from the visible list immediately.
- Adds `{tripId, activityId}` to `localStorage` key `budget-coach:dismissed:{tripId}` (array of activity IDs).
- Sends `dismissed_activity_ids` to the edge function on next fetch so they never resurface.

This is the lightest-touch escape valve when category-level protection is too blunt (e.g., user wants to keep L'Arpège specifically but is fine letting the coach touch a different lunch).

### 4. Edge function changes (`supabase/functions/budget-coach/index.ts`)
Accept two new optional fields on the request body:
- `protected_categories: string[]`
- `dismissed_activity_ids: string[]`

Apply defense-in-depth on the server (don't trust the client filter alone):
- **Pre-filter** activities whose `category` (normalized) is in `protected_categories` or whose `id` is in `dismissed_activity_ids` — they never enter the prompt.
- **Reinforce in the system prompt**: append a hard rule listing the protected categories ("These categories are PROTECTED — do not suggest swaps for any item in: Dining, Hotels. The user has explicitly marked them as non-negotiable.").
- **Post-filter** the model's output as a final safety net (drop any suggestion whose `activity_id` matches a filtered-out item — handles model drift).

Category normalization map (handles the messy mix of `dining`/`breakfast`/`lunch`/`dinner`/`cafe`/`food` all being "Dining" from the user's perspective):

```text
Dining     → dining, breakfast, lunch, dinner, brunch, cafe, coffee, food, restaurant
Hotels     → hotel, accommodation, lodging, stay
Tours      → tour, guided_tour, experience, attraction
Transit    → transit, transport, taxi, train, flight, transfer
Activities → activity, sightseeing, museum, gallery, culture, wellness, shopping
```

### 5. Empty-state UX
If protection rules + dismissals leave nothing for the coach to suggest, show:

> All suggestable items are protected. Loosen a category above to see savings, or adjust your budget target.

…with a "Clear protections" link.

## Files touched

- **migration** — add `coach_protected_categories text[] not null default '{}'` to `trip_budget_settings`. (No RLS changes; existing policies cover.)
- `src/services/tripBudgetService.ts` — read/write the new column on `TripBudgetSettings`.
- `src/components/planner/budget/BudgetCoach.tsx` —
  - Accept `protectedCategories`, `setProtectedCategories`, `dismissedIds`, `setDismissedIds` (or read/write directly via callbacks).
  - Render category chip row above suggestions.
  - Render "× Don't suggest" button per card.
  - Re-fetch on protection change; include both arrays in cache key + edge call.
  - Empty-state message.
- `src/components/planner/budget/BudgetTab.tsx` — wire `settings.coach_protected_categories` ↔ `BudgetCoach`; on first load, derive seed from `blended_dna` if column is `null`.
- `src/hooks/useTripBudget.ts` — expose update method for `coach_protected_categories`.
- `supabase/functions/budget-coach/index.ts` — accept new fields, apply pre-filter, reinforce prompt, post-filter.

## Out of scope

- Letting users protect a *single named venue* without dismissing it (they can already lock the activity in the itinerary, which the coach already respects).
- A "trip intent" picker separate from DNA — DNA is already the canonical intent and we shouldn't fork it.
- Server-side persistence of dismissals — keeping them in `localStorage` is fine for v1; if user clears storage, dismissals reset (acceptable since the chip-level protection still holds).
