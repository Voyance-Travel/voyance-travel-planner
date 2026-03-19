

## Fix: Prevent AI from silently overwriting day titles during minor edits

### Problem

When the AI processes a minor edit like "add a coffee stop," the `rewrite_day` executor at line 282 of `itineraryActionExecutor.ts` does:
```
updatedDays[dayIndex] = { ...day, ...data.day, activities: newActivities };
```
The `...data.day` spread overwrites **all** day-level metadata — including `headline`, `theme`, and `description` — with whatever the AI regenerated. The diff system (`computeDayDiff`) only compares activities, so the title change is invisible in both auto-apply and review-first modes.

### Fix (2 files)

**1. `src/services/itineraryActionExecutor.ts` — Preserve day metadata during rewrite**

Replace the blind spread at line 282 with selective merging that preserves the original day's `headline`, `theme`, and `description` unless the rewrite instructions explicitly mention renaming or re-theming the day.

```typescript
// Only take activities from data.day; preserve original day metadata
const preserveKeys = ['headline', 'theme', 'description'];
const mergedDay = { ...day, activities: newActivities };
// Only accept AI's new metadata if it actually differs AND instructions explicitly asked for it
const themeKeywords = /rename|retheme|new theme|change.*title|new.*title/i;
if (themeKeywords.test(instructions || '')) {
  // User asked for a title change — accept AI's values
  Object.assign(mergedDay, pick(data.day, preserveKeys));
}
updatedDays[dayIndex] = mergedDay;
```

This ensures "add a coffee stop" never touches the day title, while "retheme this day around food" still allows it.

**2. `src/services/itineraryActionExecutor.ts` — Surface day title changes in diff**

Enhance `computeDayDiff` (or add a check in `executeRewriteDayAction`) to detect when `data.day.headline` differs from `day.headline`, and include a `modified` diff entry with type context so the review card can show "Day title changed from X → Y" when it does happen.

### Scope
Single file: `src/services/itineraryActionExecutor.ts`. No edge function changes needed — the issue is entirely in the client-side executor.

