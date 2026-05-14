-- Backfill: remove the persistent "floating dining card after airport transfer"
-- on departure days from BOTH the trips.itinerary_data JSON snapshot AND the
-- normalized itinerary_activities table. Universal locking is honored: locked,
-- user-added, user-edited, manual, extracted, and pinned rows are exempt.
--
-- Root cause: the Validation Gate's default critical handler was blanking
-- `startTime` instead of dropping the activity for LOGISTICS_SEQUENCE failures
-- (post-checkout dining injected by the meal guard). The chain-generation
-- persist path also bypassed the save-time §15z safety net.

-- ── 1. Clean JSON (trips.itinerary_data) ────────────────────────────────────
with last_day_rows as (
  select
    t.id as trip_id,
    jsonb_array_length(coalesce(t.itinerary_data->'days','[]'::jsonb)) as n
  from public.trips t
  where t.itinerary_status::text in ('ready','partial')
    and t.itinerary_data ? 'days'
    and jsonb_array_length(coalesce(t.itinerary_data->'days','[]'::jsonb)) > 0
),
expanded as (
  select
    ld.trip_id,
    ld.n,
    d.day,
    (d.ord)::int as ord,
    a.act,
    (a.aord)::int as aord
  from last_day_rows ld
  join public.trips t on t.id = ld.trip_id
  cross join lateral jsonb_array_elements(t.itinerary_data->'days') with ordinality d(day, ord)
  cross join lateral jsonb_array_elements(coalesce(d.day->'activities','[]'::jsonb)) with ordinality a(act, aord)
  where d.ord = ld.n
),
bad_indices as (
  select
    trip_id,
    n,
    array_agg((aord - 1)::int order by aord) as remove_indices
  from expanded
  where coalesce(act->>'startTime', act->>'start_time', act->>'time', '') = ''
    and (
      (act->>'category') ~* 'dining|restaurant|food|cafe'
      or (act->>'title') ~* '\m(breakfast|brunch|lunch|dinner|supper|restaurant|cafe|bistro|trattoria|osteria)\M'
    )
    and not coalesce((act->>'isLocked')::boolean, false)
    and not coalesce((act->>'locked')::boolean, false)
    and not coalesce((act->>'userAdded')::boolean, false)
    and not coalesce((act->>'userEdited')::boolean, false)
    and not coalesce((act->>'isManual')::boolean, false)
    and not coalesce((act->>'extracted')::boolean, false)
    and not coalesce((act->>'pinned')::boolean, false)
  group by trip_id, n
),
filtered as (
  select
    bi.trip_id,
    bi.n,
    coalesce(
      (
        select jsonb_agg(elem order by ord)
        from jsonb_array_elements(t.itinerary_data->'days'->(bi.n - 1)->'activities')
             with ordinality e(elem, ord)
        where (ord - 1) <> all (bi.remove_indices)
      ),
      '[]'::jsonb
    ) as new_acts
  from bad_indices bi
  join public.trips t on t.id = bi.trip_id
)
update public.trips t
set itinerary_data = jsonb_set(
      t.itinerary_data,
      array['days', (f.n - 1)::text, 'activities'],
      f.new_acts,
      true
    ),
    metadata = coalesce(t.metadata, '{}'::jsonb) || jsonb_build_object(
      'departure_day_floating_dining_backfill_at', to_jsonb(now())
    )
from filtered f
where t.id = f.trip_id;

-- ── 2. Clean normalized rows (itinerary_activities) ──────────────────────────
-- For each affected trip, drop activity rows on the LAST day that have an
-- empty start_time AND a dining-shaped category/title AND aren't locked.
with last_day_per_trip as (
  select trip_id, max(day_number) as last_day
  from public.itinerary_days
  group by trip_id
),
last_day_ids as (
  select d.id as itinerary_day_id, d.trip_id
  from public.itinerary_days d
  join last_day_per_trip lp on lp.trip_id = d.trip_id and lp.last_day = d.day_number
)
delete from public.itinerary_activities a
using last_day_ids l
where a.itinerary_day_id = l.itinerary_day_id
  and (a.start_time is null or a.start_time = '')
  and (
    coalesce(lower(a.category), '') ~* 'dining|restaurant|food|cafe'
    or coalesce(lower(a.title), '') ~* '\m(breakfast|brunch|lunch|dinner|supper|restaurant|cafe|bistro|trattoria|osteria)\M'
  )
  and coalesce(a.is_locked, false) = false;
