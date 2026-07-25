-- Update handle_new_user() to save user email in profiles and set search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (user_id, full_name, phone, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email
  );
  
  -- Assign default seller role, not active until admin approval
  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, 'seller', false);
  
  RETURN NEW;
END;
$function$;