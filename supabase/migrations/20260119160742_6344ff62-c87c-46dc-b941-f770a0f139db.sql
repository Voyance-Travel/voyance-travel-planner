-- Drop the duplicate trigger that was attempted
DROP TRIGGER IF EXISTS update_user_usage_updated_at ON public.user_usage;

-- Re-create it to ensure it exists
CREATE TRIGGER update_user_usage_updated_at
  BEFORE UPDATE ON public.user_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();