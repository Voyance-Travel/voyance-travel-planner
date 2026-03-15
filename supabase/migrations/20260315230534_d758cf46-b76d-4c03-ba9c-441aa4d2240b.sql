
CREATE TABLE public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  error_message text NOT NULL,
  stack_trace text,
  page_path text,
  component_name text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert errors"
  ON public.client_errors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read errors"
  ON public.client_errors FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_client_errors_created_at ON public.client_errors (created_at DESC);
CREATE INDEX idx_client_errors_session_id ON public.client_errors (session_id);
