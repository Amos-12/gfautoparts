-- Add ON DELETE RESTRICT to prevent deletion of products that have sales
-- This preserves sales history and prevents data loss

-- Drop existing foreign key constraint
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;

-- Recreate with RESTRICT behavior
-- This will prevent deletion of products that have been sold
ALTER TABLE public.sale_items 
  ADD CONSTRAINT sale_items_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES public.products(id) 
  ON DELETE RESTRICT;