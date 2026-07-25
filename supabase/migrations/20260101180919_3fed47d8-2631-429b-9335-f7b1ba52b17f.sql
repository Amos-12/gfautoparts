-- Ajouter la colonne discount_currency à la table sales
ALTER TABLE public.sales
ADD COLUMN discount_currency text DEFAULT 'HTG';

-- Mettre à jour les ventes existantes pour utiliser HTG par défaut
UPDATE public.sales
SET discount_currency = 'HTG'
WHERE discount_currency IS NULL;