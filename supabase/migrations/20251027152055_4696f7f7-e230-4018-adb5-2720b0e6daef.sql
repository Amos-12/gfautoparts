-- Fix 1: Update delete_user_account to handle orphaned stock_movements
CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  current_user_role app_role;
  target_user_role app_role;
  target_is_active boolean;
  result json;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  
  SELECT role INTO current_user_role
  FROM user_roles
  WHERE user_id = current_user_id;
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent supprimer des comptes';
  END IF;
  
  IF current_user_id = target_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;
  
  SELECT ur.role, ur.is_active 
  INTO target_user_role, target_is_active
  FROM user_roles ur
  WHERE ur.user_id = target_user_id;
  
  IF target_user_role IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non trouvé';
  END IF;
  
  IF target_user_role = 'seller' AND target_is_active = true THEN
    RAISE EXCEPTION 'Impossible de supprimer un vendeur actif. Désactivez-le d''abord.';
  END IF;
  
  -- Anonymiser les ventes
  UPDATE sales
  SET notes = COALESCE(notes || ' | ', '') || '[Compte vendeur supprimé le ' || NOW()::date || ']'
  WHERE seller_id = target_user_id;
  
  -- Anonymiser les activity_logs
  UPDATE activity_logs
  SET metadata = COALESCE(metadata, '{}'::jsonb) || 
                 jsonb_build_object('user_deleted_at', NOW())
  WHERE user_id = target_user_id;
  
  -- Nettoyer les stock_movements orphelins d'abord
  DELETE FROM stock_movements
  WHERE created_by = target_user_id
  AND sale_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sales WHERE id = stock_movements.sale_id);
  
  -- Marquer les stock_movements restants
  UPDATE stock_movements
  SET reason = COALESCE(reason || ' | ', '') || '[Utilisateur supprimé]'
  WHERE created_by = target_user_id;
  
  -- Logger l'action
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
  
  -- Supprimer le compte auth
  DELETE FROM auth.users WHERE id = target_user_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Compte supprimé avec succès. Les données historiques ont été conservées.'
  );
  
  RETURN result;
END;
$function$;

-- Fix 2: Remove VACUUM from cleanup_old_data (can't run in transaction)
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Nettoyer les activity_logs > 6 mois
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '6 months'
  AND action_type NOT IN ('user_deleted', 'sale_created');
  
  GET DIAGNOSTICS deleted_logs = ROW_COUNT;
  
  -- Nettoyer les stock_movements > 1 an
  DELETE FROM stock_movements
  WHERE created_at < NOW() - INTERVAL '1 year'
  AND (sale_id IS NULL OR sale_id NOT IN (
    SELECT id FROM sales WHERE created_at > NOW() - INTERVAL '2 years'
  ));
  
  GET DIAGNOSTICS deleted_movements = ROW_COUNT;
  
  -- Nettoyer les ventes > 2 ans
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
$function$;