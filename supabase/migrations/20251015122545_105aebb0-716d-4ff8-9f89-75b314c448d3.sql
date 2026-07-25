-- Fix foreign key constraints to allow user deletion
-- This enables CASCADE deletion for sales and related data when a user is deleted

-- First, drop existing foreign key constraints if they exist
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_seller_id_fkey;
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_sale_id_fkey;

-- Recreate foreign key constraints with proper CASCADE behavior
-- When a user is deleted, all their sales will be deleted
ALTER TABLE public.sales 
  ADD CONSTRAINT sales_seller_id_fkey 
  FOREIGN KEY (seller_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- When a sale is deleted, all sale items will be deleted
ALTER TABLE public.sale_items 
  ADD CONSTRAINT sale_items_sale_id_fkey 
  FOREIGN KEY (sale_id) 
  REFERENCES public.sales(id) 
  ON DELETE CASCADE;

-- When a sale is deleted, related stock movements will be deleted
ALTER TABLE public.stock_movements 
  ADD CONSTRAINT stock_movements_sale_id_fkey 
  FOREIGN KEY (sale_id) 
  REFERENCES public.sales(id) 
  ON DELETE CASCADE;