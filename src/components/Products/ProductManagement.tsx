import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Plus, Edit, Trash2, AlertCircle, Search, Filter, LayoutGrid, List, Download, FileText, DollarSign, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCategories, useSousCategories, useSpecificationsModeles } from '@/hooks/useCategories';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  unit: string;
  price: number;
  purchase_price?: number;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
  sale_type: 'retail' | 'wholesale';
  currency: 'USD' | 'HTG';
  description?: string;
  created_at: string;
  // Ceramic-specific fields
  dimension?: string;
  surface_par_boite?: number;
  prix_m2?: number;
  stock_boite?: number;
  // Iron bar-specific fields
  diametre?: string;
  longueur_barre?: number;
  longueur_barre_ft?: number;
  bars_per_ton?: number;
  prix_par_metre?: number;
  prix_par_barre?: number;
  stock_barre?: number;
  decimal_autorise?: boolean;
  // Energy-specific fields
  puissance?: number;
  voltage?: number;
  capacite?: number;
  type_energie?: string;
  specifications_techniques?: any;
  // Blocs-specific fields
  bloc_type?: string;
  bloc_poids?: number;
  // Vêtements-specific fields
  vetement_taille?: string;
  vetement_genre?: string;
  vetement_couleur?: string;
  // Électroménager-specific fields
  electromenager_sous_categorie?: string;
  electromenager_marque?: string;
  electromenager_modele?: string;
  electromenager_garantie_mois?: number;
  electromenager_niveau_sonore_db?: number;
  electromenager_classe_energie?: string;
  electromenager_couleur?: string;
  electromenager_materiau?: string;
  electromenager_installation?: string;
}

type ProductCategory = 'alimentaires' | 'boissons' | 'gazeuses' | 'electronique' | 'autres' | 'ceramique' | 'fer' | 'materiaux_de_construction' | 'energie' | 'blocs' | 'vetements' | 'electromenager';

export const ProductManagement = () => {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const isMobile = useIsMobile();
  const { categories: dynamicCategories } = useCategories();
  const { sousCategories: allSousCategories } = useSousCategories();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sousCategoryFilter, setSousCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(isMobile ? 'cards' : 'table');
  const [deleteDialog, setDeleteDialog] = useState<{open: boolean, productId: string | null, productName: string}>({
    open: false, 
    productId: null,
    productName: ''
  });
  
  // Auto-switch to cards on mobile
  useEffect(() => {
    if (isMobile) setViewMode('cards');
  }, [isMobile]);
  // Form state for dynamic category selection
  const [selectedCategorieId, setSelectedCategorieId] = useState<string>('');
  const [selectedSousCategorieId, setSelectedSousCategorieId] = useState<string>('');
  const [dynamicSpecs, setDynamicSpecs] = useState<Record<string, any>>({});
  
  // Get specifications for the selected sous-categorie
  const { specifications: specModeles } = useSpecificationsModeles(selectedSousCategorieId || undefined);
  
  // Filter sous-categories based on selected category
  const filteredSousCategories = useMemo(() => {
    if (!selectedCategorieId) return [];
    return allSousCategories.filter(sc => sc.categorie_id === selectedCategorieId);
  }, [selectedCategorieId, allSousCategories]);
  
  // Filter sous-categories for the filter dropdown
  const filterSousCategories = useMemo(() => {
    if (categoryFilter === 'all') return allSousCategories;
    return allSousCategories.filter(sc => sc.categorie_id === categoryFilter);
  }, [categoryFilter, allSousCategories]);
  
  // Reset sous-category filter when category changes
  useEffect(() => {
    setSousCategoryFilter('all');
  }, [categoryFilter]);
  
  // Reset form sous-category when form category changes
  useEffect(() => {
    setSelectedSousCategorieId('');
    setDynamicSpecs({});
  }, [selectedCategorieId]);
  
  const [formData, setFormData] = useState<{
    name: string;
    barcode: string;
    category: ProductCategory;
    unit: string;
    price: string;
    purchase_price: string;
    quantity: string;
    alert_threshold: string;
    description: string;
    is_active: boolean;
    sale_type: 'retail' | 'wholesale';
    dimension: string;
    surface_par_boite: string;
    prix_m2: string;
    prix_achat_m2: string;
    stock_boite: string;
    diametre: string;
    longueur_barre_ft: string;
    bars_per_ton: string;
    prix_par_metre: string;
    prix_par_barre: string;
    stock_barre: string;
    decimal_autorise: boolean;
    puissance: string;
    voltage: string;
    capacite: string;
    type_energie: string;
    bloc_type: string;
    bloc_poids: string;
    vetement_taille: string;
    vetement_genre: string;
    vetement_couleur: string;
    electromenager_sous_categorie: string;
    electromenager_marque: string;
    electromenager_modele: string;
    electromenager_garantie_mois: string;
    electromenager_niveau_sonore_db: string;
    electromenager_classe_energie: string;
    electromenager_couleur: string;
    electromenager_materiau: string;
    electromenager_installation: string;
    currency: 'USD' | 'HTG';
  }>({
    name: '',
    barcode: '',
    category: 'alimentaires',
    unit: 'unité',
    price: '',
    purchase_price: '',
    quantity: '',
    alert_threshold: '10',
    description: '',
    is_active: true,
    sale_type: 'retail',
    dimension: '',
    surface_par_boite: '',
    prix_m2: '',
    prix_achat_m2: '',
    stock_boite: '',
    diametre: '',
    longueur_barre_ft: '',
    bars_per_ton: '',
    prix_par_metre: '',
    prix_par_barre: '',
    stock_barre: '',
    decimal_autorise: true,
    puissance: '',
    voltage: '',
    capacite: '',
    type_energie: '',
    bloc_type: '',
    bloc_poids: '',
    vetement_taille: '',
    vetement_genre: '',
    vetement_couleur: '',
    // Électroménager fields
    electromenager_sous_categorie: '',
    electromenager_marque: '',
    electromenager_modele: '',
    electromenager_garantie_mois: '',
    electromenager_niveau_sonore_db: '',
    electromenager_classe_energie: '',
    electromenager_couleur: '',
    electromenager_materiau: '',
    electromenager_installation: '',
    currency: 'HTG' as const
  });

  // Fonction pour afficher le stock selon la catégorie du produit
  const getStockDisplay = (product: Product) => {
    // Arrondi à 2 décimales pour éviter les erreurs de virgule flottante
    const round2 = (val: number) => Math.round(val * 100) / 100;
    
    // Céramique: utiliser stock_boite si défini et > 0
    if (product.category === 'ceramique' && product.stock_boite !== null && product.stock_boite !== undefined && product.stock_boite > 0 && product.surface_par_boite) {
      const m2 = round2(product.stock_boite * product.surface_par_boite);
      return { value: m2.toFixed(2), unit: 'm²', raw: product.stock_boite };
    }
    // Fer: utiliser stock_barre si défini et > 0
    if (product.category === 'fer' && product.stock_barre !== null && product.stock_barre !== undefined && product.stock_barre > 0) {
      return { value: product.stock_barre.toString(), unit: 'barres', raw: product.stock_barre };
    }
    // Par défaut: utiliser quantity
    return { value: product.quantity.toString(), unit: product.unit || 'unités', raw: product.quantity };
  };

  const categories = [
    { value: 'alimentaires', label: 'Alimentaires' },
    { value: 'boissons', label: 'Boissons' },
    { value: 'gazeuses', label: 'Gazeuses' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'ceramique', label: 'Céramique' },
    { value: 'fer', label: 'Fer / Acier' },
    { value: 'materiaux_de_construction', label: 'Matériaux de construction' },
    { value: 'energie', label: 'Énergie' },
    { value: 'blocs', label: 'Blocs' },
    { value: 'vetements', label: 'Vêtements' },
    { value: 'electromenager', label: 'Électroménager' },
    { value: 'autres', label: 'Autres' }
  ];

  useEffect(() => {
    fetchProducts();
    
    // Écouter les changements en temps réel sur la table products
    const channel = supabase
      .channel('products-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('🔄 Product change detected:', payload);
          fetchProducts();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Dynamic category filter
      const matchesCategory = categoryFilter === 'all' || 
        (product as any).categorie_id === categoryFilter ||
        product.category === categoryFilter;
      
      // Dynamic sous-category filter  
      const matchesSousCategory = sousCategoryFilter === 'all' || 
        (product as any).sous_categorie_id === sousCategoryFilter;
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active);
      
      // Currency filter
      const matchesCurrency = currencyFilter === 'all' || product.currency === currencyFilter;
      
      return matchesSearch && matchesCategory && matchesSousCategory && matchesStatus && matchesCurrency;
    });
    setFilteredProducts(filtered);
    resetPage();
  }, [searchTerm, categoryFilter, sousCategoryFilter, statusFilter, currencyFilter, products]);

  const { 
    paginatedItems: paginatedProducts, 
    currentPage, 
    totalPages, 
    totalItems, 
    pageSize, 
    nextPage, 
    prevPage, 
    hasNextPage, 
    hasPrevPage,
    resetPage
  } = usePagination(filteredProducts, 20);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Cast currency to expected type (database returns string)
      setProducts((data || []).map(p => ({
        ...p,
        currency: (p.currency === 'USD' ? 'USD' : 'HTG') as 'USD' | 'HTG'
      })));
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredProducts.map(p => {
      const stock = getStockDisplay(p);
      return {
        'Nom': p.name,
        'Code-barres': p.barcode || '-',
        'Catégorie': categories.find(c => c.value === p.category)?.label || p.category,
        'Prix': p.price,
        'Devise': p.currency,
        'Stock': `${stock.value} ${stock.unit}`,
        'Seuil alerte': p.alert_threshold,
        'Statut': p.is_active ? 'Actif' : 'Inactif',
        'Type vente': p.sale_type === 'retail' ? 'Détail' : 'Gros'
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produits');
    XLSX.writeFile(wb, `produits_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: "Export réussi", description: `${filteredProducts.length} produits exportés en Excel` });
  };

  // Export to PDF
  const exportToPDF = async () => {
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Liste des Produits', pageWidth / 2, 15, { align: 'center' });
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} - ${filteredProducts.length} produits`, pageWidth / 2, 22, { align: 'center' });
    
    // Table headers
    const headers = ['Nom', 'Catégorie', 'Prix', 'Devise', 'Stock', 'Statut'];
    const colWidths = [80, 50, 35, 25, 40, 25];
    let y = 35;
    let x = 15;
    
    pdf.setFillColor(240, 240, 240);
    pdf.rect(x, y - 5, pageWidth - 30, 8, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    headers.forEach((h, i) => {
      pdf.text(h, x, y);
      x += colWidths[i];
    });
    
    // Table rows
    y += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    
    filteredProducts.forEach((p, idx) => {
      if (y > 190) {
        pdf.addPage();
        y = 20;
      }
      
      const stock = getStockDisplay(p);
      x = 15;
      
      if (idx % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(x, y - 4, pageWidth - 30, 6, 'F');
      }
      
      const row = [
        p.name.substring(0, 35),
        (categories.find(c => c.value === p.category)?.label || p.category).substring(0, 20),
        p.price.toFixed(2),
        p.currency,
        `${stock.value} ${stock.unit}`,
        p.is_active ? 'Actif' : 'Inactif'
      ];
      
      row.forEach((cell, i) => {
        pdf.text(cell.toString(), x, y);
        x += colWidths[i];
      });
      y += 6;
    });
    
    pdf.save(`produits_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: "Export réussi", description: `${filteredProducts.length} produits exportés en PDF` });
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setSousCategoryFilter('all');
    setStatusFilter('all');
    setCurrencyFilter('all');
    toast({ title: "Filtres réinitialisés" });
  };

  // Check if any filter is active
  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'all' || sousCategoryFilter !== 'all' || statusFilter !== 'all' || currencyFilter !== 'all';

  const resetForm = () => {
    setFormData({
      name: '',
      barcode: '',
      category: 'alimentaires' as const,
      unit: 'unité',
      price: '',
      purchase_price: '',
      quantity: '',
      alert_threshold: '10',
      description: '',
      is_active: true,
      sale_type: 'retail',
      dimension: '',
      surface_par_boite: '',
      prix_m2: '',
      prix_achat_m2: '',
      stock_boite: '',
      diametre: '',
      longueur_barre_ft: '',
      bars_per_ton: '',
      prix_par_metre: '',
      prix_par_barre: '',
      stock_barre: '',
      decimal_autorise: true,
      puissance: '',
      voltage: '',
      capacite: '',
      type_energie: '',
      bloc_type: '',
      bloc_poids: '',
      vetement_taille: '',
      vetement_genre: '',
      vetement_couleur: '',
      electromenager_sous_categorie: '',
      electromenager_marque: '',
      electromenager_modele: '',
      electromenager_garantie_mois: '',
      electromenager_niveau_sonore_db: '',
      electromenager_classe_energie: '',
      electromenager_couleur: '',
      electromenager_materiau: '',
      electromenager_installation: '',
      currency: 'HTG'
    });
    setEditingProduct(null);
    // Reset dynamic fields
    setSelectedCategorieId('');
    setSelectedSousCategorieId('');
    setDynamicSpecs({});
  };

  const handleEdit = (product: Product) => {
    if (!isAdmin) {
      toast({
        title: "Action non autorisée",
        description: "Seuls les administrateurs peuvent modifier les produits",
        variant: "destructive"
      });
      return;
    }
    
    setEditingProduct(product);
    // Set dynamic category fields
    setSelectedCategorieId((product as any).categorie_id || '');
    setSelectedSousCategorieId((product as any).sous_categorie_id || '');
    setDynamicSpecs(product.specifications_techniques || {});
    
    setFormData({
      name: product.name,
      barcode: product.barcode || '',
      category: product.category as ProductCategory,
      unit: product.unit || 'unité',
      price: product.price.toString(),
      purchase_price: product.purchase_price?.toString() || '',
      quantity: product.quantity.toString(),
      alert_threshold: product.alert_threshold.toString(),
      description: product.description || '',
      is_active: product.is_active,
      sale_type: product.sale_type,
      dimension: product.dimension || '',
      surface_par_boite: product.surface_par_boite?.toString() || '',
      prix_m2: product.prix_m2?.toString() || '',
      prix_achat_m2: product.purchase_price?.toString() || '',
      stock_boite: product.stock_boite?.toString() || '',
      diametre: product.diametre || '',
      longueur_barre_ft: product.longueur_barre_ft?.toString() || '',
      bars_per_ton: product.bars_per_ton?.toString() || '',
      prix_par_metre: product.prix_par_metre?.toString() || '',
      prix_par_barre: product.prix_par_barre?.toString() || '',
      stock_barre: product.stock_barre?.toString() || '',
      decimal_autorise: product.decimal_autorise !== false,
      puissance: product.puissance?.toString() || '',
      voltage: product.voltage?.toString() || '',
      capacite: product.capacite?.toString() || '',
      type_energie: product.type_energie || '',
      bloc_type: product.bloc_type || '',
      bloc_poids: product.bloc_poids?.toString() || '',
      vetement_taille: product.vetement_taille || '',
      vetement_genre: product.vetement_genre || '',
      vetement_couleur: product.vetement_couleur || '',
      electromenager_sous_categorie: product.electromenager_sous_categorie || '',
      electromenager_marque: product.electromenager_marque || '',
      electromenager_modele: product.electromenager_modele || '',
      electromenager_garantie_mois: product.electromenager_garantie_mois?.toString() || '',
      electromenager_niveau_sonore_db: product.electromenager_niveau_sonore_db?.toString() || '',
      electromenager_classe_energie: product.electromenager_classe_energie || '',
      electromenager_couleur: product.electromenager_couleur || '',
      electromenager_materiau: product.electromenager_materiau || '',
      electromenager_installation: product.electromenager_installation || '',
      currency: product.currency || 'HTG'
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    if (!isAdmin) {
      toast({
        title: "Action non autorisée",
        description: "Seuls les administrateurs peuvent gérer les produits",
        variant: "destructive"
      });
      return;
    }

    // Validation for ceramic products
    if (formData.category === 'ceramique') {
      if (!formData.dimension || !formData.surface_par_boite || !formData.prix_m2 || !formData.prix_achat_m2 || !formData.stock_boite) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir tous les champs obligatoires pour la céramique (incluant prix d'achat)",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for iron products
    if (formData.category === 'fer') {
      if (!formData.diametre || !formData.longueur_barre_ft || !formData.bars_per_ton || !formData.prix_par_barre || !formData.stock_barre) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir tous les champs obligatoires pour le fer",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for blocs
    if (formData.category === 'blocs') {
      if (!formData.bloc_type) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez sélectionner le type de bloc",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for vetements
    if (formData.category === 'vetements') {
      if (!formData.vetement_taille || !formData.vetement_genre || !formData.vetement_couleur) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir tous les champs obligatoires pour les vêtements",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for energie
    if (formData.category === 'energie') {
      if (!formData.puissance && !formData.voltage && !formData.capacite) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir au moins un champ technique (puissance, voltage ou capacité) pour les produits d'énergie",
          variant: "destructive"
        });
        return;
      }
    }

    // Validation for standard products
    if (formData.category !== 'ceramique' && formData.category !== 'fer') {
      if (!formData.price || !formData.quantity) {
        toast({
          title: "Erreur de validation",
          description: "Veuillez remplir le prix et la quantité",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      const productData: any = {
        name: formData.name,
        barcode: formData.barcode || null,
        category: formData.category,
        unit: formData.unit,
        alert_threshold: parseInt(formData.alert_threshold),
        description: formData.description || null,
        is_active: formData.is_active,
        sale_type: formData.sale_type,
        created_by: user.id,
        decimal_autorise: formData.decimal_autorise,
        puissance: formData.puissance ? parseFloat(formData.puissance) : null,
        voltage: formData.voltage ? parseFloat(formData.voltage) : null,
        capacite: formData.capacite ? parseFloat(formData.capacite) : null,
        type_energie: formData.type_energie || null,
        bloc_type: formData.bloc_type || null,
        bloc_poids: formData.bloc_poids ? parseFloat(formData.bloc_poids) : null,
        vetement_taille: formData.vetement_taille || null,
        vetement_genre: formData.vetement_genre || null,
        vetement_couleur: formData.vetement_couleur || null,
        electromenager_sous_categorie: formData.electromenager_sous_categorie || null,
        electromenager_marque: formData.electromenager_marque || null,
        electromenager_modele: formData.electromenager_modele || null,
        electromenager_garantie_mois: formData.electromenager_garantie_mois ? parseInt(formData.electromenager_garantie_mois) : null,
        electromenager_niveau_sonore_db: formData.electromenager_niveau_sonore_db ? parseFloat(formData.electromenager_niveau_sonore_db) : null,
        electromenager_classe_energie: formData.electromenager_classe_energie || null,
        electromenager_couleur: formData.electromenager_couleur || null,
        electromenager_materiau: formData.electromenager_materiau || null,
        electromenager_installation: formData.electromenager_installation || null,
        currency: formData.currency,
        // New dynamic category fields
        categorie_id: selectedCategorieId || null,
        sous_categorie_id: selectedSousCategorieId || null,
        // Dynamic specifications stored as JSONB
        specifications_techniques: Object.keys(dynamicSpecs).length > 0 ? dynamicSpecs : null
      };

      // Map values based on category
      if (formData.category === 'ceramique') {
        // Use ceramic-specific values
        productData.price = parseFloat(formData.prix_m2);
        productData.purchase_price = parseFloat(formData.prix_achat_m2);
        productData.quantity = parseFloat(formData.stock_boite);
        productData.dimension = formData.dimension;
        productData.surface_par_boite = parseFloat(formData.surface_par_boite);
        productData.prix_m2 = parseFloat(formData.prix_m2);
        productData.stock_boite = parseFloat(formData.stock_boite);
      } else if (formData.category === 'fer') {
        // Use iron bar-specific values
        productData.price = parseFloat(formData.prix_par_barre);
        productData.purchase_price = formData.purchase_price ? parseFloat(formData.purchase_price) : parseFloat(formData.prix_par_barre) * 0.7;
        productData.quantity = parseFloat(formData.stock_barre);
        productData.diametre = formData.diametre;
        productData.longueur_barre_ft = parseFloat(formData.longueur_barre_ft);
        productData.bars_per_ton = parseFloat(formData.bars_per_ton);
        productData.prix_par_metre = formData.prix_par_metre ? parseFloat(formData.prix_par_metre) : null;
        productData.prix_par_barre = parseFloat(formData.prix_par_barre);
        productData.stock_barre = parseFloat(formData.stock_barre);
      } else {
        // Use standard values
        productData.price = parseFloat(formData.price);
        productData.purchase_price = formData.purchase_price ? parseFloat(formData.purchase_price) : null;
        productData.quantity = parseFloat(formData.quantity);
      }

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;

        toast({
          title: "Produit mis à jour",
          description: "Le produit a été modifié avec succès"
        });

        // Log the activity
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          action_type: 'product_updated',
          entity_type: 'product',
          entity_id: editingProduct.id,
          description: `Produit "${formData.name}" modifié dans la catégorie ${formData.category}`,
          metadata: {
            product_name: formData.name,
            category: formData.category,
            price: productData.price
          }
        });
      } else {
        // Create new product
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Produit créé",
          description: "Le produit a été ajouté avec succès"
        });

        // Log the activity
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          action_type: 'product_added',
          entity_type: 'product',
          entity_id: newProduct.id,
          description: `Nouveau produit "${formData.name}" ajouté dans la catégorie ${formData.category}`,
          metadata: {
            product_name: formData.name,
            category: formData.category,
            price: productData.price
          }
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      
      // Check for RLS policy violation
      if (error?.message?.includes('row-level security') || error?.message?.includes('policy')) {
        toast({
          title: "Action réservée aux administrateurs",
          description: "Seuls les administrateurs peuvent gérer les produits",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder le produit",
          variant: "destructive"
        });
      }
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (!isAdmin) {
      toast({
        title: "Action non autorisée",
        description: "Seuls les administrateurs peuvent supprimer les produits",
        variant: "destructive"
      });
      return;
    }
    
    setDeleteDialog({ open: true, productId: id, productName: name });
  };

  const handleDelete = async () => {
    if (!deleteDialog.productId || !user) return;

    try {
      const productId = deleteDialog.productId;
      const productName = deleteDialog.productName;

      // Check if product is used in any sales
      const { count, error: countError } = await supabase
        .from('sale_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId);

      if (countError) throw countError;

      if (count && count > 0) {
        // Product is used in sales - deactivate instead
        const { error } = await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', productId);

        if (error) throw error;

        toast({
          title: "Produit désactivé",
          description: `Ce produit est utilisé dans ${count} vente(s). Il a été désactivé au lieu d'être supprimé.`,
        });

        // Log deactivation
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          action_type: 'product_deactivated',
          entity_type: 'product',
          entity_id: productId,
          description: `Produit "${productName}" désactivé (utilisé dans des ventes)`,
          metadata: { product_name: productName, reason: 'used_in_sales', sales_count: count }
        });
      } else {
        // Product not used - delete permanently
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);

        if (error) throw error;

        toast({
          title: "Produit supprimé",
          description: "Le produit a été définitivement supprimé"
        });

        // Log deletion
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          action_type: 'product_deleted',
          entity_type: 'product',
          entity_id: productId,
          description: `Produit "${productName}" supprimé définitivement`,
          metadata: { product_name: productName }
        });
      }

      setDeleteDialog({ open: false, productId: null, productName: '' });
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      
      
      if (error?.message?.includes('row-level security') || error?.message?.includes('policy')) {
        toast({
          title: "Action réservée aux administrateurs",
          description: "Seuls les administrateurs peuvent supprimer les produits",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le produit",
          variant: "destructive"
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        {!isAdmin && (
          <div className="mb-4 p-3 bg-muted border border-border rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Seuls les administrateurs peuvent ajouter, modifier ou supprimer des produits.
            </p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            <span className="hidden sm:inline">Gestion des Produits</span>
            <span className="sm:hidden">Produits</span>
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button 
                className="gap-2 w-full sm:w-auto" 
                disabled={!isAdmin}
                title={!isAdmin ? "Réservé aux administrateurs" : "Ajouter un nouveau produit"}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nouveau produit</span>
                <span className="sm:hidden">Nouveau</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du produit *</Label>
                    <Input
                      id="name"
                      required
                      autoFocus
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Nom du produit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Code-barres</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      placeholder="Scanner ou saisir le code-barres"
                    />
                  </div>
                  {/* Dynamic Category Selection */}
                  <div className="space-y-2">
                    <Label>Catégorie dynamique *</Label>
                    <Select
                      value={selectedCategorieId}
                      onValueChange={(value) => {
                        setSelectedCategorieId(value);
                        // Find subcategory to set stock_type based unit
                        const cat = dynamicCategories.find(c => c.id === value);
                        if (cat) {
                          // Also update old category field for compatibility
                          setFormData(prev => ({...prev, category: cat.slug as ProductCategory}));
                        }
                      }}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150] bg-popover">
                        {dynamicCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Dynamic Sous-Category Selection */}
                  <div className="space-y-2">
                    <Label>Sous-catégorie *</Label>
                    <Select
                      value={selectedSousCategorieId}
                      onValueChange={(value) => {
                        setSelectedSousCategorieId(value);
                        const sc = filteredSousCategories.find(s => s.id === value);
                        if (sc) {
                          // Auto-set unit based on stock_type
                          let newUnit = formData.unit;
                          if (sc.stock_type === 'boite_m2') newUnit = 'm²';
                          else if (sc.stock_type === 'barre_metre') newUnit = 'barre';
                          else newUnit = 'unité';
                          setFormData(prev => ({...prev, unit: newUnit}));
                        }
                      }}
                      disabled={!selectedCategorieId}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue placeholder={selectedCategorieId ? "Sélectionner une sous-catégorie" : "Choisir d'abord une catégorie"} />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150] bg-popover">
                        {filteredSousCategories.map(sc => (
                          <SelectItem key={sc.id} value={sc.id}>{sc.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSousCategorieId && filteredSousCategories.find(sc => sc.id === selectedSousCategorieId)?.stock_type && (
                      <p className="text-xs text-muted-foreground">
                        Type de stock: {
                          filteredSousCategories.find(sc => sc.id === selectedSousCategorieId)?.stock_type === 'boite_m2' ? 'Boîtes / m²' :
                          filteredSousCategories.find(sc => sc.id === selectedSousCategorieId)?.stock_type === 'barre_metre' ? 'Barres / mètres' :
                          'Quantité simple'
                        }
                      </p>
                    )}
                  </div>

                  {/* Legacy Category Selection (hidden but kept for compatibility) */}
                  <div className="space-y-2">
                    <Label htmlFor="category">Catégorie (legacy) *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: ProductCategory) => {
                        let newUnit = formData.unit;
                        if (value === 'ceramique') newUnit = 'm²';
                        else if (value === 'fer') newUnit = 'barre';
                        else if (formData.category === 'ceramique' || formData.category === 'fer') newUnit = 'unité';
                        
                        setFormData({...formData, category: value, unit: newUnit});
                      }}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150] bg-popover">
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dynamic Specifications from specifications_modeles */}
                  {specModeles.length > 0 && (
                    <div className="col-span-1 sm:col-span-2 p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-semibold text-sm mb-3">📋 Spécifications dynamiques</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {specModeles.map(spec => (
                          <div key={spec.id} className="space-y-1">
                            <Label className="text-sm">
                              {spec.label} {spec.obligatoire && <span className="text-destructive">*</span>}
                              {spec.unite && <span className="text-muted-foreground text-xs ml-1">({spec.unite})</span>}
                            </Label>
                            {spec.type_champ === 'text' && (
                              <Input
                                value={dynamicSpecs[spec.nom_champ] || ''}
                                onChange={(e) => setDynamicSpecs(prev => ({...prev, [spec.nom_champ]: e.target.value}))}
                                placeholder={spec.label}
                                required={spec.obligatoire}
                              />
                            )}
                            {spec.type_champ === 'number' && (
                              <Input
                                type="number"
                                step="0.01"
                                value={dynamicSpecs[spec.nom_champ] || ''}
                                onChange={(e) => setDynamicSpecs(prev => ({...prev, [spec.nom_champ]: e.target.value}))}
                                placeholder={spec.label}
                                required={spec.obligatoire}
                              />
                            )}
                            {spec.type_champ === 'select' && spec.options && (
                              <Select
                                value={dynamicSpecs[spec.nom_champ] || ''}
                                onValueChange={(value) => setDynamicSpecs(prev => ({...prev, [spec.nom_champ]: value}))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Sélectionner ${spec.label.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent className="z-[200] bg-popover">
                                  {spec.options.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {spec.type_champ === 'boolean' && (
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={dynamicSpecs[spec.nom_champ] || false}
                                  onCheckedChange={(checked) => setDynamicSpecs(prev => ({...prev, [spec.nom_champ]: checked}))}
                                />
                                <span className="text-sm text-muted-foreground">{dynamicSpecs[spec.nom_champ] ? 'Oui' : 'Non'}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info badge based on category */}
                  {formData.category === 'ceramique' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        🏺 Céramique : Le prix et le stock seront basés sur les m² et les boîtes
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'fer' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        🔩 Fer : Le prix par barre sera calculé automatiquement (prix/m × longueur)
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'energie' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        ⚡ Énergie : Ajoutez les spécifications techniques (puissance, voltage, capacité, etc.)
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'blocs' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        🧱 Blocs : Précisez le type de bloc et son poids (optionnel)
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'vetements' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        👕 Vêtements : Précisez la taille, le genre et la couleur
                      </Badge>
                    </div>
                  )}
                  {formData.category === 'electromenager' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        🔌 Électroménager : Ajoutez les spécifications techniques, la marque et la garantie
                      </Badge>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="unit">Unité de mesure *</Label>
                    <Input
                      id="unit"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      placeholder="Ex: m², barre, sac, livre..."
                      disabled={formData.category === 'ceramique' || formData.category === 'fer'}
                      className={formData.category === 'ceramique' || formData.category === 'fer' ? 'bg-muted' : ''}
                    />
                  </div>

                  {/* Show these fields only for non-ceramic and non-iron products */}
                  {formData.category !== 'ceramique' && formData.category !== 'fer' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="price">Prix de vente ({formData.currency}) *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          placeholder={formData.currency === 'USD' ? '$0.00' : '0.00 HTG'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="purchase_price">Prix d'achat ({formData.currency})</Label>
                        <Input
                          id="purchase_price"
                          type="number"
                          step="0.01"
                          value={formData.purchase_price}
                          onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                          placeholder={formData.currency === 'USD' ? '$0.00' : '0.00 HTG'}
                        />
                        <p className="text-xs text-muted-foreground">Coût payé par le magasin (optionnel)</p>
                        {formData.purchase_price && formData.price && (
                          <p className="text-xs font-medium text-success">
                            Bénéfice: {formData.currency === 'USD' ? '$' : ''}{(parseFloat(formData.price) - parseFloat(formData.purchase_price)).toFixed(2)}{formData.currency === 'HTG' ? ' HTG' : ''}
                            ({(((parseFloat(formData.price) - parseFloat(formData.purchase_price)) / parseFloat(formData.price)) * 100).toFixed(1)}%)
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantité *</Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.01"
                          required
                          value={formData.quantity}
                          onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                          placeholder="0"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="alert_threshold">Seuil d'alerte *</Label>
                    <Input
                      id="alert_threshold"
                      type="number"
                      required
                      value={formData.alert_threshold}
                      onChange={(e) => setFormData({...formData, alert_threshold: e.target.value})}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="is_active">Statut</Label>
                    <Select
                      value={formData.is_active ? 'true' : 'false'}
                      onValueChange={(value) => setFormData({...formData, is_active: value === 'true'})}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150]">
                        <SelectItem value="true">Actif</SelectItem>
                        <SelectItem value="false">Inactif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale_type">Type de vente *</Label>
                    <Select
                      value={formData.sale_type}
                      onValueChange={(value: 'retail' | 'wholesale') => setFormData({...formData, sale_type: value})}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150]">
                        <SelectItem value="retail">Détail</SelectItem>
                        <SelectItem value="wholesale">Gros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Devise *</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value: 'USD' | 'HTG') => setFormData({...formData, currency: value})}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150]">
                        <SelectItem value="HTG">HTG (Gourdes)</SelectItem>
                        <SelectItem value="USD">USD (Dollars US)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Ceramic-specific fields */}
                {formData.category === 'ceramique' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🏺 Configuration Céramique</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dimension">Dimension *</Label>
                      <Input
                        id="dimension"
                        required
                        value={formData.dimension}
                        onChange={(e) => setFormData({...formData, dimension: e.target.value})}
                        placeholder="Ex: 60x60, 40x40"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surface_par_boite">Surface par boîte (m²) *</Label>
                      <Input
                        id="surface_par_boite"
                        type="number"
                        step="0.01"
                        required
                        value={formData.surface_par_boite}
                        onChange={(e) => setFormData({...formData, surface_par_boite: e.target.value})}
                        placeholder="1.44"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_m2">Prix de vente par m² ({formData.currency}) *</Label>
                      <Input
                        id="prix_m2"
                        type="number"
                        step="0.01"
                        required
                        value={formData.prix_m2}
                        onChange={(e) => setFormData({...formData, prix_m2: e.target.value})}
                        placeholder={formData.currency === 'USD' ? '$0.00' : '0.00 HTG'}
                      />
                      <p className="text-xs text-muted-foreground">Prix de revente au client</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_achat_m2">Prix d'achat par m² ({formData.currency}) *</Label>
                      <Input
                        id="prix_achat_m2"
                        type="number"
                        step="0.01"
                        required
                        value={formData.prix_achat_m2}
                        onChange={(e) => {
                          const prixAchat = e.target.value;
                          setFormData({...formData, prix_achat_m2: prixAchat});
                        }}
                        placeholder={formData.currency === 'USD' ? '$0.00' : '0.00 HTG'}
                      />
                      <p className="text-xs text-muted-foreground">Coût unitaire payé par le magasin</p>
                      {formData.prix_achat_m2 && formData.prix_m2 && (
                        <p className="text-xs font-medium text-success">
                          Bénéfice: {formData.currency === 'USD' ? '$' : ''}{(parseFloat(formData.prix_m2) - parseFloat(formData.prix_achat_m2)).toFixed(2)}{formData.currency === 'HTG' ? ' HTG' : ''}/m²
                          ({(((parseFloat(formData.prix_m2) - parseFloat(formData.prix_achat_m2)) / parseFloat(formData.prix_m2)) * 100).toFixed(1)}%)
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_boite">Stock (boîtes) *</Label>
                      <Input
                        id="stock_boite"
                        type="number"
                        step="0.01"
                        required
                        value={formData.stock_boite}
                        onChange={(e) => setFormData({...formData, stock_boite: e.target.value})}
                        placeholder="24"
                      />
                      <p className="text-xs text-muted-foreground">Accepte les décimales</p>
                    </div>
                  </div>
                )}

                {/* Iron bar-specific fields */}
                {formData.category === 'fer' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🔩 Configuration Fer / Acier</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diametre">Diamètre *</Label>
                      <Select
                        value={formData.diametre}
                        onValueChange={(value) => {
                          // Auto-set bars_per_ton based on diameter
                          let barsPerTon = '';
                          if (value === '1/2"') barsPerTon = '110';
                          else if (value === '3/8"') barsPerTon = '195';
                          else if (value === '1/4"') barsPerTon = '660';
                          setFormData({...formData, diametre: value, bars_per_ton: barsPerTon});
                        }}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le diamètre" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value='1/2"'>1/2 pouce (110 barres/tonne)</SelectItem>
                          <SelectItem value='3/8"'>3/8 pouce (195 barres/tonne)</SelectItem>
                          <SelectItem value='1/4"'>1/4 pouce (660 barres/tonne)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bars_per_ton">Barres par tonne 🔢</Label>
                      <Input
                        id="bars_per_ton"
                        type="number"
                        value={formData.bars_per_ton}
                        readOnly
                        className="bg-muted cursor-not-allowed"
                        placeholder="Calculé automatiquement"
                      />
                      <p className="text-xs text-muted-foreground">Calculé selon le diamètre</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longueur_barre_ft">Longueur barre (pieds) *</Label>
                      <Select
                        value={formData.longueur_barre_ft}
                        onValueChange={(value) => setFormData({...formData, longueur_barre_ft: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner la longueur" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="27">27 ft</SelectItem>
                          <SelectItem value="30">30 ft</SelectItem>
                          <SelectItem value="32">32 ft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_par_barre">Prix par barre ({formData.currency}) *</Label>
                      <Input
                        id="prix_par_barre"
                        type="number"
                        step="0.01"
                        required
                        value={formData.prix_par_barre}
                        onChange={(e) => setFormData({...formData, prix_par_barre: e.target.value})}
                        placeholder={formData.currency === 'USD' ? '$0.00' : '0.00 HTG'}
                      />
                      <p className="text-xs text-muted-foreground">Prix unitaire d'une barre</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_barre">Stock (barres) *</Label>
                      <Input
                        id="stock_barre"
                        type="number"
                        step="0.01"
                        required
                        value={formData.stock_barre}
                        onChange={(e) => setFormData({...formData, stock_barre: e.target.value})}
                        placeholder="50"
                      />
                      <p className="text-xs text-muted-foreground">Accepte les décimales pour les fractions de tonne</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase_price">Prix d'achat par barre ({formData.currency})</Label>
                      <Input
                        id="purchase_price"
                        type="number"
                        step="0.01"
                        value={formData.purchase_price}
                        onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                        placeholder={formData.currency === 'USD' ? '$0.00' : '0.00 HTG'}
                      />
                      <p className="text-xs text-muted-foreground">Coût unitaire payé par le magasin</p>
                    </div>
                  </div>
                )}

                {/* Energy-specific fields */}
                {formData.category === 'energie' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">⚡ Configuration Énergie / Solaire</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type_energie">Type d'énergie</Label>
                      <Select
                        value={formData.type_energie}
                        onValueChange={(value) => setFormData({...formData, type_energie: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="solaire">Solaire</SelectItem>
                          <SelectItem value="batterie">Batterie</SelectItem>
                          <SelectItem value="generateur">Générateur</SelectItem>
                          <SelectItem value="gaz">Gaz</SelectItem>
                          <SelectItem value="essence">Essence</SelectItem>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="petrole">Pétrole lampant</SelectItem>
                          <SelectItem value="charbon">Charbon de bois</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="puissance">Puissance (W ou kW)</Label>
                      <Input
                        id="puissance"
                        type="number"
                        step="0.01"
                        value={formData.puissance}
                        onChange={(e) => setFormData({...formData, puissance: e.target.value})}
                        placeholder="Ex: 300 (pour panneaux solaires)"
                      />
                      <p className="text-xs text-muted-foreground">Pour panneaux solaires, générateurs</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="voltage">Voltage (V)</Label>
                      <Input
                        id="voltage"
                        type="number"
                        step="0.1"
                        value={formData.voltage}
                        onChange={(e) => setFormData({...formData, voltage: e.target.value})}
                        placeholder="Ex: 12, 24, 220"
                      />
                      <p className="text-xs text-muted-foreground">Pour batteries, équipements électriques</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacite">Capacité</Label>
                      <Input
                        id="capacite"
                        type="number"
                        step="0.01"
                        value={formData.capacite}
                        onChange={(e) => setFormData({...formData, capacite: e.target.value})}
                        placeholder="Ex: 100 (Ah pour batteries, kg pour gaz)"
                      />
                      <p className="text-xs text-muted-foreground">Ah pour batteries, kg pour bonbonnes, litres pour carburants</p>
                    </div>
                  </div>
                )}

                {/* Blocs-specific fields */}
                {formData.category === 'blocs' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🧱 Configuration Blocs</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bloc_type">Type de bloc *</Label>
                      <Select
                        value={formData.bloc_type}
                        onValueChange={(value) => setFormData({...formData, bloc_type: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="4_pouces">Bloc 4"</SelectItem>
                          <SelectItem value="5_pouces">Bloc 5"</SelectItem>
                          <SelectItem value="6_pouces">Bloc 6"</SelectItem>
                          <SelectItem value="20_pouces">Bloc 20"</SelectItem>
                          <SelectItem value="creux">Bloc Creux</SelectItem>
                          <SelectItem value="plein">Bloc Plein</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bloc_poids">Poids (kg) - Optionnel</Label>
                      <Input
                        id="bloc_poids"
                        type="number"
                        step="0.01"
                        value={formData.bloc_poids}
                        onChange={(e) => setFormData({...formData, bloc_poids: e.target.value})}
                        placeholder="Ex: 12.5"
                      />
                      <p className="text-xs text-muted-foreground">Poids approximatif par bloc</p>
                    </div>
                  </div>
                )}

                {/* Vêtements-specific fields */}
                {formData.category === 'vetements' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">👕 Configuration Vêtements</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vetement_taille">Taille *</Label>
                      <Select
                        value={formData.vetement_taille}
                        onValueChange={(value) => setFormData({...formData, vetement_taille: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner la taille" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="S">S</SelectItem>
                          <SelectItem value="M">M</SelectItem>
                          <SelectItem value="L">L</SelectItem>
                          <SelectItem value="XL">XL</SelectItem>
                          <SelectItem value="XXL">XXL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vetement_genre">Genre *</Label>
                      <Select
                        value={formData.vetement_genre}
                        onValueChange={(value) => setFormData({...formData, vetement_genre: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le genre" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="homme">Homme</SelectItem>
                          <SelectItem value="femme">Femme</SelectItem>
                          <SelectItem value="enfant">Enfant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-1 sm:col-span-2">
                      <Label htmlFor="vetement_couleur">Couleur *</Label>
                      <Input
                        id="vetement_couleur"
                        type="text"
                        value={formData.vetement_couleur}
                        onChange={(e) => setFormData({...formData, vetement_couleur: e.target.value})}
                        placeholder="Ex: Rouge, Bleu, Noir"
                      />
                    </div>
                  </div>
                )}

                {/* Électroménager-specific fields */}
                {formData.category === 'electromenager' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🔌 Configuration Électroménager</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_sous_categorie">Sous-catégorie *</Label>
                      <Select
                        value={formData.electromenager_sous_categorie}
                        onValueChange={(value) => setFormData({...formData, electromenager_sous_categorie: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner la sous-catégorie" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="gros_electromenager">Gros électroménager</SelectItem>
                          <SelectItem value="petit_electromenager">Petit électroménager</SelectItem>
                          <SelectItem value="cuisine">Cuisine</SelectItem>
                          <SelectItem value="blanchisserie">Blanchisserie</SelectItem>
                          <SelectItem value="climatisation_ventilation">Climatisation / Ventilation</SelectItem>
                          <SelectItem value="entretien">Entretien</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_marque">Marque</Label>
                      <Input
                        id="electromenager_marque"
                        type="text"
                        value={formData.electromenager_marque}
                        onChange={(e) => setFormData({...formData, electromenager_marque: e.target.value})}
                        placeholder="Ex: Samsung, LG, Haier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_modele">Modèle / Référence</Label>
                      <Input
                        id="electromenager_modele"
                        type="text"
                        value={formData.electromenager_modele}
                        onChange={(e) => setFormData({...formData, electromenager_modele: e.target.value})}
                        placeholder="Ex: WW90T554DAW"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_couleur">Couleur</Label>
                      <Input
                        id="electromenager_couleur"
                        type="text"
                        value={formData.electromenager_couleur}
                        onChange={(e) => setFormData({...formData, electromenager_couleur: e.target.value})}
                        placeholder="Ex: Blanc, Inox, Noir"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="puissance">Puissance (W)</Label>
                      <Input
                        id="puissance"
                        type="number"
                        step="1"
                        value={formData.puissance}
                        onChange={(e) => setFormData({...formData, puissance: e.target.value})}
                        placeholder="Ex: 2100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="voltage">Voltage (V)</Label>
                      <Input
                        id="voltage"
                        type="number"
                        step="1"
                        value={formData.voltage}
                        onChange={(e) => setFormData({...formData, voltage: e.target.value})}
                        placeholder="Ex: 110, 220"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacite">Capacité (kg/litres)</Label>
                      <Input
                        id="capacite"
                        type="number"
                        step="0.1"
                        value={formData.capacite}
                        onChange={(e) => setFormData({...formData, capacite: e.target.value})}
                        placeholder="Ex: 9 (kg) ou 300 (litres)"
                      />
                      <p className="text-xs text-muted-foreground">kg pour lave-linge, litres pour frigo</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_niveau_sonore_db">Niveau sonore (dB)</Label>
                      <Input
                        id="electromenager_niveau_sonore_db"
                        type="number"
                        step="1"
                        value={formData.electromenager_niveau_sonore_db}
                        onChange={(e) => setFormData({...formData, electromenager_niveau_sonore_db: e.target.value})}
                        placeholder="Ex: 54"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_classe_energie">Classe énergétique</Label>
                      <Select
                        value={formData.electromenager_classe_energie}
                        onValueChange={(value) => setFormData({...formData, electromenager_classe_energie: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner la classe" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="A+++">A+++</SelectItem>
                          <SelectItem value="A++">A++</SelectItem>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_garantie_mois">Garantie (mois)</Label>
                      <Input
                        id="electromenager_garantie_mois"
                        type="number"
                        step="1"
                        value={formData.electromenager_garantie_mois}
                        onChange={(e) => setFormData({...formData, electromenager_garantie_mois: e.target.value})}
                        placeholder="Ex: 12, 24"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_materiau">Matériau principal</Label>
                      <Select
                        value={formData.electromenager_materiau}
                        onValueChange={(value) => setFormData({...formData, electromenager_materiau: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le matériau" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="inox">Inox</SelectItem>
                          <SelectItem value="plastique">Plastique</SelectItem>
                          <SelectItem value="aluminium">Aluminium</SelectItem>
                          <SelectItem value="verre">Verre</SelectItem>
                          <SelectItem value="mixte">Mixte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="electromenager_installation">Type d'installation</Label>
                      <Select
                        value={formData.electromenager_installation}
                        onValueChange={(value) => setFormData({...formData, electromenager_installation: value})}
                      >
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          <SelectItem value="pose_libre">Pose libre</SelectItem>
                          <SelectItem value="encastrable">Encastrable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Description du produit (optionnel)"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="min-w-[120px]">
                    {editingProduct ? 'Mettre à jour' : 'Créer le produit'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {/* Filters Section - Compact and organized */}
        <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
          {/* Row 1: Search + Export + View Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-9 h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <Badge variant="secondary" className="hidden lg:flex text-xs whitespace-nowrap">
              {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
            </Badge>
            {/* Export buttons */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={exportToExcel}
                className="h-7 sm:h-8 px-2 text-[10px] sm:text-xs"
                title="Exporter en Excel"
              >
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline ml-1">Excel</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={exportToPDF}
                className="h-7 sm:h-8 px-2 text-[10px] sm:text-xs"
                title="Exporter en PDF"
              >
                <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline ml-1">PDF</span>
              </Button>
            </div>
            {/* View mode toggle */}
            <div className="hidden sm:flex items-center gap-1 border rounded-md p-0.5 bg-muted/50">
              <Button
                size="sm"
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                onClick={() => setViewMode('table')}
                className="h-7 w-7 p-0"
              >
                <List className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                onClick={() => setViewMode('cards')}
                className="h-7 w-7 p-0"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          
          {/* Row 2: All filters */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="text-[9px] sm:text-[10px] font-medium">Filtres:</span>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-6 sm:h-7 w-[90px] sm:w-[130px] text-[9px] sm:text-[10px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all" className="text-xs">Toutes catégories</SelectItem>
                {dynamicCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id} className="text-xs">{cat.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sousCategoryFilter} onValueChange={setSousCategoryFilter}>
              <SelectTrigger className="h-6 sm:h-7 w-[90px] sm:w-[130px] text-[9px] sm:text-[10px]">
                <SelectValue placeholder="Sous-cat." />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all" className="text-xs">Toutes sous-cat.</SelectItem>
                {filterSousCategories.map(sc => (
                  <SelectItem key={sc.id} value={sc.id} className="text-xs">{sc.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-6 sm:h-7 w-[75px] sm:w-[100px] text-[9px] sm:text-[10px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all" className="text-xs">Tous statuts</SelectItem>
                <SelectItem value="active" className="text-xs">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-success" />
                    Actif
                  </span>
                </SelectItem>
                <SelectItem value="inactive" className="text-xs">
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-muted-foreground" />
                    Inactif
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="h-6 sm:h-7 w-[70px] sm:w-[90px] text-[9px] sm:text-[10px]">
                <SelectValue placeholder="Devise" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all" className="text-xs">Devises</SelectItem>
                <SelectItem value="USD" className="text-xs">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-600" />
                    USD
                  </span>
                </SelectItem>
                <SelectItem value="HTG" className="text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 text-sky-600 font-bold text-[10px]">G</span>
                    HTG
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {/* Reset filters button */}
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={resetFilters}
                className="h-6 sm:h-7 px-2 text-[9px] sm:text-[10px] text-muted-foreground hover:text-foreground"
                title="Réinitialiser les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline ml-1">Réinitialiser</span>
              </Button>
            )}
            <Badge variant="outline" className="lg:hidden text-[9px] sm:text-[10px] ml-auto">
              {filteredProducts.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        {viewMode === 'cards' ? (
          /* Card View */
          <ScrollArea className="h-[calc(100vh-350px)] min-h-[400px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 pr-2 sm:pr-4">
              {paginatedProducts.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Aucun produit trouvé
                </div>
              ) : (
                paginatedProducts.map((product) => {
                  const stock = getStockDisplay(product);
                  return (
                    <Card key={product.id} className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="font-semibold text-sm sm:text-base line-clamp-2">{product.name}</h3>
                        <Badge 
                          variant="outline"
                          className={`text-[10px] sm:text-xs shrink-0 ${product.currency === 'USD' 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400'
                          }`}
                        >
                          {product.currency === 'USD' ? '$ USD' : 'HTG'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1.5 text-xs sm:text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Catégorie:</span>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {categories.find(c => c.value === product.category)?.label}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prix:</span>
                          <span className="font-medium text-success">
                            {product.currency === 'USD' ? '$' : ''}{product.price.toFixed(2)} {product.currency || 'HTG'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Stock:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{stock.value} {stock.unit}</span>
                            {stock.raw <= product.alert_threshold && (
                              <AlertCircle className="w-3 h-3 text-warning" />
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Statut:</span>
                          <Badge variant={product.is_active ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                            {product.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(product)}
                            className="flex-1 h-8 text-xs"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(product.id, product.name)}
                            className="h-8 hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        ) : (
          /* Table View */
          <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="hidden md:table-cell">Code-barres</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="hidden sm:table-cell">Unité</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Devise</TableHead>
                <TableHead>Prix</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="hidden sm:table-cell">Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Aucun produit trouvé
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {product.barcode ? (
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{product.barcode}</code>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categories.find(c => c.value === product.category)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{product.unit}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={product.sale_type === 'retail' ? "default" : "secondary"}>
                        {product.sale_type === 'retail' ? 'Détail' : 'Gros'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={product.currency === 'USD' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' 
                          : 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-700'
                        }
                      >
                        {product.currency === 'USD' ? '$ USD' : 'G HTG'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-success font-medium">
                      {product.currency === 'USD' ? '$' : ''}{product.price.toFixed(2)} {product.currency || 'HTG'}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const stock = getStockDisplay(product);
                        return (
                          <div className="flex items-center gap-2">
                            <span>{stock.value} {stock.unit}</span>
                            {stock.raw <= product.alert_threshold && (
                              <AlertCircle className="w-4 h-4 text-warning" />
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(product)}
                            title="Modifier"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(product.id, product.name)}
                            className="hover:bg-destructive hover:text-destructive-foreground"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Admin seulement</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        )}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPrevPage={prevPage}
          onNextPage={nextPage}
          hasPrevPage={hasPrevPage}
          hasNextPage={hasNextPage}
        />
      </CardContent>
      
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => 
        setDeleteDialog({open, productId: null, productName: ''})
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer <strong>{deleteDialog.productName}</strong>.
              {' '}Si ce produit est utilisé dans des ventes existantes, il sera désactivé au lieu d'être supprimé définitivement.
              {' '}Sinon, cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};