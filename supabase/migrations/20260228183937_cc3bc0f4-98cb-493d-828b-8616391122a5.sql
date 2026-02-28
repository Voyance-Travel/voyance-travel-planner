-- Add flight_intelligence JSONB column to trips table
-- Stores destinationSchedule, layovers, missingLegs, route, and warnings from AI analysis
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS flight_intelligence JSONB DEFAULT NULL;