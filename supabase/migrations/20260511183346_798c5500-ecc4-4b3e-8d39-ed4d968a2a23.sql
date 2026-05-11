DROP POLICY IF EXISTS "Public can view shared trips by token" ON public.agency_trips;
DROP POLICY IF EXISTS "Anon can read suggestions for shared agency trips" ON public.trip_suggestions;
DROP POLICY IF EXISTS "Anon can read votes for shared agency trips" ON public.trip_suggestion_votes;
DROP POLICY IF EXISTS "Shared trip viewers can read chat" ON public.trip_chat_messages;