-- Add customer_address to sales table
ALTER TABLE public.sales 
ADD COLUMN customer_address text;

-- Create company_settings table
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'QUINCAILLERIE PRO',
  company_description text DEFAULT 'Commerce de détail',
  address text NOT NULL DEFAULT '123 Rue Principale',
  city text NOT NULL DEFAULT 'Dakar 10000',
  phone text NOT NULL DEFAULT '+221 XX XXX XX XX',
  email text NOT NULL DEFAULT 'contact@quincaillerie.sn',
  tva_rate numeric NOT NULL DEFAULT 10.0,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default configuration
INSERT INTO public.company_settings (company_name, company_description, address, city, phone, email, tva_rate)
VALUES ('QUINCAILLERIE PRO', 'Commerce de détail', '123 Rue Principale', 'Dakar 10000', '+221 XX XXX XX XX', 'contact@quincaillerie.sn', 10.0);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_company_settings_updated_at 
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read company settings
CREATE POLICY "Everyone can view company settings"
  ON public.company_settings
  FOR SELECT
  USING (true);

-- Only admins can update company settings
CREATE POLICY "Admins can update company settings"
  ON public.company_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));