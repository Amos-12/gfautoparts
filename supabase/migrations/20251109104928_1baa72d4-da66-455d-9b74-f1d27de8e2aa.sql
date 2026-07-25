-- 1. Add DELETE policy for admins on sales table
CREATE POLICY "Admins can delete sales"
ON public.sales
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Modify foreign key constraint on sale_items for CASCADE DELETE
ALTER TABLE public.sale_items
DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;

ALTER TABLE public.sale_items
ADD CONSTRAINT sale_items_sale_id_fkey
  FOREIGN KEY (sale_id)
  REFERENCES public.sales(id)
  ON DELETE CASCADE;

-- 3. Modify foreign key constraint on stock_movements for SET NULL
ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS stock_movements_sale_id_fkey;

ALTER TABLE public.stock_movements
ADD CONSTRAINT stock_movements_sale_id_fkey
  FOREIGN KEY (sale_id)
  REFERENCES public.sales(id)
  ON DELETE SET NULL;