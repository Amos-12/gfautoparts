-- Create proformas table for saving pro-forma estimates
CREATE TABLE public.proformas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proforma_number TEXT NOT NULL UNIQUE,
  seller_id UUID NOT NULL,
  customer_name TEXT,
  validity_days INTEGER NOT NULL DEFAULT 7,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  subtotal_ht NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tva_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(15, 2) NOT NULL DEFAULT 0,
  display_currency VARCHAR(3) NOT NULL DEFAULT 'HTG',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired')),
  converted_sale_id UUID REFERENCES public.sales(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.proformas ENABLE ROW LEVEL SECURITY;

-- Create policies for sellers to manage their own proformas
CREATE POLICY "Sellers can view their own proformas" 
ON public.proformas 
FOR SELECT 
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can create their own proformas" 
ON public.proformas 
FOR INSERT 
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own proformas" 
ON public.proformas 
FOR UPDATE 
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own proformas" 
ON public.proformas 
FOR DELETE 
USING (auth.uid() = seller_id);

-- Create index for faster queries
CREATE INDEX idx_proformas_seller_id ON public.proformas(seller_id);
CREATE INDEX idx_proformas_status ON public.proformas(status);
CREATE INDEX idx_proformas_created_at ON public.proformas(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_proformas_updated_at
BEFORE UPDATE ON public.proformas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();