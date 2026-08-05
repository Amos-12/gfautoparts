
-- =============================================
-- PHASE 1: SaaS Multi-Tenant Transformation
-- (super_admin enum value already added)
-- =============================================

-- 2. Create companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  address text,
  city text,
  phone text,
  email text,
  logo_url text,
  logo_width numeric DEFAULT 50,
  logo_height numeric DEFAULT 50,
  logo_position_x numeric DEFAULT 0,
  logo_position_y numeric DEFAULT 0,
  tva_rate numeric DEFAULT 10.0,
  usd_htg_rate numeric DEFAULT 132.00,
  default_display_currency text DEFAULT 'HTG',
  payment_terms text DEFAULT 'Paiement comptant ou à crédit selon accord',
  company_description text,
  is_active boolean DEFAULT true,
  subscription_plan text DEFAULT 'trial',
  subscription_start date DEFAULT CURRENT_DATE,
  subscription_end date DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  max_users integer DEFAULT 3,
  max_products integer DEFAULT 50,
  invitation_code text UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 5,
  max_products integer NOT NULL DEFAULT 100,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Insert default plans
INSERT INTO public.subscription_plans (id, name, price_monthly, max_users, max_products, features) VALUES
  ('trial', 'Essai Gratuit', 0, 3, 50, '["Fonctionnalités de base", "1 boutique", "3 utilisateurs max", "50 produits max"]'::jsonb),
  ('basic', 'Basic', 19, 5, 200, '["Fonctionnalités essentielles", "1 boutique", "5 utilisateurs", "200 produits", "Support email"]'::jsonb),
  ('pro', 'Pro', 39, 15, 1000, '["Rapports avancés", "1 boutique", "15 utilisateurs", "1000 produits", "Support prioritaire"]'::jsonb),
  ('premium', 'Premium', 59, 999999, 999999, '["Multi-boutiques", "Utilisateurs illimités", "Produits illimités", "Support dédié", "API access"]'::jsonb);

-- 4. Add company_id to all existing tables
ALTER TABLE public.profiles ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.user_roles ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.products ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.sales ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.sale_items ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.stock_movements ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.activity_logs ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.categories ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.sous_categories ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.specifications_modeles ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.proformas ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.seller_authorized_categories ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- 5. Create default company from existing company_settings
INSERT INTO public.companies (
  name, slug, company_description, address, city, phone, email,
  logo_url, logo_width, logo_height, logo_position_x, logo_position_y,
  tva_rate, usd_htg_rate, default_display_currency, payment_terms,
  is_active, subscription_plan, subscription_end, max_users, max_products
)
SELECT
  cs.company_name,
  lower(regexp_replace(cs.company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-default',
  cs.company_description,
  cs.address,
  cs.city,
  cs.phone,
  cs.email,
  cs.logo_url,
  COALESCE(cs.logo_width, 50),
  COALESCE(cs.logo_height, 50),
  COALESCE(cs.logo_position_x, 0),
  COALESCE(cs.logo_position_y, 0),
  cs.tva_rate,
  COALESCE(cs.usd_htg_rate, 132),
  COALESCE(cs.default_display_currency, 'HTG'),
  cs.payment_terms,
  true,
  'premium',
  (CURRENT_DATE + INTERVAL '10 years')::date,
  999999,
  999999
FROM public.company_settings cs
LIMIT 1;

-- Fallback if no company_settings exist
INSERT INTO public.companies (name, slug, subscription_plan, subscription_end, max_users, max_products)
SELECT 'Entreprise par défaut', 'entreprise-par-defaut', 'premium', (CURRENT_DATE + INTERVAL '10 years')::date, 999999, 999999
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

-- 6. Migrate all existing data to the default company
DO $$
DECLARE
  default_company_id uuid;
BEGIN
  SELECT id INTO default_company_id FROM public.companies LIMIT 1;

  UPDATE public.profiles SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.user_roles SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.products SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.sales SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.sale_items SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.stock_movements SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.activity_logs SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.categories SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.sous_categories SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.specifications_modeles SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.proformas SET company_id = default_company_id WHERE company_id IS NULL;
  UPDATE public.seller_authorized_categories SET company_id = default_company_id WHERE company_id IS NULL;
END $$;

-- 7. Make company_id NOT NULL on data tables
ALTER TABLE public.products ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.sale_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.stock_movements ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.sous_categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.specifications_modeles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.proformas ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.seller_authorized_categories ALTER COLUMN company_id SET NOT NULL;

-- 8. Create helper function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 9. Create is_super_admin function (use text cast to avoid enum commit issue)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'super_admin'
  )
$$;

-- 10. Enable RLS on new tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- 11. RLS for companies
CREATE POLICY "Super admins can manage all companies"
  ON public.companies FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own company"
  ON public.companies FOR SELECT
  USING (id = get_user_company_id(auth.uid()));

CREATE POLICY "Company admins can update their company"
  ON public.companies FOR UPDATE
  USING (
    id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'admin')
  );

-- 12. RLS for subscription_plans
CREATE POLICY "Everyone can view subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage subscription plans"
  ON public.subscription_plans FOR ALL
  USING (is_super_admin(auth.uid()));

-- 13. Drop and recreate all RLS policies

-- == PROFILES ==
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view own company profiles"
  ON public.profiles FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    OR auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- == USER_ROLES ==
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view own company roles"
  ON public.user_roles FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    OR auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Company admins can manage roles"
  ON public.user_roles FOR ALL
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

-- == PRODUCTS ==
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Everyone can view active products" ON public.products;

CREATE POLICY "Users can view company products"
  ON public.products FOR SELECT
  USING (
    (company_id = get_user_company_id(auth.uid()) AND is_active = true)
    OR (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Company admins can manage products"
  ON public.products FOR ALL
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

-- == SALES ==
DROP POLICY IF EXISTS "Admins can delete sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can view all sales" ON public.sales;
DROP POLICY IF EXISTS "Sellers can create sales" ON public.sales;
DROP POLICY IF EXISTS "Sellers can view their own sales" ON public.sales;

CREATE POLICY "Company admins can view all company sales"
  ON public.sales FOR SELECT
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Sellers can view own sales"
  ON public.sales FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    AND seller_id = auth.uid()
  );

CREATE POLICY "Sellers can create company sales"
  ON public.sales FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND seller_id = auth.uid()
  );

CREATE POLICY "Company admins can delete sales"
  ON public.sales FOR DELETE
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

-- == SALE_ITEMS ==
DROP POLICY IF EXISTS "Sellers can insert sale items for their sales" ON public.sale_items;
DROP POLICY IF EXISTS "Users can view sale items for their sales" ON public.sale_items;

CREATE POLICY "Users can view company sale items"
  ON public.sale_items FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Users can insert company sale items"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
  );

-- == STOCK_MOVEMENTS ==
DROP POLICY IF EXISTS "Admins can view all stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Sellers can view stock movements for their sales" ON public.stock_movements;
DROP POLICY IF EXISTS "System can create stock movements" ON public.stock_movements;

CREATE POLICY "Company users can view stock movements"
  ON public.stock_movements FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "System can create stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (true);

-- == ACTIVITY_LOGS ==
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;

CREATE POLICY "Company admins can view logs"
  ON public.activity_logs FOR SELECT
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "System can insert logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- == CATEGORIES ==
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Everyone can view active categories" ON public.categories;

CREATE POLICY "Users can view company categories"
  ON public.categories FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Company admins can manage categories"
  ON public.categories FOR ALL
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

-- == SOUS_CATEGORIES ==
DROP POLICY IF EXISTS "Admins can manage sous_categories" ON public.sous_categories;
DROP POLICY IF EXISTS "Everyone can view active sous_categories" ON public.sous_categories;

CREATE POLICY "Users can view company sous_categories"
  ON public.sous_categories FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Company admins can manage sous_categories"
  ON public.sous_categories FOR ALL
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

-- == SPECIFICATIONS_MODELES ==
DROP POLICY IF EXISTS "Admins can manage specifications_modeles" ON public.specifications_modeles;
DROP POLICY IF EXISTS "Everyone can view specifications_modeles" ON public.specifications_modeles;

CREATE POLICY "Users can view company specifications"
  ON public.specifications_modeles FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Company admins can manage specifications"
  ON public.specifications_modeles FOR ALL
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

-- == PROFORMAS ==
DROP POLICY IF EXISTS "Sellers can create their own proformas" ON public.proformas;
DROP POLICY IF EXISTS "Sellers can delete their own proformas" ON public.proformas;
DROP POLICY IF EXISTS "Sellers can update their own proformas" ON public.proformas;
DROP POLICY IF EXISTS "Sellers can view their own proformas" ON public.proformas;

CREATE POLICY "Users can view company proformas"
  ON public.proformas FOR SELECT
  USING (
    (company_id = get_user_company_id(auth.uid()) AND seller_id = auth.uid())
    OR (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Sellers can create company proformas"
  ON public.proformas FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND seller_id = auth.uid()
  );

CREATE POLICY "Sellers can update own proformas"
  ON public.proformas FOR UPDATE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND seller_id = auth.uid()
  );

CREATE POLICY "Sellers can delete own proformas"
  ON public.proformas FOR DELETE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND seller_id = auth.uid()
  );

-- == SELLER_AUTHORIZED_CATEGORIES ==
DROP POLICY IF EXISTS "Admins can manage seller categories" ON public.seller_authorized_categories;
DROP POLICY IF EXISTS "Sellers can view their own authorized categories" ON public.seller_authorized_categories;

CREATE POLICY "Company admins can manage seller categories"
  ON public.seller_authorized_categories FOR ALL
  USING (
    (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Sellers can view own authorized categories"
  ON public.seller_authorized_categories FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    AND user_id = auth.uid()
  );

-- 14. Update handle_new_user trigger for multi-tenant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _role app_role;
  _is_active boolean;
  _company_name text;
BEGIN
  _company_name := NEW.raw_user_meta_data ->> 'company_name';
  _company_id := (NEW.raw_user_meta_data ->> 'company_id')::uuid;

  IF _company_name IS NOT NULL AND _company_name != '' THEN
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
    IF NOT EXISTS (
      SELECT 1 FROM public.companies WHERE id = _company_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Entreprise non trouvée ou inactive';
    END IF;

    _role := 'seller';
    _is_active := false;
  ELSE
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
$$;

-- 15. Performance indexes
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_user_roles_company_id ON public.user_roles(company_id);
CREATE INDEX idx_products_company_id ON public.products(company_id);
CREATE INDEX idx_sales_company_id ON public.sales(company_id);
CREATE INDEX idx_sale_items_company_id ON public.sale_items(company_id);
CREATE INDEX idx_stock_movements_company_id ON public.stock_movements(company_id);
CREATE INDEX idx_activity_logs_company_id ON public.activity_logs(company_id);
CREATE INDEX idx_categories_company_id ON public.categories(company_id);
CREATE INDEX idx_sous_categories_company_id ON public.sous_categories(company_id);
CREATE INDEX idx_proformas_company_id ON public.proformas(company_id);
CREATE INDEX idx_companies_slug ON public.companies(slug);
CREATE INDEX idx_companies_invitation_code ON public.companies(invitation_code);

-- 16. Trigger for companies updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
