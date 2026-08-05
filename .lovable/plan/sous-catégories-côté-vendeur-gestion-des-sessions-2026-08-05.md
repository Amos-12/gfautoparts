# Sous-catégories côté vendeur + gestion des sessions

## 1. Afficher la sous-catégorie à la place de « Autres » (espace vendeur)

Dans l'espace vendeur, les produits rattachés à la catégorie « Autres » afficheront le nom de leur sous-catégorie.

- Ajouter dans `SellerWorkflow.tsx` un helper `getCategoryDisplay(product)` identique à celui déjà utilisé côté admin : si la catégorie est « autres » et que le produit a une `sous_categorie_id`, afficher le nom de la sous-catégorie (via `useSousCategories`), sinon le libellé de catégorie normal.
- Utiliser ce libellé dans la carte produit (badge catégorie) et partout où « Autres » est affiché dans la liste vendeur.
- Le filtre catégorie reste inchangé (le filtre sous-catégorie existe déjà).

## 2. Gestion des sessions

Objectif : sessions expirées après 15 minutes d'inactivité, avec messages clairs et invitation à se reconnecter.

- Nouveau hook `useSessionTimeout` :
  - Suit l'activité (clic, clavier, scroll, tactile, retour d'onglet).
  - Après 15 min sans activité : déconnexion (`supabase.auth.signOut()`), redirection vers `/auth?reason=timeout`.
  - Avertissement 1 minute avant expiration : « Votre session va expirer dans 1 minute. Bougez la souris ou touchez l'écran pour rester connecté. »
- Nouveau composant `ProtectedRoute` :
  - Vérifie la session (`getUser()`), le rôle et `is_active`.
  - Si pas de session valide → redirection `/auth?reason=expired`.
  - Monte `useSessionTimeout` pour toutes les pages protégées.
- `App.tsx` : envelopper `/admin`, `/seller`, `/inventory`, `/profile`, `/` dans `ProtectedRoute`.
- Page `Auth` : afficher un bandeau clair selon le paramètre `reason` :
  - `timeout` → « Session expirée après 15 minutes d'inactivité. Veuillez vous reconnecter. »
  - `expired` → « Votre session n'est plus valide. Veuillez vous reconnecter. »
- Messages d'erreur unifiés : centraliser dans `src/lib/sessionErrors.ts` la détection des erreurs d'authentification (JWT expired, 401, refresh token invalide) et le message affiché : « Votre session a expiré. Reconnectez-vous pour continuer. » avec bouton/redirection vers la reconnexion. Utilisé lors des appels sensibles (vente, suppression de vente, dépenses).

## Détails techniques

- Délai d'inactivité : constante `INACTIVITY_LIMIT_MS = 15 * 60 * 1000`, avertissement à `-60s`.
- Le minuteur est réinitialisé aussi lors des appels réseau réussis vers Supabase.
- Aucune modification de base de données requise.
