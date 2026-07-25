# 📘 Guide d'Utilisation - Application de Gestion de Stock et Ventes

## Table des Matières

1. [Introduction](#1-introduction)
2. [Authentification et Accès](#2-authentification-et-accès)
3. [Espace Administrateur](#3-espace-administrateur)
4. [Espace Vendeur](#4-espace-vendeur)
5. [Gestion de l'Inventaire](#5-gestion-de-linventaire)
6. [Page Profil](#6-page-profil)
7. [Fonctionnalités Transversales](#7-fonctionnalités-transversales)
8. [Catégories Prédéfinies](#8-catégories-prédéfinies)
9. [Raccourcis Clavier](#9-raccourcis-clavier)
10. [Notes Techniques](#10-notes-techniques)

---

## 1. Introduction

### 1.1 Présentation

Cette application de gestion de stock et de ventes est une solution complète pour les entreprises commerciales. Elle permet de gérer efficacement les produits, les ventes, les stocks et les utilisateurs à travers une interface moderne et intuitive.

### 1.2 Technologies Utilisées

| Technologie | Utilisation |
|-------------|-------------|
| React 18 | Framework frontend |
| TypeScript | Typage statique |
| Tailwind CSS | Stylisation |
| Supabase | Backend (Auth, Database, Storage) |
| Vite | Build tool |
| Capacitor | Support mobile natif |

### 1.3 Langues et Devises

- **Langue de l'interface** : Français
- **Devises supportées** : USD (Dollar américain) et HTG (Gourde haïtienne)
- **Taux de conversion** : Configurable via les paramètres de l'entreprise

---

## 2. Authentification et Accès

### 2.1 Page de Connexion (`/auth`)

#### Connexion
1. Saisissez votre **email** et **mot de passe**
2. Cliquez sur **Se connecter**
3. Vous serez redirigé vers votre tableau de bord selon votre rôle

#### Inscription
1. Cliquez sur l'onglet **Inscription**
2. Remplissez les champs :
   - Nom complet (obligatoire)
   - Email (obligatoire)
   - Téléphone (optionnel)
   - Mot de passe (minimum 6 caractères)
3. Cliquez sur **S'inscrire**

> ⚠️ **Note** : Les nouveaux comptes vendeurs nécessitent une approbation par un administrateur avant de pouvoir accéder à l'application.

#### Mot de Passe Oublié
1. Cliquez sur **Mot de passe oublié ?**
2. Entrez votre email
3. Un lien de réinitialisation vous sera envoyé

### 2.2 Rôles Utilisateurs

| Rôle | Description | Accès |
|------|-------------|-------|
| **Admin** | Gestionnaire complet | Dashboard, produits, ventes, utilisateurs, rapports, paramètres, inventaire |
| **Vendeur** | Opérateur de vente | Interface de vente, consultation stock, historique personnel |

---

## 3. Espace Administrateur

### 3.1 Tableau de Bord Principal (`/admin`)

Le tableau de bord affiche une vue d'ensemble des performances commerciales :

#### KPIs (Indicateurs Clés)
- **Revenus** : Total des ventes (jour/semaine/mois)
- **Nombre de ventes** : Transactions réalisées
- **Panier moyen** : Valeur moyenne par transaction
- **Profit** : Marge bénéficiaire calculée

#### Graphiques
- **Tendances des ventes** : Courbe d'évolution
- **Distribution par catégorie** : Répartition des ventes
- **Top 5 produits** : Meilleurs vendeurs
- **Top 5 vendeurs** : Performances individuelles

### 3.2 Analyses Avancées (Analytics Dashboard)

Accédez à des analyses approfondies avec :

- **Graphiques interactifs** : Zoom et sélection de périodes via Brush
- **Comparaison temporelle** : Période actuelle vs précédente
- **Heatmap** : Heures de pointe des ventes
- **Sélecteur de période** :
  - Aujourd'hui
  - 7 derniers jours
  - 30 derniers jours
  - 90 derniers jours
  - Année complète
  - Période personnalisée

> 🔄 **Rafraîchissement automatique** : Les données se mettent à jour toutes les 60 secondes

### 3.3 Gestion des Catégories

#### Catégories Principales
1. Accédez à **Catégories** dans le menu
2. **Créer** : Cliquez sur "+ Nouvelle catégorie"
3. **Modifier** : Cliquez sur l'icône crayon
4. **Supprimer** : Cliquez sur l'icône corbeille (confirmation requise)
5. **Réorganiser** : Glissez-déposez pour changer l'ordre

#### Sous-catégories
- Liées à une catégorie parente
- Définissent le **type de stock** :
  - `boîtes` : Pour céramique (conversion m²)
  - `barres` : Pour fer/acier
  - `quantité` : Pour produits génériques

#### Spécifications Dynamiques
Chaque sous-catégorie peut avoir des champs personnalisés :
- **Texte** : Dimensions, modèle
- **Nombre** : Surface, poids, prix au m²
- **Sélection** : Couleur, matériau
- **Booléen** : En promotion, fragile

### 3.4 Gestion des Produits

#### Informations Produit
| Champ | Description |
|-------|-------------|
| Nom | Nom du produit |
| Code-barres | Identifiant unique scannable |
| Catégorie/Sous-catégorie | Classification hiérarchique |
| Prix de vente | Prix unitaire |
| Prix coûtant | Prix d'achat (pour calcul profit) |
| Devise | USD ou HTG |
| Stock | Quantité disponible |
| Seuil d'alerte | Niveau de stock minimum |
| Type de vente | Détail ou Gros |

#### Actions
- **Filtres** : Recherche, catégorie, statut, devise
- **Vue** : Tableau ou cartes
- **Export** : Excel (.xlsx) et PDF

### 3.5 Gestion des Ventes

#### Liste des Transactions
- Affichage de toutes les ventes avec filtres :
  - Par période (jour, semaine, mois, personnalisé)
  - Par vendeur

#### Détails d'une Vente
Cliquez sur une vente pour voir :
- Articles vendus avec quantités et prix
- Remises appliquées
- TVA calculée
- Total TTC
- Informations client

#### Actions
- **Supprimer** : Avec confirmation et journalisation
- **Export** : Excel et PDF des données filtrées

### 3.6 Gestion des Utilisateurs

#### Vue d'Ensemble
- Liste des utilisateurs en tableau ou cartes
- Statut actif/inactif visible

#### Actions Disponibles
| Action | Description |
|--------|-------------|
| Activer/Désactiver | Contrôle l'accès à l'application |
| Promouvoir Admin | Donner les droits administrateur |
| Supprimer | Retirer l'utilisateur (irréversible) |
| Restrictions catégories | Limiter l'accès vendeur à certaines catégories |

#### Export
- Liste des utilisateurs en Excel

### 3.7 Rapports

#### 3.7.1 Rapport de Performance Vendeurs
- Classement par revenus générés
- Classement par nombre de ventes
- Graphiques comparatifs
- Filtrage par période

#### 3.7.2 Rapports Avancés
- Statistiques détaillées (ventes, produits, vendeurs)
- Distribution par méthode de paiement
- Top produits par catégorie
- Panier moyen

#### 3.7.3 Rapport TVA
| Colonne | Description |
|---------|-------------|
| HT | Montant hors taxes |
| TVA | Taxe calculée (taux configurable) |
| TTC | Total toutes taxes comprises |

- Affichage par devise (USD/HTG)
- Export PDF professionnel avec en-tête entreprise

### 3.8 Journal d'Activité

Suivi complet de toutes les actions :

#### Types d'Actions Journalisées
- 🛒 **Ventes** : Création, modification, suppression
- 📦 **Produits** : Ajout, modification, suppression
- 📊 **Stock** : Mouvements, ajustements
- 👤 **Utilisateurs** : Inscription, activation, promotion
- ⚙️ **Paramètres** : Modifications de configuration

#### Informations Affichées
- Date et heure
- Type d'action (avec badge couleur)
- Description
- Utilisateur responsable
- Badge devise (USD vert / HTG bleu) pour les transactions

### 3.9 Alertes de Stock

Dashboard des alertes :
- **Produits en rupture** : Stock = 0 (rouge)
- **Produits en alerte** : Stock ≤ seuil configuré (orange)
- **Mouvements récents** : 20 derniers mouvements de stock

### 3.10 Paramètres de l'Entreprise

Configuration complète organisée en sections accordéon :

#### Logo
- Upload image (formats : JPG, PNG)
- Positionnement pour les PDF (gauche, centre, droite)

#### Informations Entreprise
- Nom de l'entreprise
- Description / Slogan

#### Adresse
- Adresse complète
- Téléphone
- Email

#### Devises
- **Taux de change USD/HTG** : Ex: 132.00 HTG pour 1 USD
- **Devise d'affichage par défaut** : USD ou HTG

#### Paiement et TVA
- **Taux de TVA** : Pourcentage applicable
- **Conditions de paiement** : Texte personnalisé pour les factures

> 💾 **Sauvegarde automatique** : Les modifications sont enregistrées automatiquement après 2 secondes d'inactivité

### 3.11 Monitoring Base de Données

- Statistiques de taille et utilisation
- Historique de croissance
- Surveillance des performances

---

## 4. Espace Vendeur

### 4.1 Tableau de Bord Vendeur (`/seller`)

#### Statistiques Personnelles
- Ventes du jour
- Ventes de la semaine
- Ventes du mois
- Comparaison avec périodes précédentes

#### Graphique de Tendance
- Évolution des ventes sur 7 jours
- Visualisation de la performance

#### Top 5 Produits Personnels
- Produits les plus vendus par le vendeur
- Classement par revenu généré

#### Objectifs de Vente
- Progression vers les objectifs définis
- Indicateur visuel de complétion

### 4.2 Interface de Vente (SellerWorkflow)

#### Étape 1 : Sélection des Produits

**Navigation dans le catalogue :**
- Filtres par catégorie/sous-catégorie
- Recherche par nom ou code-barres
- Vue en cartes ou liste (toggle)

**Scan Code-barres :**
- Support des scanners USB/Bluetooth
- Détection automatique et ajout au panier

**Ajout au Panier :**
- Cliquez sur un produit pour le sélectionner
- Définissez la quantité
- Pour céramique : saisie en m² (conversion auto en boîtes)
- Pour fer : saisie en barres ou tonnes

#### Étape 2 : Gestion du Panier

| Action | Description |
|--------|-------------|
| Modifier quantité | Ajustez les quantités avec +/- |
| Supprimer article | Cliquez sur l'icône corbeille |
| Voir sous-total | Affiché par devise (USD/HTG) |
| Total unifié | Conversion dans la devise par défaut |

#### Étape 3 : Paiement

**Informations Client :**
- Nom du client (optionnel)
- Adresse (optionnelle)

**Remise :**
- Type : Pourcentage (%) ou Montant fixe
- Valeur : Saisie du montant

**Méthode de Paiement :**
- Espèces
- Carte bancaire
- Virement
- Crédit

#### Étape 4 : Confirmation

**Récapitulatif :**
- Liste des articles
- Sous-total HT
- Remise appliquée
- TVA calculée
- **Total TTC**
- Taux de change affiché si multi-devises

**Documents :**
- 🧾 **Générer Reçu** : Format compact
- 📄 **Générer Facture** : Format professionnel avec logo

**Après Confirmation :**
- Stock automatiquement déduit
- Transaction enregistrée
- Option : Nouvelle vente (Ctrl+N)

### 4.3 Historique "Mes Ventes"

#### Filtres Disponibles
| Filtre | Description |
|--------|-------------|
| Aujourd'hui | Ventes du jour |
| Semaine | 7 derniers jours |
| Mois | 30 derniers jours |
| Toutes | Historique complet |

#### Affichage
- Nom client (ou "Client anonyme")
- Date et heure
- Montant avec badge devise (USD/HTG)
- Icône œil pour voir les détails

#### Détails de Vente
Cliquez sur une vente pour afficher :
- Tous les articles vendus
- Quantités et prix unitaires
- Remises appliquées
- TVA
- Total TTC

### 4.4 Consultation Stock

- Vue lecture seule des produits
- Filtrage par catégories autorisées
- Niveaux de stock visibles
- Alertes de rupture affichées

---

## 5. Gestion de l'Inventaire

### 5.1 Vue Principale (`/inventory`)

#### Options d'Affichage
- **Tableau** : Vue détaillée avec colonnes triables
- **Cartes** : Vue visuelle compacte

#### Filtres
| Filtre | Options |
|--------|---------|
| Recherche | Nom, code-barres |
| Catégorie | Toutes catégories disponibles |
| Niveau stock | Tous, En rupture, En alerte, Normal |
| Statut | Actif, Inactif |

#### Tri
- Par nom (A-Z, Z-A)
- Par quantité (croissant, décroissant)
- Par catégorie
- Par prix

#### Statistiques Affichées
- Valeur totale du stock
- Nombre de produits en rupture
- Nombre de produits en alerte

### 5.2 Ajustements de Stock

#### Types de Mouvements
| Type | Icône | Description |
|------|-------|-------------|
| Ajouter | ➕ | Réception de marchandise |
| Retirer | ➖ | Sortie manuelle, perte |
| Ajuster | 🔄 | Correction après inventaire |

#### Procédure
1. Sélectionnez le produit
2. Choisissez le type de mouvement
3. Entrez la quantité
4. Saisissez la raison (obligatoire)
5. Confirmez

> 📝 **Note** : Toutes les modifications sont journalisées avec l'utilisateur, la date et la raison.

### 5.3 Mode Inventaire Rapide

Optimisé pour le comptage physique :
- Scan en série des produits
- Saisie rapide des quantités
- Validation groupée

### 5.4 Historique des Mouvements

#### Colonnes Affichées
| Colonne | Description |
|---------|-------------|
| Date/Heure | Moment du mouvement |
| Produit | Nom du produit concerné |
| Type | Entrée, Sortie, Ajustement |
| Quantité | Valeur positive ou négative |
| Avant | Stock avant mouvement |
| Après | Stock après mouvement |
| Raison | Justification saisie |
| Utilisateur | Responsable de l'action |

#### Filtres
- Période (date de début, date de fin)
- Type de mouvement
- Produit spécifique
- Catégorie

#### Statistiques
- Total des entrées
- Total des sorties
- Total des ajustements

#### Export
- Excel (.xlsx)
- PDF avec en-tête entreprise

---

## 6. Page Profil

### 6.1 Informations Personnelles (`/profile`)

#### Avatar
- Cliquez sur l'avatar pour modifier
- Formats acceptés : JPG, PNG
- Taille maximum : 2 Mo

#### Champs Modifiables
| Champ | Modifiable | Description |
|-------|------------|-------------|
| Nom complet | ✅ Oui | Prénom et nom |
| Téléphone | ✅ Oui | Numéro de contact |
| Email | ❌ Non | Identifiant de connexion |

### 6.2 Sécurité

#### Changement de Mot de Passe
1. Cliquez sur **Modifier le mot de passe**
2. Entrez le nouveau mot de passe (min. 6 caractères)
3. Confirmez le nouveau mot de passe
4. Cliquez sur **Enregistrer**

### 6.3 Historique d'Activité

Affiche les 20 dernières actions de l'utilisateur :
- Type d'action avec icône
- Date et heure
- Description

**Statistiques :**
- Date d'inscription ("Membre depuis")
- Dernière activité

---

## 7. Fonctionnalités Transversales

### 7.1 Support Multi-Devises

#### Configuration par Produit
- Chaque produit peut être tarifé en USD ou HTG
- Le prix est affiché dans la devise d'origine

#### Calcul des Ventes
- Les articles multi-devises sont convertis automatiquement
- Le taux de conversion est configurable dans les paramètres
- Le total unifié s'affiche dans la devise par défaut

#### Badges Visuels
| Devise | Couleur | Badge |
|--------|---------|-------|
| USD | 🟢 Vert | `USD` |
| HTG | 🔵 Bleu | `HTG` |

### 7.2 Calculs Financiers Centralisés

Toute l'application utilise une logique unifiée :

```
Sous-total HT = Σ (prix_unitaire × quantité)
Remise = Sous-total × (% remise) OU montant_fixe
Montant après remise = Sous-total - Remise
TVA = Montant après remise × (taux_TVA / 100)
Total TTC = Montant après remise + TVA
```

### 7.3 Génération de Documents PDF

#### Types de Documents
| Document | Usage | Contenu |
|----------|-------|---------|
| Reçu | Remise au client | Format compact, essentiel |
| Facture | Document officiel | Format complet avec logo, détails |
| Rapport TVA | Comptabilité | Résumé fiscal par période |
| Rapport Inventaire | Audit stock | Liste complète avec valeurs |

#### Personnalisation
Tous les PDF incluent automatiquement :
- Logo de l'entreprise
- Nom et adresse
- Téléphone et email
- Numéro de TVA

### 7.4 Temps Réel

- **Synchronisation stock** : Mise à jour automatique après chaque vente
- **Rafraîchissement listes** : Actualisation périodique des données
- **Notifications** : Alertes de stock en temps réel

### 7.5 Design Responsive

L'application s'adapte à tous les écrans :

| Appareil | Adaptations |
|----------|-------------|
| Desktop | Vue complète, tableaux détaillés |
| Tablette | Mise en page optimisée |
| Mobile | Vue en cartes, navigation tactile, swipe actions |

### 7.6 Thème Sombre/Clair

- Basculement via le bouton dans l'interface
- Détection automatique des préférences système
- Persistance du choix utilisateur

---

## 8. Catégories Prédéfinies

Le système inclut des catégories et sous-catégories préconfigurées :

| Catégorie | Sous-catégories | Type de stock |
|-----------|-----------------|---------------|
| **Matériaux de Construction** | Céramique | boîtes (conversion m²) |
| | Fer / Acier | barres |
| | Blocs | quantité |
| **Électroménager** | Réfrigération | quantité |
| | Cuisson | quantité |
| | Lavage | quantité |
| | Climatisation | quantité |
| **Alimentaire** | - | quantité |
| **Boissons** | - | quantité |
| **Électronique** | - | quantité |
| **Énergie** | - | quantité |
| **Vêtements** | - | quantité |
| **Autres** | - | quantité |

> 💡 **Note** : Vous pouvez créer vos propres catégories et sous-catégories avec des spécifications personnalisées.

---

## 9. Raccourcis Clavier

### Interface de Vente

| Raccourci | Action |
|-----------|--------|
| `Ctrl + L` | Basculer entre vue Liste et Cartes |
| `Ctrl + P` | Aller directement au Panier |
| `Escape` | Retour à l'étape précédente |
| `Ctrl + N` | Nouvelle vente (après confirmation) |
| `Ctrl + ?` | Afficher l'aide des raccourcis |

### Scan Code-barres

| Action | Fonctionnement |
|--------|----------------|
| Scan rapide | Le produit est automatiquement ajouté au panier |
| Scan inexistant | Message d'erreur affiché |

---

## 10. Notes Techniques

### 10.1 Authentification

- **Système** : Supabase Auth avec sessions JWT
- **Sécurité** : Row Level Security (RLS) sur toutes les tables
- **Rôles** : Gérés dans une table séparée `user_roles`
- **Sessions** : Rafraîchissement automatique

### 10.2 Base de Données

- **Type** : PostgreSQL via Supabase
- **Migrations** : Versionnées dans `/supabase/migrations`
- **Edge Functions** : Logique métier côté serveur
  - `process-sale` : Traitement des ventes
  - `delete-sale` : Suppression sécurisée
  - `create-activity-log` : Journalisation
  - `database-cleanup` : Maintenance

### 10.3 Stockage de Fichiers

| Bucket | Usage | Accès |
|--------|-------|-------|
| `avatars` | Photos de profil | Public |
| `company-assets` | Logo entreprise | Public |

### 10.4 Tables Principales

| Table | Description |
|-------|-------------|
| `profiles` | Informations utilisateurs |
| `user_roles` | Rôles et permissions |
| `products` | Catalogue produits |
| `categories` | Catégories principales |
| `sous_categories` | Sous-catégories |
| `specifications_modeles` | Champs dynamiques |
| `sales` | Transactions |
| `sale_items` | Détails des ventes |
| `stock_movements` | Historique stock |
| `activity_logs` | Journal d'activité |
| `company_settings` | Paramètres entreprise |

---

## Support

Pour toute question ou assistance technique, contactez l'administrateur de votre entreprise ou l'équipe de support technique.

---

*Dernière mise à jour : Janvier 2026*
