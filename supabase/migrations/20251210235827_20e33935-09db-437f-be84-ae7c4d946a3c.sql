-- Arrondir tous les stock_boite des céramiques à 2 décimales
UPDATE products 
SET stock_boite = ROUND(stock_boite::numeric, 2)
WHERE category = 'ceramique' 
  AND stock_boite IS NOT NULL;

-- Créer une fonction trigger pour arrondir automatiquement stock_boite lors des mises à jour
CREATE OR REPLACE FUNCTION public.round_stock_boite()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category = 'ceramique' AND NEW.stock_boite IS NOT NULL THEN
    NEW.stock_boite := ROUND(NEW.stock_boite::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS round_stock_boite_trigger ON products;

-- Créer le trigger
CREATE TRIGGER round_stock_boite_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION public.round_stock_boite();