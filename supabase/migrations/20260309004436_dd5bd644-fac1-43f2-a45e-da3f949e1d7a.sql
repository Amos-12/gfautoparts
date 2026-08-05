-- Create saas_settings table for global platform configuration
CREATE TABLE IF NOT EXISTS public.saas_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.saas_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can manage settings
CREATE POLICY "Super admins can manage saas_settings"
ON public.saas_settings
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Everyone can view settings (for edge functions)
CREATE POLICY "Service role can view settings"
ON public.saas_settings
FOR SELECT
USING (true);

-- Insert default payment exchange rate
INSERT INTO public.saas_settings (setting_key, setting_value, description)
VALUES (
  'payment_exchange_rate',
  '{"usd_htg_rate": 132.00}'::jsonb,
  'Taux de conversion USD vers HTG pour les paiements MonCash et NatCash'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX idx_saas_settings_key ON public.saas_settings(setting_key);

-- Add trigger to update updated_at
CREATE TRIGGER update_saas_settings_updated_at
BEFORE UPDATE ON public.saas_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();