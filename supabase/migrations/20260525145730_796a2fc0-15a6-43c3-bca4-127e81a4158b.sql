-- Rome trip d18b2e8a deterministic must-do injection (one-shot).
-- Adds Pantheon + Trevi Fountain (Day 3) and Vatican Museums + St. Peter's
-- Basilica (Day 2) as locked must-do anchors. Leaves Day 1 Colosseum where
-- it is (the LANDMARK_AFTER_DARK repair pass will retime it on next save).
-- Re-stamps must_do_coverage = all 4 scheduled; clears stale repair flag.

DO $$
DECLARE
  v_trip_id uuid := 'd18b2e8a-310e-42c8-a7aa-aac61076a234';
  v_itin jsonb;
  v_days jsonb;
  v_d2_acts jsonb;
  v_d3_acts jsonb;
  v_meta jsonb;
BEGIN
  SELECT itinerary_data, metadata INTO v_itin, v_meta FROM trips WHERE id = v_trip_id;
  IF v_itin IS NULL THEN RAISE NOTICE 'Trip not found'; RETURN; END IF;
  v_days := v_itin->'days';

  -- Day 2 activities → prepend Vatican block
  v_d2_acts := (v_days->1)->'activities';
  v_d2_acts := jsonb_build_array(
    jsonb_build_object(
      'id', 'must-do-d2-vatican-museums-' || extract(epoch from now())::bigint,
      'title', 'Vatican Museums & Sistine Chapel',
      'name', 'Vatican Museums & Sistine Chapel',
      'startTime', '09:00', 'endTime', '12:30', 'durationMinutes', 210,
      'category', 'museum',
      'venue_name', 'Vatican Museums',
      'location', jsonb_build_object('name', 'Vatican Museums', 'address', 'Viale Vaticano, 00165 Roma RM, Italy'),
      'cost', jsonb_build_object('amount', 0, 'currency', 'USD'),
      'description', '',
      'locked', true, 'isLocked', true,
      'lockedSource', 'must_do:Vatican Museums',
      'anchorSource', 'must_do',
      'needsAnchorEnrichment', true,
      'source', 'must-do-injection'
    ),
    jsonb_build_object(
      'id', 'must-do-d2-st-peters-' || extract(epoch from now())::bigint,
      'title', 'St. Peter''s Basilica',
      'name', 'St. Peter''s Basilica',
      'startTime', '12:45', 'endTime', '14:00', 'durationMinutes', 75,
      'category', 'religious',
      'venue_name', 'St. Peter''s Basilica',
      'location', jsonb_build_object('name', 'St. Peter''s Basilica', 'address', 'Piazza San Pietro, 00120 Città del Vaticano'),
      'cost', jsonb_build_object('amount', 0, 'currency', 'USD'),
      'description', '',
      'locked', true, 'isLocked', true,
      'lockedSource', 'must_do:St Peters Basilica',
      'anchorSource', 'must_do',
      'needsAnchorEnrichment', true,
      'source', 'must-do-injection'
    )
  ) || COALESCE(v_d2_acts, '[]'::jsonb);

  -- Day 3: insert Pantheon (10:30-11:30) and Trevi Fountain (17:30-18:15)
  v_d3_acts := (v_days->2)->'activities';
  v_d3_acts := COALESCE(v_d3_acts, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'id', 'must-do-d3-pantheon-' || extract(epoch from now())::bigint,
      'title', 'Pantheon',
      'name', 'Pantheon',
      'startTime', '10:30', 'endTime', '11:30', 'durationMinutes', 60,
      'category', 'landmark',
      'venue_name', 'Pantheon',
      'location', jsonb_build_object('name', 'Pantheon', 'address', 'Piazza della Rotonda, 00186 Roma RM, Italy'),
      'cost', jsonb_build_object('amount', 0, 'currency', 'USD'),
      'description', '',
      'locked', true, 'isLocked', true,
      'lockedSource', 'must_do:Pantheon',
      'anchorSource', 'must_do',
      'needsAnchorEnrichment', true,
      'source', 'must-do-injection'
    ),
    jsonb_build_object(
      'id', 'must-do-d3-trevi-' || extract(epoch from now())::bigint,
      'title', 'Trevi Fountain',
      'name', 'Trevi Fountain',
      'startTime', '17:30', 'endTime', '18:15', 'durationMinutes', 45,
      'category', 'landmark',
      'venue_name', 'Trevi Fountain',
      'location', jsonb_build_object('name', 'Trevi Fountain', 'address', 'Piazza di Trevi, 00187 Roma RM, Italy'),
      'cost', jsonb_build_object('amount', 0, 'currency', 'USD'),
      'description', '',
      'locked', true, 'isLocked', true,
      'lockedSource', 'must_do:Trevi Fountain',
      'anchorSource', 'must_do',
      'needsAnchorEnrichment', true,
      'source', 'must-do-injection'
    )
  );

  v_days := jsonb_set(v_days, '{1,activities}', v_d2_acts);
  v_days := jsonb_set(v_days, '{2,activities}', v_d3_acts);
  v_itin := jsonb_set(v_itin, '{days}', v_days);

  -- Refresh metadata: stamp coverage covered, clear stale repair flag, unfreeze.
  v_meta := COALESCE(v_meta, '{}'::jsonb)
    || jsonb_build_object(
      'must_do_coverage', jsonb_build_object(
        'missing', '[]'::jsonb,
        'scheduled', jsonb_build_array('Colosseum', 'Pantheon', 'Trevi Fountain', 'Vatican City (St. Peter''s Basilica & Vatican Museums)'),
        'total', 4,
        'at', now()::text,
        'source', 'sql-backfill-d18b2e8a'
      ),
      'must_do_repair_attempted', jsonb_build_object(
        'at', now()::text,
        'source', 'sql-backfill-d18b2e8a',
        'attempted', jsonb_build_array('Pantheon', 'Trevi Fountain', 'Vatican City (St. Peter''s Basilica & Vatican Museums)'),
        'injected', jsonb_build_array(
          jsonb_build_object('venue', 'Vatican Museums', 'dayNumber', 2, 'startTime', '09:00', 'endTime', '12:30'),
          jsonb_build_object('venue', 'St. Peter''s Basilica', 'dayNumber', 2, 'startTime', '12:45', 'endTime', '14:00'),
          jsonb_build_object('venue', 'Pantheon', 'dayNumber', 3, 'startTime', '10:30', 'endTime', '11:30'),
          jsonb_build_object('venue', 'Trevi Fountain', 'dayNumber', 3, 'startTime', '17:30', 'endTime', '18:15')
        ),
        'stillMissing', '[]'::jsonb
      ),
      'fully_persisted', true,
      'fully_persisted_at', now()::text
    );
  v_meta := v_meta - 'itinerary_frozen_at';

  UPDATE trips
     SET itinerary_data = v_itin,
         metadata = v_meta,
         updated_at = now()
   WHERE id = v_trip_id;

  RAISE NOTICE 'Rome trip d18b2e8a: injected 4 must-do anchors (Vatican x2, Pantheon, Trevi).';
END $$;