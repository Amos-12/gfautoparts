-- Create enum for sale type
CREATE TYPE public.sale_type AS ENUM ('retail', 'wholesale');

-- Add sale_type column to products table
ALTER TABLE public.products 
ADD COLUMN sale_type public.sale_type NOT NULL DEFAULT 'retail';