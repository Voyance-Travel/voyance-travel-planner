

## Fix: Find Alternative Search Text Filter Doesn't Apply

### Problem
The search input in the Find Alternative drawer only fires on explicit form submit (Enter key or Search button click). Typing text does **not** filter the already-loaded 25 results in real-time. Users expect instant filtering as they type, similar to standard search/filter patterns.

### Root cause
`searchQuery` state is only consumed in `handleCustomSearch()` (line 335), which is called on form submit. The rendered results list (lines 622-648) displays `similarAlternatives` and `differentAlternatives` directly with no client-side filtering applied.

### Fix

**File: `src/components/planner/ActivityAlternativesDrawer.tsx`**

1. **Add client-side filtering** — derive `filteredSimilar` and `filteredDifferent` from the search query, filtering by `alt.name`, `alt.category`, `alt.description`, and `alt.location`:

```typescript
const filterByQuery = (alts: AlternativeActivity[]) => {
  if (!searchQuery.trim()) return alts;
  const q = searchQuery.toLowerCase();
  return alts.filter(a =>
    a.name?.toLowerCase().includes(q) ||
    a.category?.toLowerCase().includes(q) ||
    a.description?.toLowerCase().includes(q) ||
    a.location?.toLowerCase().includes(q)
  );
};
const filteredSimilar = filterByQuery(similarAlternatives);
const filteredDifferent = filterByQuery(differentAlternatives);
```

2. **Use filtered lists in render** — replace `similarAlternatives` / `differentAlternatives` with `filteredSimilar` / `filteredDifferent` in the results section (lines 624-647) and in `hasAlternatives` (line 521).

3. **Keep server-side search on submit** — the existing `handleCustomSearch()` still fires on Enter/button click for when the user wants to search for something not in the current results. This gives the best of both worlds: instant local filtering + deeper AI search on submit.

### Scope
Single file, ~15 lines added/changed. No backend changes.

