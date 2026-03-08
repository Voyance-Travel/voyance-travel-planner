

## Bug Fix: Trip Delete Silently Fails Due to Missing RLS DELETE Policies on Child Tables

### Root Cause
When deleting a trip, PostgreSQL CASCADE tries to delete child rows from related tables. Several child tables have **RLS enabled** but **no DELETE policy for authenticated users** — only service-role policies. This causes the CASCADE (and thus the entire trip DELETE) to silently fail. The trip is removed from local state (`setTrips`), but the DB delete never commits, so the trip reappears on next load.

Confirmed: The Mallorca trip (`af57d82b...`) still exists in the database with child rows in `trip_notifications` (3), `trip_action_usage` (2), `trip_cost_tracking` (1), and `trip_budget_ledger` (38).

### Fix: Database Migration

Add DELETE policies to all child tables that are missing them. Each policy allows the **trip owner** to cascade-delete child rows:

```sql
-- Tables with RLS enabled but no user-facing DELETE policy:

-- trip_notifications (has service-role ALL only)
CREATE POLICY "Trip owners can delete notifications"
ON public.trip_notifications FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- trip_cost_tracking (has SET NULL FK, but still needs policy if rows exist)
CREATE POLICY "Trip owners can delete cost tracking"
ON public.trip_cost_tracking FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- trip_action_usage
CREATE POLICY "Trip owners can delete action usage"
ON public.trip_action_usage FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- trip_complexity (has service-role ALL only)
CREATE POLICY "Trip owners can delete complexity"
ON public.trip_complexity FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- trip_day_summaries
CREATE POLICY "Trip owners can delete day summaries"
ON public.trip_day_summaries FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- trip_departure_summaries
CREATE POLICY "Trip owners can delete departure summaries"
ON public.trip_departure_summaries FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- feedback_prompt_log
CREATE POLICY "Trip owners can delete feedback prompts"
ON public.feedback_prompt_log FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- itinerary_customization_requests
CREATE POLICY "Trip owners can delete customization requests"
ON public.itinerary_customization_requests FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- trip_feedback_responses
CREATE POLICY "Trip owners can delete feedback responses"
ON public.trip_feedback_responses FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

-- trip_learnings
CREATE POLICY "Trip owners can delete learnings"
ON public.trip_learnings FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));
```

### No Frontend Changes Needed
The delete logic in `TripDashboard.tsx` is correct — it calls `supabase.from('trips').delete().eq('id', trip.id)` and handles `onDelete` properly. The only issue was the silent RLS failure on cascade.

### Summary
- **1 file**: Database migration adding 10 DELETE policies
- **0 frontend changes**

