

## Fix: Suggestion deadline not persisting — missing UPDATE RLS policy

### Root Cause

The `trip_suggestions` table has **no UPDATE policy**. Only SELECT and INSERT policies exist. When a user clicks "Set deadline" on an existing suggestion card, `handleUpdateDeadline` calls `.update()` on `trip_suggestions`, but RLS silently blocks it (returns success with 0 rows affected). The deadline is never saved.

This also means the "Set deadline" button at creation time **does** work (it's an INSERT), but post-creation deadline changes via the popover fail silently.

### Fix

**1. Add UPDATE RLS policy (database migration)**

Create an UPDATE policy allowing suggestion owners (and trip owners) to update their suggestions:

```sql
CREATE POLICY "Users can update their own suggestions"
ON public.trip_suggestions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

This lets authenticated users update suggestions they created. Trip owners who want to moderate deadlines on others' suggestions would need a broader policy, but for now scoping to the suggestion author is safest.

**2. Add error handling in `handleUpdateDeadline` (`TripSuggestions.tsx`)**

Currently the function at line 308 doesn't check if the update actually affected any rows. After adding the RLS policy the update will work, but we should also add a `.select().single()` or check the response to surface failures instead of silently swallowing them.

### Scope
- One database migration (add UPDATE policy)
- Minor improvement to error feedback in `TripSuggestions.tsx`

