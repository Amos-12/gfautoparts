-- ============================================
-- PHASE 1: Créer les nouvelles tables
-- ============================================

-- Table des catégories principales
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  description text,
  slug text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table des sous-catégories
CREATE TABLE IF NOT EXISTS public.sous_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  nom text NOT NULL,
  description text,
  slug text NOT NULL,
  is_active boolean DEFAULT true,
  ordre integer DEFAULT 0,
  stock_type text DEFAULT 'quantity' CHECK (stock_type IN ('quantity', 'boite_m2', 'barre_metre')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(categorie_id, slug)
);

-- Table des modèles de spécifications
CREATE TABLE IF NOT EXISTS public.specifications_modeles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sous_categorie_id uuid NOT NULL REFERENCES public.sous_categories(id) ON DELETE CASCADE,
  nom_champ text NOT NULL,
  type_champ text NOT NULL CHECK (type_champ IN ('text', 'number', 'select', 'boolean')),
  label text NOT NULL,
  obligatoire boolean DEFAULT false,
  options jsonb,
  unite text,
  ordre integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sous_categorie_id, nom_champ)
);

-- Ajouter les nouvelles colonnes à products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS categorie_id uuid REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS sous_categorie_id uuid REFERENCES public.sous_categories(id);

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_products_categorie ON public.products(categorie_id);
CREATE INDEX IF NOT EXISTS idx_products_sous_categorie ON public.products(sous_categorie_id);
CREATE INDEX IF NOT EXISTS idx_sous_categories_categorie ON public.sous_categories(categorie_id);
CREATE INDEX IF NOT EXISTS idx_specifications_sous_categorie ON public.specifications_modeles(sous_categorie_id);

-- ============================================
-- PHASE 2: Configurer RLS
-- ============================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sous_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specifications_modeles ENABLE ROW LEVEL SECURITY;

-- Policies pour categories
CREATE POLICY "Everyone can view active categories" ON public.categories
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Policies pour sous_categories
CREATE POLICY "Everyone can view active sous_categories" ON public.sous_categories
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage sous_categories" ON public.sous_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Policies pour specifications_modeles
CREATE POLICY "Everyone can view specifications_modeles" ON public.specifications_modeles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage specifications_modeles" ON public.specifications_modeles
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Trigger pour updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sous_categories_updated_at
  BEFORE UPDATE ON public.sous_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activer Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sous_categories;