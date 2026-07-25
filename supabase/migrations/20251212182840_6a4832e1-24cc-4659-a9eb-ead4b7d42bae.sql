-- Changer le type de la colonne quantity de INTEGER vers NUMERIC(10,2)
ALTER TABLE sale_items 
ALTER COLUMN quantity TYPE NUMERIC(10,2) 
USING quantity::NUMERIC(10,2);