-- Add currency configuration columns to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS usd_htg_rate NUMERIC(10,2) DEFAULT 132.00,
ADD COLUMN IF NOT EXISTS default_display_currency TEXT DEFAULT 'HTG' CHECK (default_display_currency IN ('USD', 'HTG'));