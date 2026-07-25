-- Add currency column to products table
ALTER TABLE products 
ADD COLUMN currency TEXT NOT NULL DEFAULT 'HTG' 
CHECK (currency IN ('USD', 'HTG'));

-- Add currency column to sale_items table to preserve the currency at the time of sale
ALTER TABLE sale_items 
ADD COLUMN currency TEXT DEFAULT 'HTG' 
CHECK (currency IN ('USD', 'HTG'));