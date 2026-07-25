-- Extend product_category enum to include ceramique, fer, and materiaux_de_construction
-- This will prevent "invalid input value for enum" errors

ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'ceramique';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'fer';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'materiaux_de_construction';