-- Repair affected Barcelona trip: seed trip_day_intents from metadata must-dos
-- and unfreeze so the user can regenerate to pick up the must-do injection fix.
INSERT INTO public.trip_day_intents (trip_id, user_id, day_number, source_entry_point, intent_kind, title, raw_text, priority, status)
SELECT
  '96d47894-d1f4-4cd7-865f-195912172cc1'::uuid,
  'b7868fe8-36f5-48ce-81e1-758fa79aafde'::uuid,
  NULL,
  'chat_planner',
  'activity',
  v.title,
  v.title,
  'must',
  'active'
FROM (VALUES
  ('Park Güell'),
  ('Barri Gòtic (Gothic Quarter)'),
  ('La Rambla'),
  ('Mercat de la Boqueria'),
  ('Visit Sagrada Família')
) AS v(title)
-- Guard: only seed when the target trip exists. On a fresh DB (e.g. a new
-- Supabase project) the trip is absent, so this becomes a safe no-op instead of
-- a foreign-key violation. On the live DB the trip exists and behavior is unchanged.
WHERE EXISTS (SELECT 1 FROM public.trips WHERE id = '96d47894-d1f4-4cd7-865f-195912172cc1'::uuid)
ON CONFLICT DO NOTHING;

-- Unfreeze so a user-initiated regeneration writes a fresh itinerary.
UPDATE public.trips
SET
  itinerary_status = 'partial',
  metadata = metadata
    - 'itinerary_frozen_at'
    - 'fully_persisted'
    - 'fully_persisted_at'
    - 'must_do_coverage'
    - 'intent_seed_audit'
    || jsonb_build_object(
      'must_do_repair_seeded_at', to_jsonb(now()),
      'bare_itinerary_detected', true
    )
WHERE id = '96d47894-d1f4-4cd7-865f-195912172cc1';