-- Fix delete_user_account function to properly handle stock_movements foreign key constraint
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
  
  -- 1. Gérer les stock_movements AVANT tout le reste
  -- Mettre sale_id à NULL pour les mouvements liés aux ventes du vendeur
  UPDATE stock_movements
  SET sale_id = NULL,
      reason = COALESCE(reason || ' | ', '') || '[Vente du vendeur supprimé - ' || NOW()::date || ']'
  WHERE sale_id IN (SELECT id FROM sales WHERE seller_id = target_user_id);
  
  -- Marquer les autres stock_movements créés par cet utilisateur
  UPDATE stock_movements
  SET reason = COALESCE(reason || ' | ', '') || '[Créé par utilisateur supprimé - ' || NOW()::date || ']'
  WHERE created_by = target_user_id;
  
  -- 2. Supprimer les sale_items liés aux ventes du vendeur
  DELETE FROM sale_items
  WHERE sale_id IN (SELECT id FROM sales WHERE seller_id = target_user_id);
  
  -- 3. Supprimer les ventes du vendeur
  DELETE FROM sales
  WHERE seller_id = target_user_id;
  
  -- 4. Anonymiser les activity_logs
  UPDATE activity_logs
  SET metadata = COALESCE(metadata, '{}'::jsonb) || 
                 jsonb_build_object('user_deleted_at', NOW())
  WHERE user_id = target_user_id;
  
  -- 5. Logger l'action
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
  
  -- 6. Supprimer les autorisations de catégories
  DELETE FROM seller_authorized_categories WHERE user_id = target_user_id;
  
  -- 7. Supprimer le rôle
  DELETE FROM user_roles WHERE user_id = target_user_id;
  
  -- 8. Supprimer le profil
  DELETE FROM profiles WHERE user_id = target_user_id;
  
  -- 9. Supprimer le compte auth
  DELETE FROM auth.users WHERE id = target_user_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Compte supprimé avec succès. Les ventes et mouvements de stock ont été traités.'
  );
  
  RETURN result;
END;
$function$;