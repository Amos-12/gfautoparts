-- Create table to store database size history
CREATE TABLE public.database_size_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  size_mb numeric NOT NULL,
  usage_percent numeric NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.database_size_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view the history
CREATE POLICY "Admins can view database size history"
ON public.database_size_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert records
CREATE POLICY "System can insert database size history"
ON public.database_size_history
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_database_size_history_recorded_at ON public.database_size_history(recorded_at DESC);

-- Update check_database_size function to also log the size
CREATE OR REPLACE FUNCTION public.check_database_size()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- Get current size
  SELECT pg_database_size(current_database()) INTO db_size_bytes;
  db_size_mb := db_size_bytes / 1024.0 / 1024.0;
  
  -- Calculate threshold and usage
  threshold_mb := max_size_mb * (threshold_percent / 100.0);
  usage_percent := (db_size_mb / max_size_mb) * 100.0;
  needs_cleanup := db_size_mb >= threshold_mb;
  
  -- Check when the last record was inserted (only log once per hour)
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

-- Clean old history records (keep only last 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_database_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM public.database_size_history
  WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$function$;