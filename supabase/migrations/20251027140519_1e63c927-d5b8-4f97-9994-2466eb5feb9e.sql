-- ============================================
-- PARTIE 1: Fonction de suppression de compte
-- ============================================

-- Fonction pour supprimer un compte utilisateur
CREATE OR REPLACE FUNCTION public.delete_user_account(
  target_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_user_role app_role;
  target_user_role app_role;
  target_is_active boolean;
  result json;
BEGIN
  -- Récupérer l'utilisateur actuel
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  
  -- Vérifier que l'utilisateur actuel est admin
  SELECT role INTO current_user_role
  FROM user_roles
  WHERE user_id = current_user_id;
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent supprimer des comptes';
  END IF;
  
  -- Empêcher la suppression de son propre compte
  IF current_user_id = target_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;
  
  -- Récupérer les infos du compte cible
  SELECT ur.role, ur.is_active 
  INTO target_user_role, target_is_active
  FROM user_roles ur
  WHERE ur.user_id = target_user_id;
  
  IF target_user_role IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non trouvé';
  END IF;
  
  -- Règles de suppression :
  -- 1. Peut supprimer un vendeur inactif
  -- 2. Peut supprimer un autre admin (actif ou inactif)
  IF target_user_role = 'seller' AND target_is_active = true THEN
    RAISE EXCEPTION 'Impossible de supprimer un vendeur actif. Désactivez-le d''abord.';
  END IF;
  
  -- Anonymiser les données historiques au lieu de les supprimer
  -- Marquer les ventes avec une note
  UPDATE sales
  SET 
    notes = COALESCE(notes || ' | ', '') || '[Compte vendeur supprimé le ' || NOW()::date || ']'
  WHERE seller_id = target_user_id;
  
  -- Marquer les activity_logs
  UPDATE activity_logs
  SET metadata = COALESCE(metadata, '{}'::jsonb) || 
                 jsonb_build_object('user_deleted_at', NOW())
  WHERE user_id = target_user_id;
  
  -- Marquer les stock_movements
  UPDATE stock_movements
  SET reason = COALESCE(reason || ' | ', '') || '[Utilisateur supprimé]'
  WHERE created_by = target_user_id;
  
  -- Logger l'action de suppression
  INSERT INTO activity_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    description,
    metadata
  ) VALUES (
    current_user_id,
    'user_deleted',
    'user',
    target_user_id,
    'Compte utilisateur supprimé',
    jsonb_build_object(
      'deleted_user_role', target_user_role,
      'deleted_user_was_active', target_is_active
    )
  );
  
  -- Supprimer les autorisations de catégories
  DELETE FROM seller_authorized_categories WHERE user_id = target_user_id;
  
  -- Supprimer le rôle
  DELETE FROM user_roles WHERE user_id = target_user_id;
  
  -- Supprimer le profil
  DELETE FROM profiles WHERE user_id = target_user_id;
  
  -- Supprimer le compte auth (cascade automatique)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Compte supprimé avec succès. Les données historiques ont été conservées.'
  );
  
  RETURN result;
END;
$$;

-- ============================================
-- PARTIE 2: Fonctions de surveillance et nettoyage
-- ============================================

-- Fonction pour vérifier la taille de la base de données
CREATE OR REPLACE FUNCTION public.check_database_size()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  db_size_bytes bigint;
  db_size_mb numeric;
  max_size_mb constant numeric := 512;
  threshold_percent constant numeric := 80;
  threshold_mb numeric;
  usage_percent numeric;
  needs_cleanup boolean;
  result json;
BEGIN
  -- Récupérer la taille actuelle
  SELECT pg_database_size(current_database()) INTO db_size_bytes;
  db_size_mb := db_size_bytes / 1024.0 / 1024.0;
  
  -- Calculer le seuil et le pourcentage d'utilisation
  threshold_mb := max_size_mb * (threshold_percent / 100.0);
  usage_percent := (db_size_mb / max_size_mb) * 100.0;
  needs_cleanup := db_size_mb >= threshold_mb;
  
  result := json_build_object(
    'size_mb', ROUND(db_size_mb, 2),
    'max_size_mb', max_size_mb,
    'threshold_mb', threshold_mb,
    'usage_percent', ROUND(usage_percent, 2),
    'needs_cleanup', needs_cleanup
  );
  
  RETURN result;
END;
$$;

-- Fonction de nettoyage automatique
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_logs integer := 0;
  deleted_movements integer := 0;
  deleted_sales integer := 0;
  deleted_items integer := 0;
  size_before numeric;
  size_after numeric;
  result json;
BEGIN
  -- Récupérer la taille avant nettoyage
  SELECT (pg_database_size(current_database()) / 1024.0 / 1024.0) INTO size_before;
  
  -- 1. Nettoyer les activity_logs > 6 mois
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '6 months'
  AND action_type NOT IN ('user_deleted', 'sale_created');
  
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;
  
  -- 2. Nettoyer les stock_movements > 1 an (sauf ceux liés à des ventes récentes)
  DELETE FROM stock_movements
  WHERE created_at < NOW() - INTERVAL '1 year'
  AND (sale_id IS NULL OR sale_id NOT IN (
    SELECT id FROM sales WHERE created_at > NOW() - INTERVAL '2 years'
  ));
  
  GET DIAGNOSTICS deleted_movements = ROW_COUNT;
  
  -- 3. Nettoyer les ventes > 2 ans
  WITH old_sales AS (
    SELECT id FROM sales
    WHERE created_at < NOW() - INTERVAL '2 years'
  )
  DELETE FROM sale_items
  WHERE sale_id IN (SELECT id FROM old_sales);
  
  GET DIAGNOSTICS deleted_items = ROW_COUNT;
  
  DELETE FROM sales
  WHERE created_at < NOW() - INTERVAL '2 years';
  
  GET DIAGNOSTICS deleted_sales = ROW_COUNT;
  
  -- Vacuum pour récupérer l'espace
  VACUUM ANALYZE activity_logs, stock_movements, sales, sale_items;
  
  -- Récupérer la taille après nettoyage
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
  
  -- Logger l'action de nettoyage
  INSERT INTO activity_logs (
    user_id,
    action_type,
    entity_type,
    description,
    metadata
  ) VALUES (
    NULL,
    'system_cleanup',
    'database',
    'Nettoyage automatique de la base de données',
    result::jsonb
  );
  
  RETURN result;
END;
$$;

-- ============================================
-- PARTIE 3: Configuration du Cron Job
-- ============================================

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Planifier le nettoyage quotidien à 3h du matin
SELECT cron.schedule(
  'daily-database-cleanup',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://qxauhjxjqyesvqdzxbnh.supabase.co/functions/v1/database-cleanup',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4YXVoanhqcXllc3ZxZHp4Ym5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDczNTIsImV4cCI6MjA3NjcyMzM1Mn0.KWoIYTcVmI_X-2B4g5BhLnf75FktQrrV8LDZoHEr8-w"}'::jsonb
  ) as request_id;
  $$
);