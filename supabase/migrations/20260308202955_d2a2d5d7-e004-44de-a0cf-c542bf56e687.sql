ALTER TABLE public.activity_feedback DROP CONSTRAINT IF EXISTS activity_feedback_activity_id_fkey;
ALTER TABLE public.activity_feedback ALTER COLUMN activity_id TYPE text USING activity_id::text;