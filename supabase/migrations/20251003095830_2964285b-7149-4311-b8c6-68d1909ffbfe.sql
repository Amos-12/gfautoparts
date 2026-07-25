-- Add approval flag to user_roles so admin can activate sellers after signup
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

-- Update the new-user handler to assign default seller role with is_active = false
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone'
  );
  
  -- Assign default seller role, not active until admin approval
  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, 'seller', false);
  
  RETURN NEW;
END;
$$;