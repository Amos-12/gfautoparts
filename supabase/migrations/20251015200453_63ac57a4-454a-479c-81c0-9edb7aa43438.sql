-- Add payment_terms column to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN payment_terms text DEFAULT 'N/A';