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
import { Package, Plus, Edit, Trash2, AlertCircle, Search, Filter, LayoutGrid, List, Download, FileText, DollarSign, CheckCircle, XCircle, RotateCcw, Lock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCategories, useSousCategories, useSpecificationsModeles } from '@/hooks/useCategories';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from 'react-i18next';
import { formatLocalizedDate } from '@/lib/locale';
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
  dimension?: string;
  surface_par_boite?: number;
  prix_m2?: number;
  stock_boite?: number;
  diametre?: string;
  longueur_barre?: number;
  longueur_barre_ft?: number;
  bars_per_ton?: number;
  prix_par_metre?: number;
  prix_par_barre?: number;
  stock_barre?: number;
  decimal_autorise?: boolean;
  puissance?: number;
  voltage?: number;
  capacite?: number;
  type_energie?: string;
  specifications_techniques?: any;
  bloc_type?: string;
  bloc_poids?: number;
  vetement_taille?: string;
  vetement_genre?: string;
  vetement_couleur?: string;
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
  const { t } = useTranslation();
  const { user, role, profile } = useAuth();
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
  
  useEffect(() => {
    if (isMobile) setViewMode('cards');
  }, [isMobile]);

  const [selectedCategorieId, setSelectedCategorieId] = useState<string>('');
  const [selectedSousCategorieId, setSelectedSousCategorieId] = useState<string>('');
  const [dynamicSpecs, setDynamicSpecs] = useState<Record<string, any>>({});
  
  const { specifications: specModeles } = useSpecificationsModeles(selectedSousCategorieId || undefined);
  
  const filteredSousCategories = useMemo(() => {
    if (!selectedCategorieId) return [];
    return allSousCategories.filter(sc => sc.categorie_id === selectedCategorieId);
  }, [selectedCategorieId, allSousCategories]);
  
  const filterSousCategories = useMemo(() => {
    if (categoryFilter === 'all') return allSousCategories;
    return allSousCategories.filter(sc => sc.categorie_id === categoryFilter);
  }, [categoryFilter, allSousCategories]);
  
  useEffect(() => {
    setSousCategoryFilter('all');
  }, [categoryFilter]);
  
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

  const getStockDisplay = (product: Product) => {
    const round2 = (val: number) => Math.round(val * 100) / 100;
    
    if (product.category === 'ceramique' && product.stock_boite !== null && product.stock_boite !== undefined && product.stock_boite > 0 && product.surface_par_boite) {
      const m2 = round2(product.stock_boite * product.surface_par_boite);
      return { value: m2.toFixed(2), unit: 'm²', raw: product.stock_boite };
    }
    if (product.category === 'fer' && product.stock_barre !== null && product.stock_barre !== undefined && product.stock_barre > 0) {
      return { value: product.stock_barre.toString(), unit: t('products.iron.stockBars').toLowerCase(), raw: product.stock_barre };
    }
    return { value: product.quantity.toString(), unit: product.unit || t('stockAlerts.units'), raw: product.quantity };
  };

  const categoryValues: ProductCategory[] = ['alimentaires', 'boissons', 'gazeuses', 'electronique', 'ceramique', 'fer', 'materiaux_de_construction', 'energie', 'blocs', 'vetements', 'electromenager', 'autres'];

  const getCategoryLabel = (value: string) => t(`products.categoryLabels.${value}`, value);

  useEffect(() => {
    fetchProducts();
    
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
      
      const matchesCategory = categoryFilter === 'all' || 
        (product as any).categorie_id === categoryFilter ||
        product.category === categoryFilter;
      
      const matchesSousCategory = sousCategoryFilter === 'all' || 
        (product as any).sous_categorie_id === sousCategoryFilter;
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active);
      
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
      setProducts((data || []).map(p => ({
        ...p,
        currency: (p.currency === 'USD' ? 'USD' : 'HTG') as 'USD' | 'HTG'
      })));
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: t('common.error'),
        description: t('common.loadError'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (isFreePlan) {
      toast({ title: t('common.premiumFeature'), description: t('common.premiumExportExcel'), variant: "destructive" });
      return;
    }
    const exportData = filteredProducts.map(p => {
      const stock = getStockDisplay(p);
      return {
        [t('products.tableHeaders.name')]: p.name,
        [t('products.tableHeaders.barcode')]: p.barcode || '-',
        [t('products.tableHeaders.category')]: getCategoryLabel(p.category),
        [t('products.tableHeaders.price')]: p.price,
        [t('products.tableHeaders.currency')]: p.currency,
        [t('products.tableHeaders.stock')]: `${stock.value} ${stock.unit}`,
        [t('products.tableHeaders.threshold')]: p.alert_threshold,
        [t('products.tableHeaders.status')]: p.is_active ? t('common.active') : t('common.inactive'),
        [t('products.tableHeaders.saleType')]: p.sale_type === 'retail' ? t('products.retail') : t('products.wholesale')
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('products.titleShort'));
    XLSX.writeFile(wb, `produits_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: t('common.exportSuccess'), description: t('products.exportedExcel', { count: filteredProducts.length }) });
  };

  const exportToPDF = async () => {
    if (isFreePlan) {
      toast({ title: t('common.premiumFeature'), description: t('common.premiumExportPdf'), variant: "destructive" });
      return;
    }
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('products.pdfTitle'), pageWidth / 2, 15, { align: 'center' });
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(t('products.pdfExportDate', { date: formatLocalizedDate(new Date()), count: filteredProducts.length }), pageWidth / 2, 22, { align: 'center' });
    
    const headers = [t('products.tableHeaders.name'), t('products.tableHeaders.category'), t('products.tableHeaders.price'), t('products.tableHeaders.currency'), t('products.tableHeaders.stock'), t('products.tableHeaders.status')];
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
        getCategoryLabel(p.category).substring(0, 20),
        p.price.toFixed(2),
        p.currency,
        `${stock.value} ${stock.unit}`,
        p.is_active ? t('common.active') : t('common.inactive')
      ];
      
      row.forEach((cell, i) => {
        pdf.text(cell.toString(), x, y);
        x += colWidths[i];
      });
      y += 6;
    });
    
    pdf.save(`produits_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: t('common.exportSuccess'), description: t('products.exportedPdf', { count: filteredProducts.length }) });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setSousCategoryFilter('all');
    setStatusFilter('all');
    setCurrencyFilter('all');
    toast({ title: t('common.filtersReset') });
  };

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
    setSelectedCategorieId('');
    setSelectedSousCategorieId('');
    setDynamicSpecs({});
  };

  const handleEdit = (product: Product) => {
    if (!isAdmin) {
      toast({
        title: t('common.unauthorized'),
        description: t('products.adminOnlyEdit'),
        variant: "destructive"
      });
      return;
    }
    
    setEditingProduct(product);
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

  const { maxProducts, plan, isFreePlan } = useSubscription();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    if (!isAdmin) {
      toast({
        title: t('common.unauthorized'),
        description: t('products.adminOnlyManage'),
        variant: "destructive"
      });
      return;
    }

    if (!editingProduct && products.length >= maxProducts) {
      toast({
        title: t('products.limitReached'),
        description: t('products.limitReachedDesc', { plan: isFreePlan ? t('common.freeplan') : plan, max: maxProducts }),
        variant: "destructive"
      });
      return;
    }

    if (formData.category === 'ceramique') {
      if (!formData.dimension || !formData.surface_par_boite || !formData.prix_m2 || !formData.prix_achat_m2 || !formData.stock_boite) {
        toast({
          title: t('common.validationError'),
          description: t('products.validation.ceramicRequired'),
          variant: "destructive"
        });
        return;
      }
    }

    if (formData.category === 'fer') {
      if (!formData.diametre || !formData.longueur_barre_ft || !formData.bars_per_ton || !formData.prix_par_barre || !formData.stock_barre) {
        toast({
          title: t('common.validationError'),
          description: t('products.validation.ironRequired'),
          variant: "destructive"
        });
        return;
      }
    }

    if (formData.category === 'blocs') {
      if (!formData.bloc_type) {
        toast({
          title: t('common.validationError'),
          description: t('products.validation.blocTypeRequired'),
          variant: "destructive"
        });
        return;
      }
    }

    if (formData.category === 'vetements') {
      if (!formData.vetement_taille || !formData.vetement_genre || !formData.vetement_couleur) {
        toast({
          title: t('common.validationError'),
          description: t('products.validation.clothingRequired'),
          variant: "destructive"
        });
        return;
      }
    }

    if (formData.category === 'energie') {
      if (!formData.puissance && !formData.voltage && !formData.capacite) {
        toast({
          title: t('common.validationError'),
          description: t('products.validation.energyRequired'),
          variant: "destructive"
        });
        return;
      }
    }

    if (formData.category !== 'ceramique' && formData.category !== 'fer') {
      if (!formData.price || !formData.quantity) {
        toast({
          title: t('common.validationError'),
          description: t('products.validation.priceQuantityRequired'),
          variant: "destructive"
        });
        return;
      }
    }

    try {
      const companyId = (profile as any)?.company_id || '';
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
        company_id: companyId,
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
        categorie_id: selectedCategorieId || null,
        sous_categorie_id: selectedSousCategorieId || null,
        specifications_techniques: Object.keys(dynamicSpecs).length > 0 ? dynamicSpecs : null
      };

      if (formData.category === 'ceramique') {
        productData.price = parseFloat(formData.prix_m2);
        productData.purchase_price = parseFloat(formData.prix_achat_m2);
        productData.quantity = parseFloat(formData.stock_boite);
        productData.dimension = formData.dimension;
        productData.surface_par_boite = parseFloat(formData.surface_par_boite);
        productData.prix_m2 = parseFloat(formData.prix_m2);
        productData.stock_boite = parseFloat(formData.stock_boite);
      } else if (formData.category === 'fer') {
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
        productData.price = parseFloat(formData.price);
        productData.purchase_price = formData.purchase_price ? parseFloat(formData.purchase_price) : null;
        productData.quantity = parseFloat(formData.quantity);
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;

        toast({
          title: t('products.productUpdated'),
          description: t('products.productUpdatedDesc')
        });

        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          company_id: companyId,
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
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();

        if (error) throw error;

        toast({
          title: t('products.productCreated'),
          description: t('products.productCreatedDesc')
        });

        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          company_id: companyId,
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
      
      if (error?.message?.includes('row-level security') || error?.message?.includes('policy')) {
        toast({
          title: t('products.adminReserved'),
          description: t('products.adminOnlyManage'),
          variant: "destructive"
        });
      } else {
        toast({
          title: t('common.error'),
          description: t('common.saveError'),
          variant: "destructive"
        });
      }
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (!isAdmin) {
      toast({
        title: t('common.unauthorized'),
        description: t('products.adminOnlyDelete'),
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

      const { count, error: countError } = await supabase
        .from('sale_items')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId);

      if (countError) throw countError;

      if (count && count > 0) {
        const { error } = await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', productId);

        if (error) throw error;

        toast({
          title: t('products.productDeactivated'),
          description: t('products.productDeactivatedDesc', { count }),
        });

        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          company_id: (profile as any)?.company_id || '',
          action_type: 'product_deactivated',
          entity_type: 'product',
          entity_id: productId,
          description: `Produit "${productName}" désactivé (utilisé dans des ventes)`,
          metadata: { product_name: productName, reason: 'used_in_sales', sales_count: count }
        });
      } else {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);

        if (error) throw error;

        toast({
          title: t('products.productDeleted'),
          description: t('products.productDeletedDesc')
        });

        await (supabase as any).from('activity_logs').insert({
          user_id: user.id,
          company_id: (profile as any)?.company_id || '',
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
          title: t('products.adminReserved'),
          description: t('products.adminOnlyDelete'),
          variant: "destructive"
        });
      } else {
        toast({
          title: t('common.error'),
          description: t('common.deleteError'),
          variant: "destructive"
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">{t('common.loading')}</span>
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
              {t('products.adminOnlyNotice')}
            </p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            <span className="hidden sm:inline">{t('products.title')}</span>
            <span className="sm:hidden">{t('products.titleShort')}</span>
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                className="gap-2"
                onClick={() => {
                  if (!isAdmin) {
                    toast({
                      title: t('common.unauthorized'),
                      description: t('products.adminOnlyManage'),
                      variant: "destructive"
                    });
                    return;
                  }
                }}
                disabled={!isAdmin}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('products.addProduct')}</span>
                <span className="sm:hidden">{t('common.add')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? t('products.editProduct') : t('products.newProduct')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">{t('products.productName')} *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder={t('products.productName')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">{t('common.barcode')}</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      placeholder={t('common.barcode')}
                    />
                  </div>

                  {/* Dynamic Category Selection */}
                  <div className="space-y-2">
                    <Label>{t('products.dynamicCategory')} *</Label>
                    <Select
                      value={selectedCategorieId}
                      onValueChange={(value) => {
                        setSelectedCategorieId(value);
                        const cat = dynamicCategories.find(c => c.id === value);
                        if (cat) {
                          setFormData(prev => ({...prev, category: cat.slug as ProductCategory}));
                        }
                      }}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue placeholder={t('products.selectCategory')} />
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
                    <Label>{t('products.subcategory')} *</Label>
                    <Select
                      value={selectedSousCategorieId}
                      onValueChange={(value) => {
                        setSelectedSousCategorieId(value);
                        const sc = filteredSousCategories.find(s => s.id === value);
                        if (sc) {
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
                        <SelectValue placeholder={selectedCategorieId ? t('products.selectSubcategory') : t('products.chooseCategoryFirst')} />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150] bg-popover">
                        {filteredSousCategories.map(sc => (
                          <SelectItem key={sc.id} value={sc.id}>{sc.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSousCategorieId && filteredSousCategories.find(sc => sc.id === selectedSousCategorieId)?.stock_type && (
                      <p className="text-xs text-muted-foreground">
                        {t('products.stockType')}: {
                          filteredSousCategories.find(sc => sc.id === selectedSousCategorieId)?.stock_type === 'boite_m2' ? t('products.stockTypeBoxM2') :
                          filteredSousCategories.find(sc => sc.id === selectedSousCategorieId)?.stock_type === 'barre_metre' ? t('products.stockTypeBarMeter') :
                          t('products.stockTypeSimple')
                        }
                      </p>
                    )}
                  </div>

                  {/* Legacy Category Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="category">{t('products.legacyCategory')} *</Label>
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
                        {categoryValues.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {getCategoryLabel(cat)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dynamic Specifications */}
                  {specModeles.length > 0 && (
                    <div className="col-span-1 sm:col-span-2 p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-semibold text-sm mb-3">📋 {t('products.dynamicSpecs')}</h4>
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
                                  <SelectValue placeholder={`${t('products.selectCategory')}...`} />
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
                                <span className="text-sm text-muted-foreground">{dynamicSpecs[spec.nom_champ] ? t('common.yes') : t('common.no')}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category info badges */}
                  {formData.category === 'ceramique' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">🏺 {t('products.ceramic.badge')}</Badge>
                    </div>
                  )}
                  {formData.category === 'fer' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">🔩 {t('products.iron.badge')}</Badge>
                    </div>
                  )}
                  {formData.category === 'energie' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">⚡ {t('products.energy.badge')}</Badge>
                    </div>
                  )}
                  {formData.category === 'blocs' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">🧱 {t('products.blocks.badge')}</Badge>
                    </div>
                  )}
                  {formData.category === 'vetements' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">👕 {t('products.clothing.badge')}</Badge>
                    </div>
                  )}
                  {formData.category === 'electromenager' && (
                    <div className="col-span-1 sm:col-span-2">
                      <Badge variant="outline" className="text-xs">🔌 {t('products.appliance.badge')}</Badge>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="unit">{t('products.unitOfMeasure')} *</Label>
                    <Input
                      id="unit"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      placeholder={t('products.unitPlaceholder')}
                      disabled={formData.category === 'ceramique' || formData.category === 'fer'}
                      className={formData.category === 'ceramique' || formData.category === 'fer' ? 'bg-muted' : ''}
                    />
                  </div>

                  {formData.category !== 'ceramique' && formData.category !== 'fer' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="price">{t('products.sellingPrice')} ({formData.currency}) *</Label>
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
                        <Label htmlFor="purchase_price">{t('products.purchasePrice')} ({formData.currency})</Label>
                        <Input
                          id="purchase_price"
                          type="number"
                          step="0.01"
                          value={formData.purchase_price}
                          onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                          placeholder={formData.currency === 'USD' ? '$0.00' : '0.00 HTG'}
                        />
                        <p className="text-xs text-muted-foreground">{t('products.purchasePriceHint')}</p>
                        {formData.purchase_price && formData.price && (
                          <p className="text-xs font-medium text-success">
                            {t('products.profit')}: {formData.currency === 'USD' ? '$' : ''}{(parseFloat(formData.price) - parseFloat(formData.purchase_price)).toFixed(2)}{formData.currency === 'HTG' ? ' HTG' : ''}
                            ({(((parseFloat(formData.price) - parseFloat(formData.purchase_price)) / parseFloat(formData.price)) * 100).toFixed(1)}%)
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantity">{t('common.quantity')} *</Label>
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
                    <Label htmlFor="alert_threshold">{t('products.alertThreshold')} *</Label>
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
                    <Label htmlFor="is_active">{t('common.status')}</Label>
                    <Select
                      value={formData.is_active ? 'true' : 'false'}
                      onValueChange={(value) => setFormData({...formData, is_active: value === 'true'})}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150]">
                        <SelectItem value="true">{t('common.active')}</SelectItem>
                        <SelectItem value="false">{t('common.inactive')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale_type">{t('products.saleType')} *</Label>
                    <Select
                      value={formData.sale_type}
                      onValueChange={(value: 'retail' | 'wholesale') => setFormData({...formData, sale_type: value})}
                    >
                      <SelectTrigger className="pointer-events-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="pointer-events-auto z-[150]">
                        <SelectItem value="retail">{t('products.retail')}</SelectItem>
                        <SelectItem value="wholesale">{t('products.wholesale')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">{t('common.currency')} *</Label>
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
                      <h3 className="font-semibold text-sm mb-2">🏺 {t('products.ceramic.title')}</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dimension">{t('products.ceramic.dimension')} *</Label>
                      <Input id="dimension" required value={formData.dimension} onChange={(e) => setFormData({...formData, dimension: e.target.value})} placeholder={t('products.ceramic.dimensionPlaceholder')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surface_par_boite">{t('products.ceramic.surfacePerBox')} *</Label>
                      <Input id="surface_par_boite" type="number" step="0.01" required value={formData.surface_par_boite} onChange={(e) => setFormData({...formData, surface_par_boite: e.target.value})} placeholder="1.44" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_m2">{t('products.ceramic.sellingPriceM2')} ({formData.currency}) *</Label>
                      <Input id="prix_m2" type="number" step="0.01" required value={formData.prix_m2} onChange={(e) => setFormData({...formData, prix_m2: e.target.value})} placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_achat_m2">{t('products.ceramic.purchasePriceM2')} ({formData.currency}) *</Label>
                      <Input id="prix_achat_m2" type="number" step="0.01" required value={formData.prix_achat_m2} onChange={(e) => setFormData({...formData, prix_achat_m2: e.target.value})} placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_boite">{t('products.ceramic.stockBoxes')} *</Label>
                      <Input id="stock_boite" type="number" step="1" required value={formData.stock_boite} onChange={(e) => setFormData({...formData, stock_boite: e.target.value})} placeholder="0" />
                    </div>
                  </div>
                )}

                {/* Iron-specific fields */}
                {formData.category === 'fer' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🔩 {t('products.iron.title')}</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diametre">{t('products.iron.diameter')} *</Label>
                      <Input id="diametre" required value={formData.diametre} onChange={(e) => setFormData({...formData, diametre: e.target.value})} placeholder={t('products.iron.diameterPlaceholder')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="longueur_barre_ft">{t('products.iron.barLengthFt')} *</Label>
                      <Input id="longueur_barre_ft" type="number" step="0.1" required value={formData.longueur_barre_ft} onChange={(e) => setFormData({...formData, longueur_barre_ft: e.target.value})} placeholder="20" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bars_per_ton">{t('products.iron.barsPerTon')} *</Label>
                      <Input id="bars_per_ton" type="number" step="1" required value={formData.bars_per_ton} onChange={(e) => setFormData({...formData, bars_per_ton: e.target.value})} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_par_metre">{t('products.iron.pricePerMeter')} ({formData.currency})</Label>
                      <Input id="prix_par_metre" type="number" step="0.01" value={formData.prix_par_metre} onChange={(e) => setFormData({...formData, prix_par_metre: e.target.value})} placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prix_par_barre">{t('products.iron.pricePerBar')} ({formData.currency}) *</Label>
                      <Input id="prix_par_barre" type="number" step="0.01" required value={formData.prix_par_barre} onChange={(e) => setFormData({...formData, prix_par_barre: e.target.value})} placeholder="0.00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_barre">{t('products.iron.stockBars')} *</Label>
                      <Input id="stock_barre" type="number" step="1" required value={formData.stock_barre} onChange={(e) => setFormData({...formData, stock_barre: e.target.value})} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase_price_fer">{t('products.purchasePrice')} ({formData.currency})</Label>
                      <Input id="purchase_price_fer" type="number" step="0.01" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} placeholder="0.00" />
                    </div>
                  </div>
                )}

                {/* Energy-specific fields */}
                {formData.category === 'energie' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">⚡ {t('products.energy.title')}</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type_energie">{t('products.energy.type')}</Label>
                      <Select value={formData.type_energie} onValueChange={(value) => setFormData({...formData, type_energie: value})}>
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder={t('products.blocks.selectType')} />
                        </SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          {['solaire', 'batterie', 'generateur', 'gaz', 'essence', 'diesel', 'petrole', 'charbon'].map(type => (
                            <SelectItem key={type} value={type}>{t(`products.energy.types.${type}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="puissance">{t('products.energy.power')}</Label>
                      <Input id="puissance" type="number" step="0.01" value={formData.puissance} onChange={(e) => setFormData({...formData, puissance: e.target.value})} placeholder="Ex: 300" />
                      <p className="text-xs text-muted-foreground">{t('products.energy.powerHint')}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="voltage">{t('products.energy.voltage')}</Label>
                      <Input id="voltage" type="number" step="0.1" value={formData.voltage} onChange={(e) => setFormData({...formData, voltage: e.target.value})} placeholder="Ex: 12, 24, 220" />
                      <p className="text-xs text-muted-foreground">{t('products.energy.voltageHint')}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacite">{t('products.energy.capacity')}</Label>
                      <Input id="capacite" type="number" step="0.01" value={formData.capacite} onChange={(e) => setFormData({...formData, capacite: e.target.value})} placeholder="Ex: 100" />
                      <p className="text-xs text-muted-foreground">{t('products.energy.capacityHint')}</p>
                    </div>
                  </div>
                )}

                {/* Blocs-specific fields */}
                {formData.category === 'blocs' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🧱 {t('products.blocks.title')}</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bloc_type">{t('products.blocks.type')} *</Label>
                      <Select value={formData.bloc_type} onValueChange={(value) => setFormData({...formData, bloc_type: value})}>
                        <SelectTrigger className="pointer-events-auto">
                          <SelectValue placeholder={t('products.blocks.selectType')} />
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
                      <Label htmlFor="bloc_poids">{t('products.blocks.weight')}</Label>
                      <Input id="bloc_poids" type="number" step="0.01" value={formData.bloc_poids} onChange={(e) => setFormData({...formData, bloc_poids: e.target.value})} placeholder="Ex: 12.5" />
                      <p className="text-xs text-muted-foreground">{t('products.blocks.weightHint')}</p>
                    </div>
                  </div>
                )}

                {/* Vêtements-specific fields */}
                {formData.category === 'vetements' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">👕 {t('products.clothing.title')}</h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vetement_taille">{t('products.clothing.size')} *</Label>
                      <Select value={formData.vetement_taille} onValueChange={(value) => setFormData({...formData, vetement_taille: value})}>
                        <SelectTrigger className="pointer-events-auto"><SelectValue placeholder={t('products.clothing.size')} /></SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          {['S', 'M', 'L', 'XL', 'XXL'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vetement_genre">{t('products.clothing.gender')} *</Label>
                      <Select value={formData.vetement_genre} onValueChange={(value) => setFormData({...formData, vetement_genre: value})}>
                        <SelectTrigger className="pointer-events-auto"><SelectValue placeholder={t('products.clothing.gender')} /></SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          {['homme', 'femme', 'enfant'].map(g => <SelectItem key={g} value={g}>{t(`products.clothing.genders.${g}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-1 sm:col-span-2">
                      <Label htmlFor="vetement_couleur">{t('products.clothing.color')} *</Label>
                      <Input id="vetement_couleur" type="text" value={formData.vetement_couleur} onChange={(e) => setFormData({...formData, vetement_couleur: e.target.value})} placeholder={t('products.clothing.colorPlaceholder')} />
                    </div>
                  </div>
                )}

                {/* Électroménager-specific fields */}
                {formData.category === 'electromenager' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="col-span-1 sm:col-span-2">
                      <h3 className="font-semibold text-sm mb-2">🔌 {t('products.appliance.title')}</h3>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.subcategory')} *</Label>
                      <Select value={formData.electromenager_sous_categorie} onValueChange={(value) => setFormData({...formData, electromenager_sous_categorie: value})}>
                        <SelectTrigger className="pointer-events-auto"><SelectValue placeholder={t('products.appliance.subcategory')} /></SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          {['gros_electromenager', 'petit_electromenager', 'cuisine', 'blanchisserie', 'climatisation_ventilation', 'entretien'].map(sc => (
                            <SelectItem key={sc} value={sc}>{t(`products.appliance.subcategories.${sc}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.brand')}</Label>
                      <Input value={formData.electromenager_marque} onChange={(e) => setFormData({...formData, electromenager_marque: e.target.value})} placeholder="Ex: Samsung, LG, Haier" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.model')}</Label>
                      <Input value={formData.electromenager_modele} onChange={(e) => setFormData({...formData, electromenager_modele: e.target.value})} placeholder="Ex: WW90T554DAW" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.color')}</Label>
                      <Input value={formData.electromenager_couleur} onChange={(e) => setFormData({...formData, electromenager_couleur: e.target.value})} placeholder="Ex: Blanc, Inox, Noir" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.power')}</Label>
                      <Input type="number" step="1" value={formData.puissance} onChange={(e) => setFormData({...formData, puissance: e.target.value})} placeholder="Ex: 2100" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.voltage')}</Label>
                      <Input type="number" step="1" value={formData.voltage} onChange={(e) => setFormData({...formData, voltage: e.target.value})} placeholder="Ex: 110, 220" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.capacity')}</Label>
                      <Input type="number" step="0.1" value={formData.capacite} onChange={(e) => setFormData({...formData, capacite: e.target.value})} placeholder="Ex: 9 (kg) ou 300 (litres)" />
                      <p className="text-xs text-muted-foreground">{t('products.appliance.capacityHint')}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.noiseLevel')}</Label>
                      <Input type="number" step="1" value={formData.electromenager_niveau_sonore_db} onChange={(e) => setFormData({...formData, electromenager_niveau_sonore_db: e.target.value})} placeholder="Ex: 54" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.energyClass')}</Label>
                      <Select value={formData.electromenager_classe_energie} onValueChange={(value) => setFormData({...formData, electromenager_classe_energie: value})}>
                        <SelectTrigger className="pointer-events-auto"><SelectValue placeholder={t('products.appliance.energyClass')} /></SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          {['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.warranty')}</Label>
                      <Input type="number" step="1" value={formData.electromenager_garantie_mois} onChange={(e) => setFormData({...formData, electromenager_garantie_mois: e.target.value})} placeholder="Ex: 12, 24" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.material')}</Label>
                      <Select value={formData.electromenager_materiau} onValueChange={(value) => setFormData({...formData, electromenager_materiau: value})}>
                        <SelectTrigger className="pointer-events-auto"><SelectValue placeholder={t('products.appliance.material')} /></SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          {['inox', 'plastique', 'aluminium', 'verre', 'mixte'].map(m => (
                            <SelectItem key={m} value={m}>{t(`products.appliance.materials.${m}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('products.appliance.installation')}</Label>
                      <Select value={formData.electromenager_installation} onValueChange={(value) => setFormData({...formData, electromenager_installation: value})}>
                        <SelectTrigger className="pointer-events-auto"><SelectValue placeholder={t('products.appliance.installation')} /></SelectTrigger>
                        <SelectContent className="pointer-events-auto z-[150]">
                          {['pose_libre', 'encastrable'].map(i => (
                            <SelectItem key={i} value={i}>{t(`products.appliance.installTypes.${i}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">{t('common.description')}</Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder={t('common.description')}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" className="min-w-[120px]">
                    {editingProduct ? t('common.edit') : t('products.addProduct')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {/* Filters Section */}
        <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder={t('products.searchProducts')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-9 h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <Badge variant="secondary" className="hidden lg:flex text-xs whitespace-nowrap">
              {filteredProducts.length} {t('products.titleShort').toLowerCase()}
            </Badge>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={exportToExcel} className="h-7 sm:h-8 px-2 text-[10px] sm:text-xs" title="Excel">
                {isFreePlan ? <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                <span className="hidden sm:inline ml-1">Excel</span>
              </Button>
              <Button size="sm" variant="outline" onClick={exportToPDF} className="h-7 sm:h-8 px-2 text-[10px] sm:text-xs" title="PDF">
                {isFreePlan ? <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                <span className="hidden sm:inline ml-1">PDF</span>
              </Button>
            </div>
            <div className="hidden sm:flex items-center gap-1 border rounded-md p-0.5 bg-muted/50">
              <Button size="sm" variant={viewMode === 'table' ? 'default' : 'ghost'} onClick={() => setViewMode('table')} className="h-7 w-7 p-0">
                <List className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant={viewMode === 'cards' ? 'default' : 'ghost'} onClick={() => setViewMode('cards')} className="h-7 w-7 p-0">
                <LayoutGrid className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="text-[9px] sm:text-[10px] font-medium">{t('common.filter')}:</span>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-6 sm:h-7 w-[90px] sm:w-[130px] text-[9px] sm:text-[10px]">
                <SelectValue placeholder={t('common.category')} />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all" className="text-xs">{t('common.all')}</SelectItem>
                {dynamicCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id} className="text-xs">{cat.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sousCategoryFilter} onValueChange={setSousCategoryFilter}>
              <SelectTrigger className="h-6 sm:h-7 w-[90px] sm:w-[130px] text-[9px] sm:text-[10px]">
                <SelectValue placeholder={t('products.subcategory')} />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all" className="text-xs">{t('common.all')}</SelectItem>
                {filterSousCategories.map(sc => (
                  <SelectItem key={sc.id} value={sc.id} className="text-xs">{sc.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-6 sm:h-7 w-[75px] sm:w-[100px] text-[9px] sm:text-[10px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all" className="text-xs">{t('common.all')}</SelectItem>
                <SelectItem value="active" className="text-xs">
                  <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-success" />{t('common.active')}</span>
                </SelectItem>
                <SelectItem value="inactive" className="text-xs">
                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-muted-foreground" />{t('common.inactive')}</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="h-6 sm:h-7 w-[70px] sm:w-[90px] text-[9px] sm:text-[10px]">
                <SelectValue placeholder={t('common.currency')} />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all" className="text-xs">{t('common.all')}</SelectItem>
                <SelectItem value="USD" className="text-xs">
                  <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-600" />USD</span>
                </SelectItem>
                <SelectItem value="HTG" className="text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 text-sky-600 font-bold text-[10px]">G</span>HTG</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={resetFilters} className="h-6 sm:h-7 px-2 text-[9px] sm:text-[10px] text-muted-foreground hover:text-foreground" title={t('common.resetFilters')}>
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline ml-1">{t('common.resetFilters')}</span>
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
          <ScrollArea className="h-[calc(100vh-350px)] min-h-[400px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 pr-2 sm:pr-4">
              {paginatedProducts.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  {t('products.noProducts')}
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
                          <span className="text-muted-foreground">{t('common.category')}:</span>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {getCategoryLabel(product.category)}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('common.price')}:</span>
                          <span className="font-medium text-success">
                            {product.currency === 'USD' ? '$' : ''}{product.price.toFixed(2)} {product.currency || 'HTG'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">{t('products.tableHeaders.stock')}:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{stock.value} {stock.unit}</span>
                            {stock.raw <= product.alert_threshold && (
                              <AlertCircle className="w-3 h-3 text-warning" />
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('common.status')}:</span>
                          <Badge variant={product.is_active ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                            {product.is_active ? t('common.active') : t('common.inactive')}
                          </Badge>
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(product)} className="flex-1 h-8 text-xs">
                            <Edit className="w-3 h-3 mr-1" />
                            {t('common.edit')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteClick(product.id, product.name)} className="h-8 hover:bg-destructive hover:text-destructive-foreground">
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
          <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('products.tableHeaders.name')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('products.tableHeaders.barcode')}</TableHead>
                <TableHead>{t('products.tableHeaders.category')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('common.unit')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('products.tableHeaders.saleType')}</TableHead>
                <TableHead>{t('products.tableHeaders.currency')}</TableHead>
                <TableHead>{t('products.tableHeaders.price')}</TableHead>
                <TableHead>{t('products.tableHeaders.stock')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('products.tableHeaders.status')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {t('products.noProducts')}
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
                        {getCategoryLabel(product.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{product.unit}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={product.sale_type === 'retail' ? "default" : "secondary"}>
                        {product.sale_type === 'retail' ? t('products.retail') : t('products.wholesale')}
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
                        {product.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(product)} title={t('common.edit')}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteClick(product.id, product.name)} className="hover:bg-destructive hover:text-destructive-foreground" title={t('common.delete')}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({...deleteDialog, open})}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('products.confirmDeleteDesc', { name: deleteDialog.productName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
