-- Fix promote_user_to_admin function by adding search_path
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    target_user_id uuid;
BEGIN
    -- Find user by email from profiles table
    SELECT p.user_id INTO target_user_id
    FROM public.profiles p
    WHERE p.email = user_email;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;

    -- Remove existing role
    DELETE FROM public.user_roles WHERE user_id = target_user_id;

    -- Add admin role
    INSERT INTO public.user_roles (user_id, role, is_active)
    VALUES (target_user_id, 'admin', true);

    RETURN true;
END;
$function$;