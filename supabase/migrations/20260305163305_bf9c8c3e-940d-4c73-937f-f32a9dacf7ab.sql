
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _company_id uuid;
  _role app_role;
  _is_active boolean;
  _company_name text;
  _raw_company_id text;
BEGIN
  _company_name := NULLIF(TRIM(NEW.raw_user_meta_data ->> 'company_name'), '');
  _raw_company_id := NULLIF(TRIM(NEW.raw_user_meta_data ->> 'company_id'), '');

  -- Try to parse company_id only if it's a valid non-empty string
  IF _raw_company_id IS NOT NULL THEN
    _company_id := _raw_company_id::uuid;
  ELSE
    _company_id := NULL;
  END IF;

  IF _company_name IS NOT NULL THEN
    -- Creating a new company
    INSERT INTO public.companies (name, slug, created_by)
    VALUES (
      _company_name,
      lower(regexp_replace(_company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
      NEW.id
    )
    RETURNING id INTO _company_id;

    _role := 'admin';
    _is_active := true;
  ELSIF _company_id IS NOT NULL THEN
    -- Joining an existing company
    IF NOT EXISTS (
      SELECT 1 FROM public.companies WHERE id = _company_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Entreprise non trouvée ou inactive';
    END IF;

    _role := 'seller';
    _is_active := false;
  ELSE
    -- No company context - should not happen in normal flow
    _role := 'seller';
    _is_active := false;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, phone, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.email,
    _company_id
  );

  INSERT INTO public.user_roles (user_id, role, is_active, company_id)
  VALUES (NEW.id, _role, _is_active, _company_id);

  RETURN NEW;
END;
$function$;

-- Re-attach trigger if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
