CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_now timestamptz := NOW();
  v_current_user_id uuid := auth.uid();

  v_current_user_role app_role;
  v_target_user_role app_role;
  v_target_is_active boolean;

  v_result json;
BEGIN
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT role
  INTO v_current_user_role
  FROM user_roles
  WHERE user_id = v_current_user_id;

  IF v_current_user_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent supprimer des comptes';
  END IF;

  IF v_current_user_id = target_user_id THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
  END IF;

  SELECT role, is_active
  INTO v_target_user_role, v_target_is_active
  FROM user_roles
  WHERE user_id = target_user_id;

  IF v_target_user_role IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non trouvé';
  END IF;

  IF v_target_user_role = 'seller' AND v_target_is_active IS TRUE THEN
    RAISE EXCEPTION 'Impossible de supprimer un vendeur actif. Désactivez-le d''abord.';
  END IF;

  -- (6) FK: pour catégories assignées par l'utilisateur
  UPDATE seller_authorized_categories
  SET assigned_by = NULL
  WHERE assigned_by = target_user_id;

  -- 1) FK critique: garder stock_movements si sales sont supprimées (FK en CASCADE)
  -- On détache stock_movements de toutes les ventes du seller AVANT de delete sales
  UPDATE stock_movements sm
  SET
    sale_id = NULL,
    reason =
      COALESCE(sm.reason, '') ||
      CASE WHEN COALESCE(sm.reason, '') <> '' THEN ' | ' ELSE '' END ||
      '[Vente du vendeur supprimé - ' || (v_now::date)::text || ']'
  WHERE sm.sale_id IN (
    SELECT s.id FROM sales s WHERE s.seller_id = target_user_id
  );

  -- Mouvements créés par l’utilisateur supprimé
  UPDATE stock_movements
  SET reason =
    COALESCE(reason, '') ||
    CASE WHEN COALESCE(reason, '') <> '' THEN ' | ' ELSE '' END ||
    '[Créé par utilisateur supprimé - ' || (v_now::date)::text || ']'
  WHERE created_by = target_user_id;

  -- 2) Supprimer sale_items (si pas déjà supprimés par cascade)
  DELETE FROM sale_items
  WHERE sale_id IN (
    SELECT id FROM sales WHERE seller_id = target_user_id
  );

  -- 3) Supprimer les ventes du seller
  DELETE FROM sales
  WHERE seller_id = target_user_id;

  -- 4) Anonymiser les activity_logs
  UPDATE activity_logs
  SET metadata = COALESCE(metadata, '{}'::jsonb) ||
                 jsonb_build_object('user_deleted_at', v_now)
  WHERE user_id = target_user_id;

  -- 5) Logger l'action
  INSERT INTO activity_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    description,
    metadata
  ) VALUES (
    v_current_user_id,
    'user_deleted',
    'user',
    target_user_id,
    'Compte utilisateur supprimé',
    jsonb_build_object(
      'deleted_user_role', v_target_user_role,
      'deleted_user_was_active', v_target_is_active
    )
  );

  -- 7) Supprimer les autorisations de catégories (après assigned_by=NULL)
  DELETE FROM seller_authorized_categories
  WHERE user_id = target_user_id;

  -- 8) Supprimer le rôle
  DELETE FROM user_roles
  WHERE user_id = target_user_id;

  -- 9) Supprimer le profil
  DELETE FROM profiles
  WHERE user_id = target_user_id;

  -- 10) Supprimer le compte auth
  DELETE FROM auth.users
  WHERE id = target_user_id;

  v_result := json_build_object(
    'success', true,
    'message', 'Compte supprimé avec succès. Les ventes ont été supprimées et les stock_movements ont été détachés (sale_id=NULL).'
  );

  RETURN v_result;
END;
$function$;