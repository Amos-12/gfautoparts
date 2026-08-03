# Corrections : TVA, suppression de vente, recherche et filtres

Projet connecté vérifié : `fjoguviwjdofjkokivbl`. Dans `company_settings`, `tva_rate = 0`, `usd_htg_rate = 133`, devise `HTG`.

## 1. TVA affichée à 10% alors qu'elle est à 0 (cause confirmée)

`useCompanySettings` lit le taux avec `Number(data.tva_rate) || 10`. Comme `0` est une valeur « fausse » en JavaScript, le vrai taux 0 est remplacé par la valeur par défaut 10. Tous les écrans qui passent par ce hook (liste des ventes, détail de vente, reçus PDF) affichent donc 10%.

Correction : lire le taux (et les autres valeurs numériques comme le taux de change) sans écraser le zéro, et mettre la valeur par défaut du taux TVA à 0 au lieu de 10. Les ventes déjà enregistrées seront alors ré-affichées avec 0% de TVA, sans toucher aux montants stockés.

## 2. Impossible de supprimer une vente (diagnostic à confirmer)

La suppression passe par la fonction serveur `delete-sale`. Le message d'erreur exact n'est pas encore visible, donc la première étape est de le faire remonter :

1. Afficher dans l'interface le message réel renvoyé par la fonction (aujourd'hui il peut être masqué par un message générique) et consulter les journaux de la fonction après un essai.
2. Corriger ensuite ce qui est identifié. Points déjà repérés comme fragiles dans `delete-sale` :
   - le contrôle du rôle utilise une requête « une seule ligne » sur `user_roles` : elle échoue si le compte possède plusieurs rôles, et refuse un compte `super_admin`;
   - la restauration du stock et la suppression ne sont pas dans une transaction : un échec en cours de route laisse la vente à moitié supprimée;
   - une éventuelle contrainte de clé étrangère depuis une autre table vers `sales` bloquerait la suppression.
3. Rendre le contrôle d'accès tolérant (admin ou super admin actif), améliorer les messages d'erreur et sécuriser l'ordre des suppressions.

## 3. Recherche par code-barres dans la page Produits (admin)

Le filtre produits admin ne compare la recherche qu'au nom et à la catégorie. Ajouter le code-barres (et, tant qu'à faire, l'affichage du champ recherché reste identique) pour que taper ou scanner un code-barres retrouve le produit, comme c'est déjà le cas côté vendeur.

## 4. Bouton de réinitialisation des filtres côté vendeur

Dans l'espace de vente, ajouter un bouton « Réinitialiser les filtres » visible dès qu'un filtre est actif (recherche, type de vente, catégorie, sous-catégorie) qui remet tout à zéro en un clic.

## Détails techniques

- `src/hooks/useCompanySettings.ts` : remplacer les `||` par une lecture qui préserve `0` (`data.tva_rate ?? défaut`, avec conversion numérique) ; `DEFAULT_SETTINGS.tvaRate` passe de `10` à `0`.
- `supabase/functions/delete-sale/index.ts` : requête de rôle en `maybeSingle`, acceptation `admin`/`super_admin` actifs, messages d'erreur détaillés, suppression ordonnée (mouvements de stock → articles → vente).
- `src/components/Sales/SalesManagement.tsx` : afficher le message d'erreur exact de la fonction.
- `src/components/Products/ProductManagement.tsx` : inclure `barcode` dans le filtre de recherche.
- `src/components/Seller/SellerWorkflow.tsx` : bouton de réinitialisation branché sur les états de filtres existants.
