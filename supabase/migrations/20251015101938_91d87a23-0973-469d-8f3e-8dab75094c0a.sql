-- Add new columns for advanced product management (ceramics and iron bars)

-- Add columns for ceramics
ALTER TABLE products ADD COLUMN dimension text;
ALTER TABLE products ADD COLUMN surface_par_boite numeric(10,2);
ALTER TABLE products ADD COLUMN prix_m2 numeric(10,2);
ALTER TABLE products ADD COLUMN stock_boite integer DEFAULT 0;

-- Add columns for iron bars
ALTER TABLE products ADD COLUMN diametre text;
ALTER TABLE products ADD COLUMN longueur_barre numeric(10,2) DEFAULT 12.00;
ALTER TABLE products ADD COLUMN prix_par_metre numeric(10,2);
ALTER TABLE products ADD COLUMN prix_par_barre numeric(10,2);
ALTER TABLE products ADD COLUMN stock_barre integer DEFAULT 0;

-- Add decimal authorization flag
ALTER TABLE products ADD COLUMN decimal_autorise boolean DEFAULT true;

-- Add comments for clarity
COMMENT ON COLUMN products.dimension IS 'Dimension pour céramiques (ex: 60x60, 40x40)';
COMMENT ON COLUMN products.surface_par_boite IS 'Surface couverte par une boîte de céramique (m²)';
COMMENT ON COLUMN products.prix_m2 IS 'Prix de vente au m² pour céramiques';
COMMENT ON COLUMN products.stock_boite IS 'Nombre de boîtes en stock pour céramiques';
COMMENT ON COLUMN products.diametre IS 'Diamètre pour fers (ex: Ø 3/8", Ø 1/2")';
COMMENT ON COLUMN products.longueur_barre IS 'Longueur standard d''une barre de fer (généralement 12m)';
COMMENT ON COLUMN products.prix_par_metre IS 'Prix par mètre pour fers';
COMMENT ON COLUMN products.prix_par_barre IS 'Prix par barre (calculé automatiquement)';
COMMENT ON COLUMN products.stock_barre IS 'Nombre de barres en stock pour fers';
COMMENT ON COLUMN products.decimal_autorise IS 'Autoriser les quantités décimales pour ce produit';