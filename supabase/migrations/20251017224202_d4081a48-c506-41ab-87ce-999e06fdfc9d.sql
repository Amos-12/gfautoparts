-- PHASE 1: Modifications de la base de données

-- 1.1 Ajouter le champ purchase_price (Prix d'achat) à la table products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2);

-- 1.2 Modifier les champs de quantité pour accepter les décimales
ALTER TABLE public.products 
ALTER COLUMN quantity TYPE NUMERIC(10,3),
ALTER COLUMN stock_barre TYPE NUMERIC(10,3),
ALTER COLUMN stock_boite TYPE NUMERIC(10,3);

-- 1.3 Ajouter les champs pour la gestion du fer par tonnage
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS bars_per_ton NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS longueur_barre_ft NUMERIC(5,2);

-- 1.4 Configuration du logo système dans company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS logo_position_x NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS logo_position_y NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS logo_width NUMERIC(5,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS logo_height NUMERIC(5,2) DEFAULT 50;

-- 1.5 Création du bucket de stockage pour les logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket company-assets (supprimer d'abord si elles existent)
DROP POLICY IF EXISTS "Admins can upload company assets" ON storage.objects;
CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' 
  AND auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin' AND is_active = true
  )
);

DROP POLICY IF EXISTS "Admins can update company assets" ON storage.objects;
CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin' AND is_active = true
  )
);

DROP POLICY IF EXISTS "Admins can delete company assets" ON storage.objects;
CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin' AND is_active = true
  )
);

DROP POLICY IF EXISTS "Everyone can view company assets" ON storage.objects;
CREATE POLICY "Everyone can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');

-- 1.6 Modifications des tables de ventes pour les bénéfices
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS purchase_price_at_sale NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS profit_amount NUMERIC(10,2);

-- 1.7 Modifier stock_movements pour accepter les décimales
ALTER TABLE public.stock_movements 
ALTER COLUMN quantity TYPE NUMERIC(10,3),
ALTER COLUMN previous_quantity TYPE NUMERIC(10,3),
ALTER COLUMN new_quantity TYPE NUMERIC(10,3);

-- 1.8 Migration des données existantes (estimation de 30% de marge)
UPDATE public.products 
SET purchase_price = ROUND(price * 0.70, 2)
WHERE purchase_price IS NULL AND price IS NOT NULL;

-- 1.9 Ajouter un commentaire sur les colonnes importantes
COMMENT ON COLUMN public.products.purchase_price IS 'Prix d''achat unitaire du produit (coût payé par le magasin)';
COMMENT ON COLUMN public.products.bars_per_ton IS 'Nombre de barres pour 1 tonne (pour les produits fer)';
COMMENT ON COLUMN public.products.longueur_barre_ft IS 'Longueur de la barre en pieds (27, 30, ou 32 ft)';
COMMENT ON COLUMN public.sale_items.purchase_price_at_sale IS 'Prix d''achat au moment de la vente (pour historique et calcul bénéfice)';
COMMENT ON COLUMN public.sale_items.profit_amount IS 'Bénéfice total pour cette ligne de vente = (prix_vente - prix_achat) × quantité';