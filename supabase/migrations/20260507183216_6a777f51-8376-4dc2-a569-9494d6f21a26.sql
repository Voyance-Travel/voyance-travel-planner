-- One-time scrub: replace "<Meal> — pick a restaurant/café" sentinels left in
-- itinerary_data with real venues from a small per-country/per-city map.
-- Skips locked / user / manual / extracted / pinned activities.

CREATE OR REPLACE FUNCTION public._scrub_pick_meal_sentinels_jsonb(input jsonb, trip_destination text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb;
  city_key text;
  -- mapping: city_key => [breakfast, lunch, dinner] each as jsonb {name,address,price}
  map jsonb := '{
    "venice": {
      "breakfast": {"name":"Pasticceria Tonolo","address":"Calle S. Pantalon 3764, 30123 Venezia VE, Italy","price":8,"description":"Cult Dorsoduro pastry counter since 1886."},
      "lunch":     {"name":"All''Arco","address":"Calle dell''Occhialer 436, 30125 Venezia VE, Italy","price":18,"description":"Tiny San Polo cicchetti bar steps from the Rialto."},
      "dinner":    {"name":"Antiche Carampane","address":"Rio Terà de le Carampane 1911, 30125 Venezia VE, Italy","price":80,"description":"Hidden San Polo trattoria. A Venetian benchmark."}
    },
    "rome": {
      "breakfast": {"name":"Sant''Eustachio Il Caffè","address":"Piazza di S. Eustachio 82, Rome, Italy","price":10,"description":"Italy''s most iconic espresso bar."},
      "lunch":     {"name":"Roscioli Salumeria","address":"Via dei Giubbonari 21, 00186 Rome","price":45,"description":"Legendary deli-restaurant — outstanding cacio e pepe."},
      "dinner":    {"name":"Da Enzo al 29","address":"Via dei Vascellari 29, 00153 Rome","price":35,"description":"Trastevere institution. Perfect cacio e pepe and carbonara."}
    },
    "paris": {
      "breakfast": {"name":"Du Pain et des Idées","address":"34 Rue Yves Toudic, 75010 Paris","price":12,"description":"Christophe Vasseur''s cult bakery."},
      "lunch":     {"name":"Bouillon Pigalle","address":"22 Bd de Clichy, 75018 Paris","price":25,"description":"Stunning Belle Époque brasserie."},
      "dinner":    {"name":"Le Comptoir du Relais","address":"9 Carrefour de l''Odéon, 75006 Paris","price":65,"description":"Yves Camdeborde''s iconic bistro."}
    },
    "london": {
      "breakfast": {"name":"Dishoom","address":"12 Upper St Martin''s Ln, WC2H 9FB London","price":20,"description":"Bombay café reimagined."},
      "lunch":     {"name":"Padella","address":"6 Southwark St, SE1 1TQ London","price":18,"description":"Borough Market hand-rolled pasta."},
      "dinner":    {"name":"St. JOHN","address":"26 St John St, EC1M 4AY London","price":60,"description":"Fergus Henderson''s nose-to-tail manifesto."}
    },
    "barcelona": {
      "breakfast": {"name":"Granja M. Viader","address":"Carrer d''en Xuclà 4, Barcelona","price":10,"description":"Historic dairy bar (1870)."},
      "lunch":     {"name":"Bar Pinotxo","address":"La Boqueria, La Rambla 91, Barcelona","price":25,"description":"Juanito Bayén''s market counter."},
      "dinner":    {"name":"Cal Pep","address":"Plaça de les Olles 8, 08003 Barcelona","price":55,"description":"Counter-seating tapas bar near Born."}
    },
    "lisbon": {
      "breakfast": {"name":"Manteigaria","address":"R. do Loreto 2, 1200-242 Lisbon","price":4,"description":"Pastéis de nata baked all day at the counter."},
      "lunch":     {"name":"Cervejaria Ramiro","address":"Av. Almirante Reis 1H, 1150-007 Lisbon","price":45,"description":"Legendary seafood beer hall."},
      "dinner":    {"name":"Solar dos Presuntos","address":"R. das Portas de Santo Antão 150, Lisbon","price":55,"description":"Minho-style cooking. Legendary presunto."}
    },
    "berlin": {
      "breakfast": {"name":"Café Einstein Stammhaus","address":"Kurfürstenstraße 58, 10785 Berlin","price":20,"description":"Grand Viennese-style café in a historic villa."},
      "lunch":     {"name":"Curry 36","address":"Mehringdamm 36, 10961 Berlin","price":8,"description":"Iconic Berlin currywurst stand since 1980."},
      "dinner":    {"name":"Zur Letzten Instanz","address":"Waisenstraße 14-16, 10179 Berlin","price":35,"description":"Berlin''s oldest restaurant (1621)."}
    }
  }'::jsonb;
  city_data jsonb;
  days_arr jsonb;
  day_obj jsonb;
  acts jsonb;
  act jsonb;
  new_acts jsonb;
  new_days jsonb;
  d_idx int;
  a_idx int;
  title text;
  meal_type text;
  sub jsonb;
  src text;
  is_locked bool;
BEGIN
  IF input IS NULL OR input->'days' IS NULL THEN
    RETURN input;
  END IF;

  city_key := lower(coalesce(split_part(trip_destination, ',', 1), ''));
  city_key := trim(city_key);
  city_data := map -> city_key;

  -- If exact city not in map, try contains-match
  IF city_data IS NULL THEN
    FOR city_key IN SELECT k FROM jsonb_object_keys(map) k LOOP
      IF position(city_key in lower(coalesce(trip_destination,''))) > 0 THEN
        city_data := map -> city_key;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF city_data IS NULL THEN
    -- No mapping; leave it (frontend will surface needsVenuePick)
    RETURN input;
  END IF;

  days_arr := input -> 'days';
  new_days := '[]'::jsonb;

  FOR d_idx IN 0 .. jsonb_array_length(days_arr) - 1 LOOP
    day_obj := days_arr -> d_idx;
    acts := day_obj -> 'activities';
    IF acts IS NULL OR jsonb_typeof(acts) <> 'array' THEN
      new_days := new_days || jsonb_build_array(day_obj);
      CONTINUE;
    END IF;

    new_acts := '[]'::jsonb;
    FOR a_idx IN 0 .. jsonb_array_length(acts) - 1 LOOP
      act := acts -> a_idx;
      title := lower(coalesce(act->>'title', ''));
      src := coalesce(act->>'source','');
      is_locked := coalesce((act->>'is_locked')::bool, false)
                OR coalesce((act->>'isLocked')::bool, false)
                OR coalesce((act->>'pinned')::bool, false)
                OR src IN ('user','manual','extracted','pinned','user_added');

      IF NOT is_locked AND (title LIKE '%pick a restaurant%' OR title LIKE '%pick a café%' OR title LIKE '%pick a cafe%') THEN
        meal_type := CASE
          WHEN title LIKE '%breakfast%' OR title LIKE '%café%' OR title LIKE '%cafe%' THEN 'breakfast'
          WHEN title LIKE '%lunch%' THEN 'lunch'
          ELSE 'dinner'
        END;
        sub := city_data -> meal_type;
        IF sub IS NOT NULL THEN
          act := act
            || jsonb_build_object(
                 'title', initcap(meal_type) || ' at ' || (sub->>'name'),
                 'name',  initcap(meal_type) || ' at ' || (sub->>'name'),
                 'venue_name', sub->>'name',
                 'description', sub->>'description',
                 'location', jsonb_build_object('name', sub->>'name', 'address', sub->>'address'),
                 'cost', jsonb_build_object('amount', (sub->>'price')::int, 'currency', 'USD', 'source', 'sentinel_scrub'),
                 'cost_per_person', (sub->>'price')::int,
                 'needsRefinement', false
               );
          -- strip needsVenuePick metadata
          IF act ? 'metadata' THEN
            act := jsonb_set(act, '{metadata}', (act->'metadata') - 'needsVenuePick' - 'unverified_venue', false);
          END IF;
          act := act - 'needsVenuePick';
        END IF;
      END IF;

      new_acts := new_acts || jsonb_build_array(act);
    END LOOP;

    new_days := new_days || jsonb_build_array(jsonb_set(day_obj, '{activities}', new_acts));
  END LOOP;

  result := jsonb_set(input, '{days}', new_days);
  RETURN result;
END;
$$;

UPDATE public.trips
SET itinerary_data = public._scrub_pick_meal_sentinels_jsonb(itinerary_data, destination)
WHERE itinerary_data IS NOT NULL
  AND (itinerary_data::text ILIKE '%pick a restaurant%'
    OR itinerary_data::text ILIKE '%pick a café%'
    OR itinerary_data::text ILIKE '%pick a cafe%');

DROP FUNCTION public._scrub_pick_meal_sentinels_jsonb(jsonb, text);
