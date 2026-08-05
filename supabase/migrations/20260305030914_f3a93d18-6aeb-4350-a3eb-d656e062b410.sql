-- Add super_admin to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Fix overly permissive RLS: activity_logs INSERT should require company_id match or be system
-- Drop and recreate the INSERT policy for activity_logs
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;
CREATE POLICY "System can insert logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = get_user_company_id(auth.uid()))
    OR (company_id IS NULL)
    OR is_super_admin(auth.uid())
  );

-- Fix overly permissive RLS: stock_movements INSERT should validate company_id
DROP POLICY IF EXISTS "System can create stock movements" ON public.stock_movements;
CREATE POLICY "Authenticated users can create company stock movements" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = get_user_company_id(auth.uid()))
    OR is_super_admin(auth.uid())
  );

-- Fix overly permissive RLS: database_size_history INSERT
DROP POLICY IF EXISTS "System can insert database size history" ON public.database_size_history;
CREATE POLICY "System can insert database size history" ON public.database_size_history
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_super_admin(auth.uid())
  );

-- Fix search_path on functions that are missing it
CREATE OR REPLACE FUNCTION public.check_database_size()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  db_size_bytes bigint;
  db_size_mb numeric;
  max_size_mb constant numeric := 512;
  threshold_percent constant numeric := 80;
  threshold_mb numeric;
  usage_percent numeric;
  needs_cleanup boolean;
  result json;
  last_record_time timestamp with time zone;
BEGIN
  SELECT pg_database_size(current_database()) INTO db_size_bytes;
  db_size_mb := db_size_bytes / 1024.0 / 1024.0;
  threshold_mb := max_size_mb * (threshold_percent / 100.0);
  usage_percent := (db_size_mb / max_size_mb) * 100.0;
  needs_cleanup := db_size_mb >= threshold_mb;
  
  SELECT MAX(recorded_at) INTO last_record_time FROM public.database_size_history;
  
  IF last_record_time IS NULL OR last_record_time < NOW() - INTERVAL '1 hour' THEN
    INSERT INTO public.database_size_history (size_mb, usage_percent)
    VALUES (ROUND(db_size_mb, 2), ROUND(usage_percent, 2));
  END IF;
  
  result := json_build_object(
    'size_mb', ROUND(db_size_mb, 2),
    'max_size_mb', max_size_mb,
    'threshold_mb', threshold_mb,
    'usage_percent', ROUND(usage_percent, 2),
    'needs_cleanup', needs_cleanup
  );
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  deleted_logs integer := 0;
  deleted_movements integer := 0;
  deleted_sales integer := 0;
  deleted_items integer := 0;
  size_before numeric;
  size_after numeric;
  result json;
BEGIN
  SELECT (pg_database_size(current_database()) / 1024.0 / 1024.0) INTO size_before;
  
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '6 months'
  AND action_type NOT IN ('user_deleted', 'sale_created');
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;
  
  DELETE FROM stock_movements
  WHERE created_at < NOW() - INTERVAL '1 year'
  AND (sale_id IS NULL OR sale_id NOT IN (
    SELECT id FROM sales WHERE created_at > NOW() - INTERVAL '2 years'
  ));
  GET DIAGNOSTICS deleted_movements = ROW_COUNT;
  
  WITH old_sales AS (
    SELECT id FROM sales WHERE created_at < NOW() - INTERVAL '2 years'
  )
  DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM old_sales);
  GET DIAGNOSTICS deleted_items = ROW_COUNT;
  
  DELETE FROM sales WHERE created_at < NOW() - INTERVAL '2 years';
  GET DIAGNOSTICS deleted_sales = ROW_COUNT;
  
  SELECT (pg_database_size(current_database()) / 1024.0 / 1024.0) INTO size_after;
  
  result := json_build_object(
    'deleted_logs', deleted_logs,
    'deleted_movements', deleted_movements,
    'deleted_sales', deleted_sales,
    'deleted_items', deleted_items,
    'size_before_mb', ROUND(size_before, 2),
    'size_after_mb', ROUND(size_after, 2),
    'space_freed_mb', ROUND(size_before - size_after, 2),
    'cleaned_at', NOW()
  );
  
  INSERT INTO activity_logs (user_id, action_type, entity_type, description, metadata)
  VALUES (NULL, 'system_cleanup', 'database', 'Nettoyage automatique de la base de données', result::jsonb);
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_database_history()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.database_size_history
  WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$function$;