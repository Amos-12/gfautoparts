
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS max_sales_monthly integer NOT NULL DEFAULT 999999;
