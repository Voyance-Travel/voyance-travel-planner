ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.generation_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.generation_logs FROM anon;