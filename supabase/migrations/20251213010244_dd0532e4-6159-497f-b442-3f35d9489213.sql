-- Add barcode column to products table
ALTER TABLE products ADD COLUMN barcode VARCHAR(50) UNIQUE;

-- Create index for fast barcode lookups
CREATE INDEX idx_products_barcode ON products(barcode);