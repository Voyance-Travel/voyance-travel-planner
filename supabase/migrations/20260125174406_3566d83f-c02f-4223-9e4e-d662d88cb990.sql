-- Fix foreign key constraints that block user deletion
-- These constraints use NO ACTION which prevents cascade deletion

-- 1. Fix trip_collaborators.invited_by - SET NULL when the inviter is deleted
ALTER TABLE trip_collaborators 
DROP CONSTRAINT IF EXISTS trip_collaborators_invited_by_fkey;

ALTER TABLE trip_collaborators 
ADD CONSTRAINT trip_collaborators_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Fix trip_invites.accepted_by - SET NULL when the user who accepted is deleted
ALTER TABLE trip_invites 
DROP CONSTRAINT IF EXISTS trip_invites_accepted_by_fkey;

ALTER TABLE trip_invites 
ADD CONSTRAINT trip_invites_accepted_by_fkey 
FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Fix trip_intents.user_id - CASCADE when the user is deleted (intent belongs to user)
ALTER TABLE trip_intents 
DROP CONSTRAINT IF EXISTS trip_intents_user_id_fkey;

ALTER TABLE trip_intents 
ADD CONSTRAINT trip_intents_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;