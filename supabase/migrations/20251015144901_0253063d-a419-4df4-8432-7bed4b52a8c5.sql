-- Add energy/solar product specifications to products table

-- Add columns for energy products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS puissance numeric,
ADD COLUMN IF NOT EXISTS voltage numeric,
ADD COLUMN IF NOT EXISTS capacite numeric,
ADD COLUMN IF NOT EXISTS type_energie text,
ADD COLUMN IF NOT EXISTS specifications_techniques jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.products.puissance IS 'Puissance en Watts (panneaux solaires, générateurs) ou kW';
COMMENT ON COLUMN public.products.voltage IS 'Voltage en Volts (V)';
COMMENT ON COLUMN public.products.capacite IS 'Capacité - Ah pour batteries, kg pour bonbonnes de gaz, litres pour carburants';
COMMENT ON COLUMN public.products.type_energie IS 'Type: solaire, batterie, generateur, gaz, essence, diesel, petrole, charbon';
COMMENT ON COLUMN public.products.specifications_techniques IS 'Specifications techniques additionnelles en JSON flexible';