-- Add include_preferences column to trip_collaborators
ALTER TABLE trip_collaborators 
ADD COLUMN include_preferences BOOLEAN DEFAULT true;

COMMENT ON COLUMN trip_collaborators.include_preferences IS 
'Whether to include this collaborator preferences in itinerary generation blending';