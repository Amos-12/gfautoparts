-- Add email column to profiles and backfill from auth.users
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing emails from auth.users (read-only access)
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE au.id = p.user_id
  AND (p.email IS NULL OR p.email = '');