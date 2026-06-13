-- Fix: link-invite rotation/refresh always failed with
-- 'duplicate key value violates unique constraint "unique_active_email_invite"'.
--
-- The index is NAMED "active" but its predicate never filtered to active rows:
--   UNIQUE (trip_id, email) NULLS NOT DISTINCT   -- counts soft-deleted rows too
--
-- resolve_or_rotate_invite (and the expired/exhausted refresh path) soft-delete
-- the old invite (replaced_at = now()) then INSERT a replacement. But the old
-- row still EXISTS with email = NULL, and NULLS NOT DISTINCT makes every
-- email-less link-invite for a trip collide — so the replacement INSERT always
-- violated the constraint. Effect in production: any share link that is
-- rotated, expires (30-day), or exhausts max_uses could never be regenerated.
--
-- Fix: make the index PARTIAL — enforce uniqueness only over ACTIVE invites
-- (replaced_at IS NULL), which is what the name always promised. Soft-deleted
-- history rows no longer block a fresh active invite.

-- The old index was backed by a table CONSTRAINT, so a bare DROP INDEX fails
-- ('cannot drop index ... because constraint ... requires it'). Drop the
-- constraint first (a no-op if it was only ever an index), then the index.
ALTER TABLE public.trip_invites DROP CONSTRAINT IF EXISTS unique_active_email_invite;
DROP INDEX IF EXISTS public.unique_active_email_invite;

CREATE UNIQUE INDEX unique_active_email_invite
  ON public.trip_invites (trip_id, email) NULLS NOT DISTINCT
  WHERE replaced_at IS NULL;
