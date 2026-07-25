-- Fix duplicate profiles and guarantee one profile per user, plus ensure signup trigger

-- 1) Deduplicate profiles by user_id (keep earliest)
WITH ranked AS (
  SELECT id, user_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) rn
  FROM public.profiles
)
DELETE FROM public.profiles p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

-- 2) Add UNIQUE constraint on profiles.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 3) Ensure trigger on auth.users to create profile + default role on signup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 4) Deduplicate user_roles per (user_id, role) and prevent duplicates
WITH ranked_roles AS (
  SELECT id, user_id, role, created_at,
         ROW_NUMBER() OVER (PARTITION BY user_id, role ORDER BY created_at ASC, id ASC) rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked_roles r
WHERE ur.id = r.id AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_unique'
  ) THEN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_unique UNIQUE (user_id, role);
  END IF;
END $$;