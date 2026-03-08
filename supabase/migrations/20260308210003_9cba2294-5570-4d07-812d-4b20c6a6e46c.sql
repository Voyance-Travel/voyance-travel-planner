
-- Add DELETE policies for trip child tables to allow CASCADE deletes

CREATE POLICY "Trip owners can delete notifications"
ON public.trip_notifications FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete cost tracking"
ON public.trip_cost_tracking FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete action usage"
ON public.trip_action_usage FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete complexity"
ON public.trip_complexity FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete day summaries"
ON public.trip_day_summaries FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete departure summaries"
ON public.trip_departure_summaries FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete feedback prompts"
ON public.feedback_prompt_log FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete customization requests"
ON public.itinerary_customization_requests FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete feedback responses"
ON public.trip_feedback_responses FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Trip owners can delete learnings"
ON public.trip_learnings FOR DELETE TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));
