# Bénéfices négatifs sur les ventes d'hier — diagnostic puis correction

## État actuel (vérifié)

Le bénéfice n'est pas recalculé à l'affichage : il est figé à la vente, dans la fonction `process-sale` :

```text
purchase_price_at_sale = produit.purchase_price
profit_amount = (unit_price - purchase_price_at_sale) * quantity
```

Cette formule ne tient compte ni de la devise du produit ni de l'unité de vente. Trois causes possibles, toutes cohérentes avec un bénéfice négatif :

1. Devise : prix d'achat saisi en USD alors que le prix de vente est en HTG (ou l'inverse) — l'écart devient massivement négatif.
2. Unité : céramique vendue au m² mais prix d'achat saisi par boîte ; fer vendu à l'unité mais prix d'achat par barre.
3. Saisie : prix d'achat supérieur au prix de vente sur certains produits.

Je n'ai pas pu lire les lignes de `sale_items` d'hier (les politiques RLS bloquent la lecture anonyme), donc la cause exacte n'est pas encore confirmée. C'est la première étape du plan.

## Étape 1 — Confirmer la cause (aucun code modifié)

Requête à exécuter (je la fournis, exécution dans l'éditeur SQL) listant les lignes d'hier avec `profit_amount < 0` : produit, catégorie, unité, quantité, prix unitaire, prix d'achat enregistré, devise de la ligne et devise du produit. Le résultat désigne directement laquelle des trois causes s'applique (et si plusieurs se combinent).

## Étape 2 — Corriger le calcul à la source

Dans `process-sale`, avant de calculer le bénéfice :

- Convertir le prix d'achat dans la devise de la ligne de vente (taux USD/HTG des paramètres de l'entreprise) quand les devises diffèrent.
- Ramener le prix d'achat à la même unité que le prix de vente (par m² pour la céramique via `surface_par_boite`, par barre/unité pour le fer), au lieu de le prendre brut.
- Enregistrer `purchase_price_at_sale` déjà normalisé, pour que les reçus et rapports restent cohérents.

## Étape 3 — Garde-fous à la saisie produit

Bloquer (ou avertir clairement) lorsqu'un prix d'achat est supérieur au prix de vente, et rappeler l'unité attendue du prix d'achat sur chaque formulaire de catégorie.

## Étape 4 — Réparer l'historique

Script SQL fourni pour recalculer `purchase_price_at_sale` et `profit_amount` des ventes déjà enregistrées selon la règle corrigée, appliqué d'abord aux ventes d'hier puis, si vous le souhaitez, à tout l'historique.

## Détails techniques

- Fichiers concernés : `supabase/functions/process-sale/index.ts` (calcul), `src/components/Products/ProductManagement.tsx` (garde-fous saisie).
- Le taux de conversion vient des paramètres existants (`usd_htg_rate`), pas d'une valeur en dur.
- Aucun changement dans les hooks financiers centralisés : ils agrègent `profit_amount`, la correction reste à la source.
