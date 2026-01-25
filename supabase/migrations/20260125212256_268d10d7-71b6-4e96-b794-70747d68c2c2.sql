-- Remove 7 unused legacy tables

-- Drop booking-related tables (superseded by Viator integration)
DROP TABLE IF EXISTS public.booking_state_log CASCADE;
DROP TABLE IF EXISTS public.booking_history CASCADE;
DROP TABLE IF EXISTS public.booking_quotes CASCADE;
DROP TABLE IF EXISTS public.booking_offers CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;

-- Drop redundant tables
DROP TABLE IF EXISTS public.user_id_mappings CASCADE;
DROP TABLE IF EXISTS public.destination_images CASCADE;