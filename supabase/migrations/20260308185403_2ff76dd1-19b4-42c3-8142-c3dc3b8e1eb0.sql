
-- Table payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payment_method text NOT NULL,
  payment_reference text,
  status text NOT NULL DEFAULT 'pending',
  plan_id text REFERENCES public.subscription_plans(id),
  billing_period text,
  invoice_number text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Table subscription_invoices
CREATE TABLE public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  plan_name text,
  period_start date,
  period_end date,
  status text DEFAULT 'paid',
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- Add last_reminder_sent to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS last_reminder_sent date;

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

-- RLS for payments
CREATE POLICY "Company admins can view payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "System can insert payments"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Super admins can manage payments"
ON public.payments FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()));

-- RLS for subscription_invoices
CREATE POLICY "Company admins can view invoices"
ON public.subscription_invoices FOR SELECT
TO authenticated
USING (
  (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "System can insert invoices"
ON public.subscription_invoices FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Super admins can manage invoices"
ON public.subscription_invoices FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()));
