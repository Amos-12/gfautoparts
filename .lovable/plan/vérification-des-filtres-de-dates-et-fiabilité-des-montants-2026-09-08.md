# Vérification des filtres de dates et fiabilité des montants

## Ce que la lecture du code montre

Les écrans n'appliquent pas les bornes de dates de la même façon :

- **Ventes (admin)**, **Mes ventes (vendeur)** et **Performances des vendeurs** utilisent le nouveau sélecteur de période : les bornes sont calculées en heure locale (début du jour → fin du jour) puis converties correctement. C'est la référence.
- **Rapports avancés** envoie les bornes sous forme de texte « 2026-09-08 » (et « …T23:59:59 » pour la fin), sans heure locale. Comme l'application tourne en Haïti (UTC−4), ces bornes sont lues comme des heures UTC : la journée retenue est décalée de 4 heures. Concrètement, les ventes faites après 20h00 le dernier jour de la période sont attribuées au lendemain, et celles du matin du premier jour peuvent être exclues.
- **Rapport TVA** construit ses dates avec `toISOString().split('T')[0]`, ce qui décale aussi la date affichée par défaut d'un jour en fin de journée.
- **Mes ventes (vendeur)** avec le choix « Toutes » est plafonné à 500 ventes : le total de période affiché est donc faux dès qu'un vendeur dépasse 500 ventes.

## Ce qui sera fait

1. **Des bornes de dates identiques partout**
   Les rapports avancés et le rapport TVA passeront au même calcul que les écrans de ventes : début de journée locale → fin de journée locale, converti proprement. Une même période donnera exactement les mêmes ventes sur toutes les pages.

2. **Le sélecteur de période commun dans les rapports avancés**
   Remplacement des deux calendriers séparés par le sélecteur unique (Tout / Aujourd'hui / Cette semaine / Ce mois / Personnalisé), avec la possibilité de garder un intervalle libre.

3. **Plus de plafond dans « Mes ventes »**
   Le choix « Toutes » chargera l'intégralité des ventes du vendeur (par paquets), pour que le total de période soit exact.

4. **Contrôle chiffré avant/après**
   Sur une même période de test (par exemple « Ce mois » et une plage personnalisée à cheval sur une soirée), comparaison du nombre de ventes et du chiffre d'affaires TTC entre : page Ventes admin, Mes ventes du vendeur concerné, Performances des vendeurs et Rapports avancés. Les quatre doivent afficher le même nombre de ventes et le même montant. Le résultat sera rapporté dans la réponse.

## Détails techniques

- `AdvancedReports.tsx` : remplacer `format(dateRange.from,'yyyy-MM-dd')` / `toDate + 'T23:59:59'` par `resolvePeriodRange` + `startOfDay/endOfDay(...).toISOString()` ; brancher `PeriodRangeFilter` (preset par défaut `month`) tout en conservant l'état `dateRange` dérivé pour les exports PDF/Excel et le libellé via `periodRangeLabel`.
- `TvaReport.tsx` : convertir les champs date (`dateFrom`/`dateTo`) en bornes locales avant la requête (`startOfDay`/`endOfDay`), et initialiser avec `format(date,'yyyy-MM-dd')` de date-fns au lieu de `toISOString().split('T')[0]`.
- `SellerDashboard.tsx` : remplacer `query.limit(500)` sur le preset `all` par `fetchAllRows` (paquets de 1000) ; le total de période reste calculé sur l'ensemble filtré, la pagination 20 inchangée.
- `PeriodRangeFilter.tsx` : quand seul `from` est choisi en mode personnalisé, la borne `to` reste la fin de ce même jour (comportement actuel conservé) ; aucune autre modification.
- Vérification : `npx tsgo --noEmit -p tsconfig.app.json`, puis contrôle en preview (Playwright) des totaux sur une même période dans les quatre écrans.
- Aucun changement de base de données.
