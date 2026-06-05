-- C-ADMIN-2: the admin "Unit Economics" dashboard showed only ONE row under
-- "User Tiers" and "Group Pools" — the admin's OWN — because the SELECT
-- policies on these tables are self-scoped (own user / trip owner / collaborator)
-- with no admin-visibility branch.
--
-- Add ADDITIVE, SELECT-only admin policies so an admin can read all rows.
-- RLS policies are OR-ed, so existing self-scoped reads are unchanged; admins
-- simply gain read visibility. No write escalation. Mirrors the existing
-- "Admins can manage curated images" pattern (current-user has_role check).

-- user_tiers
DROP POLICY IF EXISTS "Admins can view all user tiers" ON public.user_tiers;
CREATE POLICY "Admins can view all user tiers"
  ON public.user_tiers
  FOR SELECT
  TO authenticated
  USING (public.has_role('admin'::public.app_role));

-- group_budgets
DROP POLICY IF EXISTS "Admins can view all group budgets" ON public.group_budgets;
CREATE POLICY "Admins can view all group budgets"
  ON public.group_budgets
  FOR SELECT
  TO authenticated
  USING (public.has_role('admin'::public.app_role));
