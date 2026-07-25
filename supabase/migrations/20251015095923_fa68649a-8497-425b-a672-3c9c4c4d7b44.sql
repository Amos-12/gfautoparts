-- Add unit field to products table
ALTER TABLE public.products 
ADD COLUMN unit text NOT NULL DEFAULT 'unité';

-- Add discount and subtotal fields to sales table
ALTER TABLE public.sales
ADD COLUMN subtotal numeric NOT NULL DEFAULT 0,
ADD COLUMN discount_type text CHECK (discount_type IN ('percentage', 'amount', 'none')),
ADD COLUMN discount_value numeric DEFAULT 0,
ADD COLUMN discount_amount numeric DEFAULT 0;

-- Update existing sales to have valid subtotal (same as total_amount for now)
UPDATE public.sales
SET subtotal = total_amount,
    discount_type = 'none',
    discount_value = 0,
    discount_amount = 0
WHERE subtotal = 0;

-- Add unit field to sale_items
ALTER TABLE public.sale_items
ADD COLUMN unit text;

COMMENT ON COLUMN public.products.unit IS 'Unité de mesure du produit (m², barre, sac, etc.)';
COMMENT ON COLUMN public.sales.subtotal IS 'Montant total avant remise';
COMMENT ON COLUMN public.sales.discount_type IS 'Type de remise: percentage, amount, ou none';
COMMENT ON COLUMN public.sales.discount_value IS 'Valeur de la remise (10 pour 10% ou montant fixe)';
COMMENT ON COLUMN public.sales.discount_amount IS 'Montant réel de la remise calculée';
COMMENT ON COLUMN public.sale_items.unit IS 'Unité utilisée pour cette vente';