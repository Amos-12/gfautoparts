# Ventes : dates personnalisées, pagination et cohérence des montants

## Ce qui ne va pas aujourd'hui

Trois écrans calculent le chiffre d'affaires de trois façons différentes :

- **Mes ventes (vendeur)** : total TTC, remise déduite (calcul centralisé).
- **Ventes (admin)** : les lignes affichent le TTC, mais les cartes de revenus en haut affichent un montant **hors taxe**, d'où l'écart.
- **Performances des vendeurs** : additionne simplement les lignes d'articles — **la remise n'est pas déduite** et la TVA n'est pas ajoutée. De plus cet écran ne lit que les 1000 premières ventes, donc les chiffres sont tronqués.

Résultat : le même vendeur n'a pas le même total selon la page.

## Ce qui sera fait

1. **Un seul calcul partout**
   Les trois écrans utiliseront le même calcul de référence : sous-total, moins la remise (dans sa devise), plus la TVA. Les cartes de revenus de la page Ventes admin passeront donc en TTC comme les lignes, et les performances vendeurs déduiront enfin les remises.

2. **Dates personnalisées**
   Un sélecteur de période commun avec les choix : Tout, Aujourd'hui, Cette semaine, Ce mois, et **Personnalisé (du … au …)** avec un calendrier. Il sera ajouté sur :
   - Ventes (admin)
   - Mes ventes (espace vendeur)
   - Performances des vendeurs
   - Rapports financiers utilisant déjà une période

3. **Pagination par 20**
   Les listes de ventes (admin et vendeur) afficheront 20 ventes par page, avec navigation précédent/suivant et compteur « x–y sur N ». Le filtre s'applique d'abord, la pagination ensuite, et la page revient à 1 à chaque changement de filtre.

4. **Chargement complet**
   Les performances vendeurs chargeront toutes les ventes de la période (par paquets de 1000), plus de plafond à 1000.

## Détails techniques

- Nouveau composant `src/components/Common/PeriodRangeFilter.tsx` : Select + `Popover`/`Calendar` (mode range), renvoie `{ preset, from, to }`.
- Nouveau hook `src/hooks/usePeriodRange.ts` : convertit le preset en bornes `startOfDay`/`endOfDay` (semaine lundi→dimanche, locale fr).
- `SalesManagement.tsx` : remplacer le calcul maison des `currencies` et de `revenueStats` par `saleCalculationUtils.calculateSaleTotal` (remise + TVA), brancher `PeriodRangeFilter`, conserver `usePagination(filteredSales, 20)` et l'appliquer aussi à l'export PDF (période affichée).
- `SellerDashboard.tsx` (onglet Historique) : filtre période avec dates personnalisées, requête bornée par `gte`/`lte`, pagination 20 via `usePagination`, total de période recalculé sur l'ensemble filtré (pas seulement la page).
- `SellerPerformanceReport.tsx` : passer à `fetchAllRows`, ajouter `discount_amount`/`discount_currency`/`subtotal` à la requête, calculer par vente avec `saleCalculationUtils.calculateSaleTotal` puis agréger par vendeur (CA converti, panier moyen, tendance sur la période précédente de même durée), remplacer le Select 7/30/90 jours par `PeriodRangeFilter`.
- Le bénéfice reste `profit_amount` des lignes, ajusté au prorata de la remise comme le fait déjà `calculateUnifiedProfit`.
- Aucun changement de base de données.
