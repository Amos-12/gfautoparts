-- Remove duplicate seller role for super_admin user, keep only super_admin role
DELETE FROM public.user_roles 
WHERE user_id = 'f2d09493-1e61-4bbf-844e-62789ffc840a' 
AND role = 'seller';

-- Ensure super_admin entry is active
UPDATE public.user_roles 
SET is_active = true 
WHERE user_id = 'f2d09493-1e61-4bbf-844e-62789ffc840a' 
AND role = 'super_admin';