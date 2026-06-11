-- Atomic per-day merge for the V2 parallel self-invoke generation.
-- ROOT CAUSE (proven, see memory/v2-parallel-race-root.md): each per-day request
-- read-modify-writes the WHOLE itinerary_data.days array. During generation the
-- regression/identity guards are bypassed (status='generating'), so concurrent
-- per-day writes clobber each other — 10 concurrent overwrites kept only 1 day in
-- a local repro; the atomic merge below kept all 10.
--
-- CRITICAL — match by dayNumber, NOT array index. An earlier hand-written version
-- used jsonb_set(days, ARRAY[p_day_number::text], ...), i.e. it treated p_day_number
-- as the ARRAY INDEX. dayNumber is 1-based and is NOT the array position, so
-- re-healing day 1 of [day1,day2,day3] overwrote index 1 = DAY 2 (proven: re-heal →
-- dayNumbers [1,1,3], day 2 destroyed). Re-heals are the common path, so that bug
-- actively loses days. This version drops the element whose dayNumber matches,
-- appends the new day, and re-sorts — so it upserts the correct day every time.
create or replace function public.merge_trip_day(
  p_trip_id    uuid,
  p_day_number int,
  p_day_data   jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cur    jsonb;
  merged jsonb;
begin
  -- FOR UPDATE row lock = atomic read-modify-write; concurrent merges serialize.
  select coalesce(itinerary_data->'days', '[]'::jsonb)
    into cur
    from trips where id = p_trip_id for update;

  if cur is null then
    return null; -- trip not found
  end if;

  -- Replace-or-append by dayNumber (never by array position), then sort by dayNumber.
  select coalesce(jsonb_agg(e order by (e->>'dayNumber')::int), '[]'::jsonb)
    into merged
    from (
      select d as e
        from jsonb_array_elements(cur) d
       where (d->>'dayNumber')::int is distinct from p_day_number
      union all
      select p_day_data
    ) s;

  update trips
     set itinerary_data = jsonb_set(coalesce(itinerary_data, '{}'::jsonb), '{days}', merged),
         updated_at = now()
   where id = p_trip_id;

  return merged;
end;
$$;

grant execute on function public.merge_trip_day(uuid, int, jsonb) to service_role;
