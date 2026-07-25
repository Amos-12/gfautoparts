import jsPDF from 'jspdf';

export const generateUserGuidePDF = async () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = margin;

  const addNewPage = () => {
    doc.addPage();
    yPos = margin;
  };

  const checkPageBreak = (requiredHeight: number) => {
    if (yPos + requiredHeight > pageHeight - margin) {
      addNewPage();
    }
  };

  const addTitle = (text: string, fontSize: number = 24) => {
    checkPageBreak(20);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(text, margin, yPos);
    yPos += fontSize * 0.5 + 5;
  };

  const addSubtitle = (text: string, fontSize: number = 16) => {
    checkPageBreak(15);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 65, 81);
    doc.text(text, margin, yPos);
    yPos += fontSize * 0.4 + 3;
  };

  const addParagraph = (text: string, indent: number = 0) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    checkPageBreak(lines.length * 5 + 5);
    doc.text(lines, margin + indent, yPos);
    yPos += lines.length * 5 + 3;
  };

  const addBulletPoint = (text: string, indent: number = 5) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    const bullet = '•';
    const lines = doc.splitTextToSize(text, contentWidth - indent - 5);
    checkPageBreak(lines.length * 5 + 3);
    doc.text(bullet, margin + indent, yPos);
    doc.text(lines, margin + indent + 5, yPos);
    yPos += lines.length * 5 + 2;
  };

  const addSpacer = (height: number = 5) => {
    yPos += height;
  };

  const addHorizontalLine = () => {
    checkPageBreak(5);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
  };

  // Cover Page
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Guide d\'Utilisation', pageWidth / 2, 35, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Application de Gestion de Stock et Ventes', pageWidth / 2, 48, { align: 'center' });

  yPos = 80;
  
  doc.setFontSize(12);
  doc.setTextColor(75, 85, 99);
  doc.text('Version 1.0', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, yPos, { align: 'center' });

  // Table of Contents
  addNewPage();
  addTitle('Table des Matières', 20);
  addSpacer(5);

  const tocItems = [
    '1. Introduction',
    '2. Authentification et Accès',
    '3. Espace Administrateur',
    '4. Espace Vendeur',
    '5. Gestion de l\'Inventaire',
    '6. Page Profil',
    '7. Fonctionnalités Transversales',
    '8. Raccourcis Clavier',
    '9. Notes Techniques'
  ];

  tocItems.forEach(item => {
    addParagraph(item, 5);
  });

  // Section 1: Introduction
  addNewPage();
  addTitle('1. Introduction');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('1.1 Présentation');
  addParagraph('Cette application de gestion de stock et de ventes est une solution complète pour les entreprises commerciales. Elle permet de gérer efficacement les produits, les ventes, les stocks et les utilisateurs à travers une interface moderne et intuitive.');
  addSpacer(5);

  addSubtitle('1.2 Technologies');
  addBulletPoint('React 18 - Framework frontend');
  addBulletPoint('TypeScript - Typage statique');
  addBulletPoint('Tailwind CSS - Stylisation');
  addBulletPoint('Supabase - Backend (Auth, Database, Storage)');
  addSpacer(5);

  addSubtitle('1.3 Devises Supportées');
  addParagraph('L\'application supporte deux devises: USD (Dollar américain) et HTG (Gourde haïtienne). Le taux de conversion est configurable via les paramètres de l\'entreprise.');

  // Section 2: Authentification
  addNewPage();
  addTitle('2. Authentification et Accès');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('2.1 Connexion');
  addBulletPoint('Accédez à la page /auth');
  addBulletPoint('Entrez votre email et mot de passe');
  addBulletPoint('Cliquez sur "Se connecter"');
  addBulletPoint('Vous serez redirigé vers votre tableau de bord selon votre rôle');
  addSpacer(5);

  addSubtitle('2.2 Inscription');
  addBulletPoint('Cliquez sur l\'onglet "Inscription"');
  addBulletPoint('Remplissez: nom complet, email, téléphone (optionnel), mot de passe');
  addBulletPoint('Note: Les comptes vendeurs nécessitent une approbation admin');
  addSpacer(5);

  addSubtitle('2.3 Rôles Utilisateurs');
  addBulletPoint('Admin: Accès complet (dashboard, produits, ventes, utilisateurs, rapports, paramètres)');
  addBulletPoint('Vendeur: Interface de vente, consultation stock, historique personnel');

  // Section 3: Espace Administrateur
  addNewPage();
  addTitle('3. Espace Administrateur');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('3.1 Tableau de Bord');
  addParagraph('Le tableau de bord affiche une vue d\'ensemble des performances commerciales:');
  addBulletPoint('KPIs: Revenus, nombre de ventes, panier moyen, profit');
  addBulletPoint('Graphiques: Tendances des ventes, distribution par catégorie');
  addBulletPoint('Top 5 produits et vendeurs');
  addSpacer(5);

  addSubtitle('3.2 Gestion des Catégories');
  addBulletPoint('Catégories principales avec réorganisation par glisser-déposer');
  addBulletPoint('Sous-catégories avec type de stock (boîtes, barres, quantité)');
  addBulletPoint('Spécifications dynamiques personnalisables par sous-catégorie');
  addSpacer(5);

  addSubtitle('3.3 Gestion des Produits');
  addBulletPoint('Informations: nom, code-barres, prix, stock, seuil d\'alerte');
  addBulletPoint('Support multi-devises (USD/HTG)');
  addBulletPoint('Filtres et export Excel/PDF');
  addSpacer(5);

  addSubtitle('3.4 Gestion des Ventes');
  addBulletPoint('Liste des transactions avec filtres par période et vendeur');
  addBulletPoint('Détails complets de chaque vente');
  addBulletPoint('Suppression avec journalisation');
  addSpacer(5);

  addSubtitle('3.5 Gestion des Utilisateurs');
  addBulletPoint('Activation/désactivation des comptes');
  addBulletPoint('Promotion en admin');
  addBulletPoint('Restrictions par catégories');
  addSpacer(5);

  addSubtitle('3.6 Rapports');
  addBulletPoint('Performance Vendeurs: classement par revenus/ventes');
  addBulletPoint('Rapports Avancés: statistiques détaillées');
  addBulletPoint('Rapport TVA: calcul HT/TVA/TTC avec export PDF');

  // Section 4: Espace Vendeur
  addNewPage();
  addTitle('4. Espace Vendeur');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('4.1 Tableau de Bord Vendeur');
  addBulletPoint('Statistiques personnelles: ventes du jour/semaine/mois');
  addBulletPoint('Graphique de tendance sur 7 jours');
  addBulletPoint('Top 5 produits personnels');
  addSpacer(5);

  addSubtitle('4.2 Interface de Vente');
  addParagraph('Le workflow de vente se déroule en 4 étapes:');
  addBulletPoint('1. Sélection produits: catalogue, recherche, scan code-barres');
  addBulletPoint('2. Panier: gestion des quantités');
  addBulletPoint('3. Paiement: client, remise, méthode de paiement');
  addBulletPoint('4. Confirmation: génération reçu/facture PDF');
  addSpacer(5);

  addSubtitle('4.3 Scan Code-barres');
  addParagraph('Connectez un scanner USB/Bluetooth. Le produit scanné est automatiquement ajouté au panier.');
  addSpacer(5);

  addSubtitle('4.4 Quantités Spéciales');
  addBulletPoint('Céramique: saisie en m² (conversion auto en boîtes)');
  addBulletPoint('Fer: saisie en barres ou tonnes');
  addSpacer(5);

  addSubtitle('4.5 Historique "Mes Ventes"');
  addBulletPoint('Filtre par période: Aujourd\'hui, Semaine, Mois, Toutes');
  addBulletPoint('Clic sur une vente pour voir les détails');

  // Section 5: Inventaire
  addNewPage();
  addTitle('5. Gestion de l\'Inventaire');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('5.1 Vue Principale');
  addBulletPoint('Affichage en tableau ou cartes');
  addBulletPoint('Filtres: recherche, catégorie, niveau de stock');
  addBulletPoint('Statistiques: valeur totale, produits en alerte');
  addSpacer(5);

  addSubtitle('5.2 Ajustements de Stock');
  addBulletPoint('Types: Ajouter, Retirer, Ajuster');
  addBulletPoint('Raison obligatoire pour traçabilité');
  addBulletPoint('Journalisation automatique');
  addSpacer(5);

  addSubtitle('5.3 Historique des Mouvements');
  addBulletPoint('Colonnes: Date, Produit, Type, Quantité, Avant/Après, Raison, Utilisateur');
  addBulletPoint('Export Excel et PDF');

  // Section 6: Profil
  addNewPage();
  addTitle('6. Page Profil');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('6.1 Informations Personnelles');
  addBulletPoint('Avatar avec upload photo (max 2 Mo)');
  addBulletPoint('Nom complet et téléphone modifiables');
  addBulletPoint('Email en lecture seule');
  addSpacer(5);

  addSubtitle('6.2 Sécurité');
  addBulletPoint('Changement de mot de passe (minimum 6 caractères)');
  addSpacer(5);

  addSubtitle('6.3 Historique d\'Activité');
  addBulletPoint('20 dernières actions de l\'utilisateur');
  addBulletPoint('Date d\'inscription et dernière activité');

  // Section 7: Fonctionnalités Transversales
  addNewPage();
  addTitle('7. Fonctionnalités Transversales');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('7.1 Multi-Devises');
  addBulletPoint('Chaque produit peut être tarifé en USD ou HTG');
  addBulletPoint('Conversion automatique vers la devise d\'affichage');
  addBulletPoint('Badges visuels: vert (USD), bleu (HTG)');
  addSpacer(5);

  addSubtitle('7.2 Calculs Financiers');
  addParagraph('Formule standard: Sous-total HT → Remise → TVA → Total TTC');
  addParagraph('La logique est centralisée pour garantir la cohérence dans toute l\'application.');
  addSpacer(5);

  addSubtitle('7.3 Génération PDF');
  addBulletPoint('Reçus de vente (format compact)');
  addBulletPoint('Factures (format professionnel avec logo)');
  addBulletPoint('Rapports TVA et inventaire');
  addSpacer(5);

  addSubtitle('7.4 Design Responsive');
  addParagraph('L\'application s\'adapte à tous les écrans (desktop, tablette, mobile).');
  addSpacer(5);

  addSubtitle('7.5 Thème Sombre/Clair');
  addParagraph('Basculement via le bouton dans l\'interface ou détection automatique des préférences système.');

  // Section 8: Raccourcis
  addNewPage();
  addTitle('8. Raccourcis Clavier');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('Interface de Vente');
  addBulletPoint('Ctrl + L : Basculer vue Liste/Cartes');
  addBulletPoint('Ctrl + P : Aller au panier');
  addBulletPoint('Escape : Retour étape précédente');
  addBulletPoint('Ctrl + N : Nouvelle vente (après confirmation)');
  addBulletPoint('Ctrl + ? : Afficher l\'aide');

  // Section 9: Notes Techniques
  addNewPage();
  addTitle('9. Notes Techniques');
  addHorizontalLine();
  addSpacer(3);

  addSubtitle('9.1 Authentification');
  addBulletPoint('Supabase Auth avec sessions JWT');
  addBulletPoint('Row Level Security (RLS) sur toutes les tables');
  addBulletPoint('Rôles gérés dans une table séparée (user_roles)');
  addSpacer(5);

  addSubtitle('9.2 Base de Données');
  addBulletPoint('PostgreSQL via Supabase');
  addBulletPoint('Migrations versionnées');
  addBulletPoint('Edge Functions pour la logique métier');
  addSpacer(5);

  addSubtitle('9.3 Tables Principales');
  addBulletPoint('profiles, user_roles: Utilisateurs et permissions');
  addBulletPoint('products, categories, sous_categories: Catalogue');
  addBulletPoint('sales, sale_items: Transactions');
  addBulletPoint('stock_movements: Historique stock');
  addBulletPoint('activity_logs: Journal d\'activité');
  addBulletPoint('company_settings: Configuration entreprise');

  // Footer on last page
  addSpacer(20);
  addHorizontalLine();
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text('© 2026 - Application de Gestion de Stock et Ventes', pageWidth / 2, yPos + 5, { align: 'center' });

  // Save
  doc.save('Guide_Utilisateur.pdf');
};
