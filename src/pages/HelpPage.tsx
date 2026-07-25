import { useState } from 'react';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Search, 
  BookOpen, 
  Users, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Settings, 
  Warehouse,
  FileText,
  Keyboard,
  Shield,
  DollarSign,
  Download,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { generateUserGuidePDF } from '@/lib/userGuidePdf';
import { toast } from '@/hooks/use-toast';

const helpSections = [
  {
    id: 'auth',
    icon: Shield,
    title: 'Authentification',
    badge: 'Démarrage',
    content: [
      {
        question: 'Comment me connecter ?',
        answer: 'Accédez à la page /auth, entrez votre email et mot de passe, puis cliquez sur "Se connecter". Vous serez redirigé vers votre tableau de bord selon votre rôle (Admin ou Vendeur).'
      },
      {
        question: 'Comment créer un compte ?',
        answer: 'Cliquez sur l\'onglet "Inscription", remplissez vos informations (nom complet, email, téléphone optionnel, mot de passe minimum 6 caractères) et cliquez sur "S\'inscrire". Note: Les comptes vendeurs nécessitent une approbation admin.'
      },
      {
        question: 'J\'ai oublié mon mot de passe',
        answer: 'Cliquez sur "Mot de passe oublié ?" sur la page de connexion, entrez votre email et vous recevrez un lien de réinitialisation.'
      }
    ]
  },
  {
    id: 'admin-dashboard',
    icon: BarChart3,
    title: 'Tableau de Bord Admin',
    badge: 'Admin',
    content: [
      {
        question: 'Que contient le tableau de bord ?',
        answer: 'Le dashboard affiche les KPIs (revenus, nombre de ventes, panier moyen, profit), des graphiques de tendances, la distribution par catégorie, et le Top 5 des produits et vendeurs.'
      },
      {
        question: 'Comment accéder aux analyses avancées ?',
        answer: 'Cliquez sur "Analytics" dans le menu. Vous y trouverez des graphiques interactifs avec zoom, comparaison de périodes, heatmap des heures de pointe, et un sélecteur de période (Aujourd\'hui, 7j, 30j, 90j, Année, Personnalisé).'
      },
      {
        question: 'Les données sont-elles en temps réel ?',
        answer: 'Oui, les données se rafraîchissent automatiquement toutes les 60 secondes sur le dashboard Analytics.'
      }
    ]
  },
  {
    id: 'categories',
    icon: Package,
    title: 'Gestion des Catégories',
    badge: 'Admin',
    content: [
      {
        question: 'Comment créer une catégorie ?',
        answer: 'Allez dans "Catégories", cliquez sur "+ Nouvelle catégorie", remplissez le nom et validez. Vous pouvez réorganiser les catégories par glisser-déposer.'
      },
      {
        question: 'Qu\'est-ce qu\'une sous-catégorie ?',
        answer: 'Les sous-catégories sont liées à une catégorie parente et définissent le type de stock: "boîtes" (céramique avec conversion m²), "barres" (fer/acier), ou "quantité" (produits génériques).'
      },
      {
        question: 'Comment ajouter des spécifications dynamiques ?',
        answer: 'Dans l\'onglet "Spécifications", sélectionnez une sous-catégorie puis ajoutez des champs personnalisés (texte, nombre, sélection, booléen) qui s\'afficheront automatiquement lors de la création de produits.'
      }
    ]
  },
  {
    id: 'products',
    icon: Package,
    title: 'Gestion des Produits',
    badge: 'Admin',
    content: [
      {
        question: 'Quelles informations puis-je définir pour un produit ?',
        answer: 'Nom, code-barres, catégorie/sous-catégorie, prix de vente, prix coûtant, devise (USD ou HTG), stock, seuil d\'alerte, type de vente (Détail ou Gros), et spécifications techniques dynamiques.'
      },
      {
        question: 'Comment exporter la liste des produits ?',
        answer: 'Utilisez les boutons d\'export en haut de la liste pour télécharger au format Excel (.xlsx) ou PDF.'
      },
      {
        question: 'Comment filtrer les produits ?',
        answer: 'Utilisez la barre de recherche, les filtres par catégorie, statut (actif/inactif), et devise (USD/HTG).'
      }
    ]
  },
  {
    id: 'sales',
    icon: ShoppingCart,
    title: 'Gestion des Ventes',
    badge: 'Admin/Vendeur',
    content: [
      {
        question: 'Comment voir les détails d\'une vente ?',
        answer: 'Cliquez sur une vente dans la liste pour ouvrir une fenêtre affichant tous les articles, remises, TVA et totaux.'
      },
      {
        question: 'Puis-je supprimer une vente ?',
        answer: 'Oui, les admins peuvent supprimer une vente. Une confirmation est requise et l\'action est journalisée dans les logs d\'activité.'
      },
      {
        question: 'Comment exporter les ventes ?',
        answer: 'Filtrez par période et/ou vendeur, puis utilisez les boutons Excel ou PDF pour exporter les données filtrées.'
      }
    ]
  },
  {
    id: 'seller-workflow',
    icon: ShoppingCart,
    title: 'Interface de Vente (Vendeur)',
    badge: 'Vendeur',
    content: [
      {
        question: 'Quelles sont les étapes d\'une vente ?',
        answer: '1) Sélection des produits (catalogue, recherche, scan code-barres), 2) Gestion du panier (quantités), 3) Paiement (client, remise, méthode), 4) Confirmation (génération reçu/facture PDF).'
      },
      {
        question: 'Comment scanner un code-barres ?',
        answer: 'Connectez un scanner USB/Bluetooth. Lors de la saisie dans la recherche, le produit correspondant est automatiquement ajouté au panier.'
      },
      {
        question: 'Comment appliquer une remise ?',
        answer: 'À l\'étape Paiement, choisissez le type de remise (pourcentage % ou montant fixe) et entrez la valeur. La remise s\'applique dans la devise d\'affichage active.'
      },
      {
        question: 'Comment saisir des quantités pour la céramique ?',
        answer: 'Entrez la quantité en m² souhaitée. Le système convertit automatiquement en nombre de boîtes selon la surface par boîte définie dans les spécifications du produit.'
      }
    ]
  },
  {
    id: 'inventory',
    icon: Warehouse,
    title: 'Gestion de l\'Inventaire',
    badge: 'Admin',
    content: [
      {
        question: 'Comment ajuster le stock ?',
        answer: 'Sélectionnez un produit, choisissez le type de mouvement (Ajouter, Retirer, Ajuster), entrez la quantité et une raison obligatoire. Toutes les modifications sont journalisées.'
      },
      {
        question: 'Qu\'est-ce que le mode inventaire rapide ?',
        answer: 'Un mode optimisé pour le comptage physique permettant de scanner en série et mettre à jour rapidement les quantités de stock.'
      },
      {
        question: 'Comment voir l\'historique des mouvements ?',
        answer: 'Allez dans l\'onglet "Historique". Vous pouvez filtrer par période, type de mouvement, produit ou catégorie, et exporter en Excel/PDF.'
      }
    ]
  },
  {
    id: 'users',
    icon: Users,
    title: 'Gestion des Utilisateurs',
    badge: 'Admin',
    content: [
      {
        question: 'Comment approuver un nouveau vendeur ?',
        answer: 'Accédez à "Utilisateurs", trouvez le compte en attente et cliquez sur "Activer". Le vendeur pourra alors se connecter.'
      },
      {
        question: 'Comment limiter l\'accès d\'un vendeur à certaines catégories ?',
        answer: 'Dans la fiche utilisateur, utilisez l\'option "Restrictions catégories" pour définir les catégories autorisées.'
      },
      {
        question: 'Comment promouvoir un utilisateur en admin ?',
        answer: 'Cliquez sur le bouton "Promouvoir Admin" dans la fiche utilisateur. Cette action est irréversible via l\'interface.'
      }
    ]
  },
  {
    id: 'reports',
    icon: FileText,
    title: 'Rapports',
    badge: 'Admin',
    content: [
      {
        question: 'Quels types de rapports sont disponibles ?',
        answer: 'Performance Vendeurs (classement par revenus/ventes), Rapports Avancés (statistiques détaillées, méthodes de paiement, top produits), et Rapport TVA (HT, TVA, TTC par devise).'
      },
      {
        question: 'Comment exporter un rapport TVA ?',
        answer: 'Filtrez par dates, puis cliquez sur "Exporter PDF" pour obtenir un document professionnel avec l\'en-tête de votre entreprise.'
      },
      {
        question: 'Comment voir les performances des vendeurs ?',
        answer: 'Accédez à "Perf. Vendeurs" dans le menu pour voir les classements, graphiques comparatifs et filtrer par période.'
      }
    ]
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Paramètres',
    badge: 'Admin',
    content: [
      {
        question: 'Où configurer les informations de l\'entreprise ?',
        answer: 'Dans "Paramètres", vous pouvez modifier le logo, nom, description, adresse, téléphone, email. Ces informations apparaissent sur tous les PDF générés.'
      },
      {
        question: 'Comment changer le taux de change USD/HTG ?',
        answer: 'Dans la section "Devises" des paramètres, modifiez le taux. Ce taux est utilisé pour toutes les conversions dans l\'application.'
      },
      {
        question: 'Comment modifier le taux de TVA ?',
        answer: 'Dans la section "Paiement & TVA", entrez le nouveau pourcentage. Ce taux s\'applique à toutes les nouvelles ventes.'
      }
    ]
  },
  {
    id: 'currencies',
    icon: DollarSign,
    title: 'Multi-Devises',
    badge: 'Fonctionnalité',
    content: [
      {
        question: 'Comment fonctionne le multi-devises ?',
        answer: 'Chaque produit peut être tarifé en USD ou HTG. Lors d\'une vente mixte, les montants sont automatiquement convertis vers la devise d\'affichage par défaut (configurable dans les paramètres).'
      },
      {
        question: 'Que signifient les badges USD/HTG ?',
        answer: 'Le badge vert indique USD, le bleu indique HTG. Ils apparaissent partout où une devise est associée (ventes, logs, rapports).'
      },
      {
        question: 'Comment le total unifié est-il calculé ?',
        answer: 'Le système additionne les sous-totaux par devise, applique le taux de conversion configuré, puis calcule la remise, la TVA et le total TTC dans la devise d\'affichage.'
      }
    ]
  },
  {
    id: 'shortcuts',
    icon: Keyboard,
    title: 'Raccourcis Clavier',
    badge: 'Vendeur',
    content: [
      {
        question: 'Quels raccourcis sont disponibles dans l\'interface de vente ?',
        answer: 'Ctrl+L: Basculer vue Liste/Cartes, Ctrl+P: Aller au panier, Escape: Retour étape précédente, Ctrl+N: Nouvelle vente (après confirmation), Ctrl+?: Afficher l\'aide.'
      },
      {
        question: 'Le scan code-barres fonctionne-t-il automatiquement ?',
        answer: 'Oui, si un scanner USB/Bluetooth est connecté, le produit scanné est automatiquement détecté et ajouté au panier.'
      }
    ]
  }
];

const HelpPage = () => {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const role = (profile as any)?.role === 'admin' ? 'admin' : 'seller';

  const filteredSections = helpSections.filter(section => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (section.title.toLowerCase().includes(query)) return true;
    return section.content.some(
      item => 
        item.question.toLowerCase().includes(query) || 
        item.answer.toLowerCase().includes(query)
    );
  });

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await generateUserGuidePDF();
      toast({
        title: "Guide exporté",
        description: "Le guide utilisateur a été téléchargé en PDF"
      });
    } catch (error) {
      console.error('Error exporting guide:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'exporter le guide",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <ResponsiveDashboardLayout 
      title="Aide" 
      role={role} 
      currentSection="help"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold">Centre d'Aide</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Guide d'utilisation interactif
              </p>
            </div>
          </div>
          <Button 
            onClick={handleExportPDF} 
            disabled={exporting}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Export...' : 'Télécharger PDF'}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans l'aide..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold">{helpSections.length}</p>
                <p className="text-xs text-muted-foreground">Sections</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold">
                  {helpSections.reduce((acc, s) => acc + s.content.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Questions</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold">
                  {helpSections.filter(s => s.badge === 'Admin').length}
                </p>
                <p className="text-xs text-muted-foreground">Sections Admin</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-lg font-bold">
                  {helpSections.filter(s => s.badge === 'Vendeur' || s.badge === 'Admin/Vendeur').length}
                </p>
                <p className="text-xs text-muted-foreground">Sections Vendeur</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Help Sections */}
        <ScrollArea className="h-[calc(100vh-350px)]">
          <div className="space-y-4 pr-4">
            {filteredSections.length === 0 ? (
              <Card className="p-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun résultat trouvé pour "{searchQuery}"</p>
              </Card>
            ) : (
              filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <Card key={section.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base sm:text-lg">{section.title}</CardTitle>
                        </div>
                        <Badge 
                          variant={
                            section.badge === 'Admin' ? 'default' : 
                            section.badge === 'Vendeur' ? 'secondary' : 
                            'outline'
                          }
                          className="text-xs"
                        >
                          {section.badge}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {section.content.map((item, index) => (
                          <AccordionItem key={index} value={`${section.id}-${index}`}>
                            <AccordionTrigger className="text-left text-sm hover:no-underline">
                              {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground">
                              {item.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </ResponsiveDashboardLayout>
  );
};

export default HelpPage;
