-- 1. Create seller_authorized_categories table
CREATE TABLE public.seller_authorized_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category product_category NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, category)
);

-- Enable RLS
ALTER TABLE public.seller_authorized_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage seller categories"
  ON public.seller_authorized_categories
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view their own authorized categories"
  ON public.seller_authorized_categories
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Add new categories to enum
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'blocs';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'vetements';

-- 3. Add Blocs-specific columns to products table
ALTER TABLE products ADD COLUMN bloc_type text;
ALTER TABLE products ADD COLUMN bloc_poids numeric(10,2);

-- 4. Add Vêtements-specific columns to products table
ALTER TABLE products ADD COLUMN vetement_taille text;
ALTER TABLE products ADD COLUMN vetement_genre text;
ALTER TABLE products ADD COLUMN vetement_couleur text;

-- 5. Create function to get seller authorized categories
CREATE OR REPLACE FUNCTION public.get_seller_authorized_categories(_user_id uuid)
RETURNS TABLE(category product_category)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- If seller has explicitly assigned categories, return only those
  SELECT sac.category
  FROM public.seller_authorized_categories sac
  WHERE sac.user_id = _user_id
  
  UNION ALL
  
  -- If no assigned categories, return NULL (meaning "all")
  SELECT NULL::product_category
  WHERE NOT EXISTS (
    SELECT 1 FROM public.seller_authorized_categories WHERE user_id = _user_id
  );
$$;