-- ============================================================
-- Correction des bénéfices négatifs (sale_items)
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- ÉTAPE 1 : DIAGNOSTIC (lecture seule)
-- Liste les lignes de vente à bénéfice négatif des 2 derniers jours
-- ------------------------------------------------------------
SELECT
  s.created_at,
  si.product_name,
  p.category,
  si.unit,
  si.quantity,
  si.unit_price,
  si.purchase_price_at_sale,
  si.profit_amount,
  si.currency          AS devise_ligne,
  p.currency           AS devise_produit,
  p.purchase_price     AS prix_achat_produit,
  p.surface_par_boite
FROM sale_items si
JOIN sales s        ON s.id = si.sale_id
LEFT JOIN products p ON p.id = si.product_id
WHERE si.profit_amount < 0
  AND s.created_at >= now() - interval '2 days'
ORDER BY si.profit_amount ASC;

-- ------------------------------------------------------------
-- ÉTAPE 2 : CORRECTION DE L'HISTORIQUE
-- Renormalise purchase_price_at_sale (devise + unité) puis
-- recalcule profit_amount = (unit_price - achat) * quantity.
--
-- Par défaut : uniquement les ventes d'HIER.
-- Pour tout l'historique, commentez la ligne "AND s.created_at >= ..."
-- ------------------------------------------------------------
WITH rate AS (
  SELECT COALESCE(NULLIF(usd_htg_rate, 0), 132) AS r
  FROM company_settings
  LIMIT 1
),
calc AS (
  SELECT
    si.id,
    si.quantity,
    si.unit_price,
    -- 1) conversion de devise
    CASE
      WHEN COALESCE(p.currency, si.currency) = si.currency THEN COALESCE(p.purchase_price, 0)
      WHEN COALESCE(p.currency, 'HTG') = 'USD' THEN COALESCE(p.purchase_price, 0) * (SELECT r FROM rate)
      ELSE COALESCE(p.purchase_price, 0) / (SELECT r FROM rate)
    END AS achat_converti,
    p.category,
    COALESCE(p.surface_par_boite, 0) AS surface_par_boite
  FROM sale_items si
  JOIN sales s         ON s.id = si.sale_id
  LEFT JOIN products p ON p.id = si.product_id
  WHERE s.created_at >= (current_date - interval '1 day')
    AND s.created_at <  current_date
),
normalise AS (
  SELECT
    id,
    quantity,
    unit_price,
    -- 2) unité : céramique vendue au m², prix d'achat saisi par boîte
    CASE
      WHEN category = 'ceramique'
       AND surface_par_boite > 0
       AND achat_converti > unit_price
       AND achat_converti / surface_par_boite <= unit_price
        THEN achat_converti / surface_par_boite
      ELSE achat_converti
    END AS achat_normalise
  FROM calc
)
UPDATE sale_items si
SET purchase_price_at_sale = GREATEST(n.achat_normalise, 0),
    profit_amount = (n.unit_price - GREATEST(n.achat_normalise, 0)) * n.quantity
FROM normalise n
WHERE si.id = n.id;

-- ------------------------------------------------------------
-- ÉTAPE 3 : VÉRIFICATION
-- ------------------------------------------------------------
SELECT count(*) AS lignes_encore_negatives
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
WHERE si.profit_amount < 0
  AND s.created_at >= (current_date - interval '1 day')
  AND s.created_at <  current_date;
