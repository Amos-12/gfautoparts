

## Plan : Traduction complète de tous les composants restants

### Constat

Seuls 16 fichiers utilisent `useTranslation()`. Tous les autres composants (30+) contiennent du texte français en dur : labels, toasts, badges, colonnes de tableaux, filtres, états vides, et le composant `TablePagination`. Les dates utilisent encore `fr` de date-fns au lieu de la locale dynamique.

### Composants à migrer (par priorité)

**Groupe 1 — Dashboard Admin (5 fichiers, ~2500 lignes)**
- `AdminDashboardCharts.tsx` (1052 lignes) — KPI titles, period labels, chart labels, toasts, export PDF
- `AdminBusinessHealth.tsx` (144 lignes) — health labels ("Excellent", "Bon", "Critique"), card titles
- `AdminTopSellersChart.tsx` — chart labels
- `RecentActivities.tsx` (225 lignes) — activity labels, time formatting `fr` locale
- `KPICard.tsx` — already receives translated titles, OK

**Groupe 2 — Analytics (1 fichier, 680 lignes)**
- `AnalyticsDashboard.tsx` — period labels, tab names, chart titles, KPI labels, date-fns `fr`

**Groupe 3 — Categories (3 fichiers, ~1100 lignes)**
- `CategoryManagement.tsx` (545 lignes) — table headers, badges "Active/Inactive", dialog labels, toasts
- `SubcategoryManagement.tsx` — similar
- `SpecificationFieldsManager.tsx` — field labels

**Groupe 4 — Inventaire (3 fichiers, ~1500 lignes)**
- `InventoryManagement.tsx` (1048 lignes) — filters, stock levels, table headers, dialogs, export, toasts
- `QuickInventoryMode.tsx` — labels
- `InventoryHistory.tsx` — table headers, date formatting

**Groupe 5 — Reports (3 fichiers, ~1900 lignes)**
- `AdvancedReports.tsx` (947 lignes) — period selector, chart labels, export buttons, toasts, date-fns `fr`
- `SellerPerformanceReport.tsx` (518 lignes) — period labels, table headers, export
- `TvaReport.tsx` (470 lignes) — table headers, labels, date inputs, PDF export

**Groupe 6 — Activity Logs (2 fichiers)**
- `ActivityLogPanel.tsx` (380 lignes) — ACTION_TYPES labels array, filters, date formatting
- `GlobalActivityLogs.tsx` — similar

**Groupe 7 — Seller (4 fichiers, ~4600 lignes)**
- `SellerWorkflow.tsx` (2773 lignes) — product cards, cart, checkout, toasts, print labels
- `CartSection.tsx` (348 lignes) — cart labels, buttons, dialogs
- `ProformaWorkflow.tsx` (1233 lignes) — proforma labels, saved drafts, print
- `SavedProformasList.tsx` (301 lignes) — list headers, badges, date formatting

**Groupe 8 — SuperAdmin (7 fichiers)**
- `CompanyList.tsx`, `GlobalUsersPanel.tsx`, `PaymentsPanel.tsx`, `SaasKPIs.tsx`, `SubscriptionPlansManager.tsx`, `SuperAdminDbMonitoring.tsx`, `PaymentExchangeRateSettings.tsx` — all have hardcoded French

**Groupe 9 — Autres**
- `HelpPage.tsx` (451 lignes) — toute la FAQ en dur (structurée en array)
- `DatabaseMonitoring.tsx` — labels
- `SellerDashboard.tsx` / `SellerDashboardStats.tsx` / `SellerGoalsCard.tsx` / `SellerTrendChart.tsx` / etc.
- `ExpiredScreen.tsx`, `LockedFeature.tsx`, `UpgradeBanner.tsx` — subscription messages
- `Profile.tsx` — si pas encore traduit
- `Auth.tsx` — si pas encore traduit

**Groupe 10 — Pagination**
- `TablePagination.tsx` — "sur", "résultat(s)", "Précédent", "Suivant" en dur

### Approche technique

Pour chaque composant :
1. Ajouter `import { useTranslation } from 'react-i18next'` et `const { t } = useTranslation()`
2. Remplacer toutes les chaînes visibles par `t('namespace.key')`
3. Remplacer `date-fns/locale fr` par import dynamique basé sur la langue active (utiliser les helpers de `src/lib/locale.ts`)
4. Ajouter les clés correspondantes dans `fr.json`, `en.json`, `es.json`

Pour `HelpPage.tsx` spécifiquement : transformer l'array statique en clés i18n structurées (`help.sections.auth.title`, `help.sections.auth.questions.0.question`, etc.)

Pour `TablePagination.tsx` : ajouter `useTranslation()` et traduire "Précédent", "Suivant", "sur X résultats"

Pour les formats de date : créer un helper `getDateFnsLocale()` dans `src/lib/locale.ts` qui retourne `fr`, `en`, ou `es` de date-fns selon la langue active, et l'utiliser partout au lieu de `{ locale: fr }`

### Livraison

Vu le volume (~30 fichiers, ~15000 lignes), je procéderai par groupes dans l'ordre listé. Les clés de traduction seront ajoutées dans les 3 fichiers JSON au fur et à mesure. Le résultat final : 100% de l'application traduite, y compris pagination, dates, et page d'aide.

