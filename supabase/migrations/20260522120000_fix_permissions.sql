-- Fix permissions for has_role function - needed for RLS policies
-- Restore execute permission on has_role for authenticated users
grant execute on function public.has_role(uuid, app_role) to authenticated;

-- Ensure security definer functions are properly configured
-- No need to grant execute on handle_new_user or set_updated_at - they're trigger-only

-- Verify the handle_new_user trigger still exists and is correct
-- (it should have been created in the first migration)
