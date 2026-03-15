

## Show Collaborator Attribution Dots on Activity Cards

### Problem
Two issues:
1. **Mobile: Dots never show** — The attribution dot/badge is inside a `hidden sm:flex` container (line 9316), so on mobile viewports it's completely invisible.
2. **New member activities lack `suggestedFor`** — The `onAddActivities` handler (line 5049) is a TODO stub that only shows a toast. No activities are actually generated or tagged with the new member's user ID, so even on desktop there are no dots to show for them.

### Changes

#### 1. Add mobile attribution dot — `EditorialItinerary.tsx` (~line 9453-9455)

Add a small collaborator dot next to the activity title on mobile. Right after the `<h4>` title element (which renders on all screen sizes), add a `sm:hidden` inline dot that shows attribution on mobile:

```tsx
{/* Mobile-only attribution dot */}
{activity.suggestedFor && collaboratorColorMap && (() => {
  const ids = activity.suggestedFor!.split(',').map(s => s.trim()).filter(id => collaboratorColorMap.has(id));
  if (ids.length === 0) return null;
  const attrs = ids.map(id => collaboratorColorMap.get(id)!);
  return (
    <span className="sm:hidden inline-flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
      <span className="inline-flex -space-x-0.5">
        {attrs.map(attr => {
          const colors = getCollaboratorColor(attr.colorIndex);
          return <span key={attr.userId} className={cn("h-2 w-2 rounded-full", colors.dot)} />;
        })}
      </span>
      {attrs.length === 1 ? `For ${attrs[0].name}` : `For ${attrs.map(a => a.name).join(' & ')}`}
    </span>
  );
})()}
```

This goes in **both** render paths — the dining venue path (~line 9437) and the generic title path (~line 9455).

#### 2. Wire `onAddActivities` to regenerate days with new member attribution — `EditorialItinerary.tsx` (~line 5049)

Replace the TODO stub with actual logic:
- Look up the new member's user ID from `collaboratorColorMap` by matching `memberName`
- Call the existing day regeneration function (used by "Regenerate Day") for each day, which already handles `suggestedFor` backfill via the backend guarantee
- The backend's existing backfill logic (line 9626 in `generate-itinerary/index.ts`) will automatically assign `suggestedFor` to the new member on some activities via round-robin

```tsx
onAddActivities={() => {
  // Find new member's userId from collaboratorColorMap
  const memberAttr = Array.from(collaboratorColorMap?.values() || [])
    .find(a => a.name === newlyAddedMember);
  
  toast.success(`Regenerating itinerary to include ${newlyAddedMember}'s preferences...`);
  
  // Trigger full regeneration which will blend the new member's DNA
  // and the backend backfill guarantees suggestedFor attribution
  handleRegenerateAllDays?.();
}}
```

This leverages the existing regeneration pipeline which already:
- Queries `trip_collaborators` + `trip_members` for all participants
- Blends DNA with 50/50 owner/guests weighting
- Backfills `suggestedFor` on every activity via round-robin

### Files to Modify

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Add mobile `sm:hidden` attribution dot after activity titles; wire `onAddActivities` to trigger regeneration |

