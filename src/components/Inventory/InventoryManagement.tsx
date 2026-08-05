import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Constants } from '@/integrations/supabase/types';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatNumber } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from 'react-i18next';
import { 
  Package, 
  Search, 
  RefreshCw, 
  Download,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Plus,
  Minus,
  Edit,
  Filter,
  ArrowUpDown,
  Warehouse,
  TrendingDown,
  DollarSign,
  Info,
  LayoutGrid,
  List,
  ScanLine,
  Lock
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { QuickInventoryMode } from './QuickInventoryMode';
import { InventoryHistory } from './InventoryHistory';
import { generateInventoryStockPDF, CompanySettings } from '@/lib/pdfGenerator';

type Product = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  stock_boite: number | null;
  stock_barre: number | null;
  surface_par_boite: number | null;
  alert_threshold: number;
  is_active: boolean;
  price: number;
  purchase_price: number | null;
  unit: string;
  created_at: string;
  currency: string;
};

type StockLevel = 'all' | 'rupture' | 'alerte' | 'normal' | 'eleve';
type SortField = 'name' | 'quantity' | 'category' | 'price';
type SortDirection = 'asc' | 'desc';

export const InventoryManagement = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const { plan, isFreePlan } = useSubscription();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockLevel, setStockLevel] = useState<StockLevel>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(isMobile ? 'cards' : 'table');
  
  // Auto switch to cards on mobile
  useEffect(() => {
    if (isMobile) setViewMode('cards');
  }, [isMobile]);
  
  // Adjustment modal state
  const [adjustmentModal, setAdjustmentModal] = useState<{
    open: boolean;
    product: Product | null;
    type: 'add' | 'remove' | 'adjust';
  }>({ open: false, product: null, type: 'add' });
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);

  const categories = Constants.public.Enums.product_category;

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: t('common.error'),
        description: t('inventory.loadError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    
    // Écouter les changements en temps réel sur la table products
    const channel = supabase
      .channel('inventory-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('🔄 Inventory updated:', payload);
          fetchProducts();
        }
      )
      .subscribe();
    
    // Auto-refresh every 30 seconds as backup
    const interval = setInterval(fetchProducts, 30000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getStockDisplay = (product: Product) => {
    // Arrondi à 2 décimales pour éviter les erreurs de virgule flottante
    const round2 = (val: number) => Math.round(val * 100) / 100;
    
    // Céramique: utiliser stock_boite seulement si > 0 et surface_par_boite défini
    if (product.category === 'ceramique' && product.stock_boite !== null && product.stock_boite > 0 && product.surface_par_boite) {
      const m2 = round2(product.stock_boite * product.surface_par_boite);
      return { value: m2, unit: 'm²', raw: product.stock_boite };
    }
    // Fer: utiliser stock_barre seulement si > 0
    if (product.category === 'fer' && product.stock_barre !== null && product.stock_barre > 0) {
      return { value: product.stock_barre, unit: t('inventory.unitBars'), raw: product.stock_barre };
    }
    // Par défaut: utiliser quantity
    return { value: product.quantity, unit: product.unit || t('inventory.unitDefault'), raw: product.quantity };
  };

  const getStockStatus = (product: Product) => {
    const stock = getStockDisplay(product);
    if (stock.value <= 0) return 'rupture';
    if (stock.value <= product.alert_threshold) return 'alerte';
    if (stock.value > product.alert_threshold * 3) return 'eleve';
    return 'normal';
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter(p => {
        // Search filter
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        // Category filter
        if (selectedCategory !== 'all' && p.category !== selectedCategory) {
          return false;
        }
        // Stock level filter
        if (stockLevel !== 'all' && getStockStatus(p) !== stockLevel) {
          return false;
        }
        // Status filter
        if (statusFilter === 'active' && !p.is_active) return false;
        if (statusFilter === 'inactive' && p.is_active) return false;
        
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'quantity':
            comparison = getStockDisplay(a).value - getStockDisplay(b).value;
            break;
          case 'category':
            comparison = a.category.localeCompare(b.category);
            break;
          case 'price':
            comparison = a.price - b.price;
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [products, searchQuery, selectedCategory, stockLevel, statusFilter, sortField, sortDirection]);

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

  // Reset page when filters change
  useEffect(() => {
    resetPage();
  }, [searchQuery, selectedCategory, stockLevel, statusFilter]);

  const stats = useMemo(() => {
    let totalValueUSD = 0;
    let totalValueHTG = 0;
    
    products.forEach(p => {
      const stock = getStockDisplay(p);
      const value = stock.value * p.price;
      if (p.currency === 'USD') {
        totalValueUSD += value;
      } else {
        totalValueHTG += value;
      }
    });
    
    const ruptureCount = products.filter(p => getStockStatus(p) === 'rupture').length;
    const alerteCount = products.filter(p => getStockStatus(p) === 'alerte').length;
    
    return { totalValueUSD, totalValueHTG, ruptureCount, alerteCount, totalProducts: products.length };
  }, [products]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const openAdjustmentModal = (product: Product, type: 'add' | 'remove' | 'adjust') => {
    setAdjustmentModal({ open: true, product, type });
    setAdjustmentQuantity('');
    setAdjustmentReason('');
  };

  const handleAdjustment = async () => {
    if (!adjustmentModal.product || !adjustmentQuantity || !adjustmentReason) {
      toast({
        title: t('common.error'),
        description: t('inventory.fillAllFields'),
        variant: 'destructive'
      });
      return;
    }

    setAdjustmentLoading(true);
    try {
      const product = adjustmentModal.product;
      const qty = parseFloat(adjustmentQuantity);
      const stock = getStockDisplay(product);
      const { data: { user } } = await supabase.auth.getUser();
      
      let newQuantity: number;
      let movementType: string;
      
      switch (adjustmentModal.type) {
        case 'add':
          newQuantity = stock.raw + qty;
          movementType = 'in';
          break;
        case 'remove':
          newQuantity = Math.max(0, stock.raw - qty);
          movementType = 'out';
          break;
        case 'adjust':
          newQuantity = qty;
          movementType = 'adjustment';
          break;
        default:
          return;
      }

      // Update the appropriate stock field
      const updateData: any = {};
      if (product.category === 'ceramique') {
        updateData.stock_boite = newQuantity;
      } else if (product.category === 'fer') {
        updateData.stock_barre = newQuantity;
      } else {
        updateData.quantity = newQuantity;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id);

      if (updateError) throw updateError;

      // Record stock movement
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          company_id: profile?.company_id || '',
          product_id: product.id,
          movement_type: movementType,
          quantity: qty,
          previous_quantity: stock.raw,
          new_quantity: newQuantity,
          reason: adjustmentReason,
          created_by: user?.id
        });

      if (movementError) console.error('Error recording movement:', movementError);

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action_type: 'stock_adjusted',
        entity_type: 'product',
        entity_id: product.id,
        description: `Stock ajusté pour "${product.name}": ${stock.raw} → ${newQuantity} ${stock.unit}`,
        metadata: {
          product_name: product.name,
          previous_stock: stock.raw,
          new_stock: newQuantity,
          difference: newQuantity - stock.raw,
          unit: stock.unit,
          reason: adjustmentReason,
          adjustment_type: adjustmentModal.type
        }
      });

      toast({
        title: t('inventory.stockUpdated'),
        description: t('inventory.stockUpdatedDesc', { name: product.name }),
      });

      setAdjustmentModal({ open: false, product: null, type: 'add' });
      fetchProducts();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast({
        title: t('common.error'),
        description: t('inventory.updateError'),
        variant: 'destructive'
      });
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const exportToExcel = () => {
    if (isFreePlan) { toast({ title: t('inventory.premiumFeature'), description: t('inventory.premiumExports'), variant: "destructive" }); return; }
    const data = filteredProducts.map(p => {
      const stock = getStockDisplay(p);
      return {
        [t('inventory.product')]: p.name,
        [t('inventory.category')]: p.category,
        [t('inventory.stock')]: stock.value,
        [t('common.unit') !== 'common.unit' ? t('common.unit') : 'Unit']: stock.unit,
        [t('inventory.alertThreshold')]: p.alert_threshold,
        [t('common.salePrice') !== 'common.salePrice' ? t('common.salePrice') : 'Sale price']: p.price,
        [t('common.purchasePrice') !== 'common.purchasePrice' ? t('common.purchasePrice') : 'Purchase price']: p.purchase_price || 'N/A',
        [t('common.stockValue') !== 'common.stockValue' ? t('common.stockValue') : 'Stock value']: stock.value * p.price,
        [t('inventory.stockStatus')]: getStockStatus(p),
        [t('common.active')]: p.is_active ? t('common.yes') : t('common.no')
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('inventory.titleShort'));
    XLSX.writeFile(wb, `inventaire_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
  };

  const exportToPDF = async () => {
    if (isFreePlan) { toast({ title: t('inventory.premiumFeature'), description: t('inventory.premiumExports'), variant: "destructive" }); return; }
    const { data: settings } = await supabase
      .from('companies')
      .select('*')
      .limit(1)
      .single();
    
    if (!settings) {
      toast({
        title: t('common.error'),
        description: t('inventory.settingsUnavailable'),
        variant: 'destructive'
      });
      return;
    }

    const pdfProducts = filteredProducts.map(p => {
      const stock = getStockDisplay(p);
      return {
        name: p.name,
        category: p.category,
        stockValue: stock.value,
        stockUnit: stock.unit,
        alertThreshold: p.alert_threshold,
        status: getStockStatus(p),
        price: p.price,
        stockTotalValue: stock.value * p.price,
        currency: p.currency || 'HTG'
      };
    });

    generateInventoryStockPDF(pdfProducts, { ...settings, company_name: settings.name } as unknown as CompanySettings, {
      totalValueUSD: stats.totalValueUSD,
      totalValueHTG: stats.totalValueHTG,
      alertProducts: stats.alerteCount,
      ruptureProducts: stats.ruptureCount,
      totalProducts: stats.totalProducts
    });

    toast({
      title: t('inventory.exportSuccess'),
      description: t('inventory.pdfDownloaded')
    });
  };

  const formatCurrencyValue = (amount: number, currency: 'USD' | 'HTG' = 'HTG') => {
    const formatted = new Intl.NumberFormat('fr-FR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
    return currency === 'USD' ? `$${formatted}` : `${formatted} HTG`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rupture':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> {t('inventory.badgeRupture')}</Badge>;
      case 'alerte':
        return <Badge variant="outline" className="flex items-center gap-1 border-orange-500 text-orange-500"><AlertTriangle className="w-3 h-3" /> {t('inventory.badgeAlerte')}</Badge>;
      case 'eleve':
        return <Badge variant="outline" className="flex items-center gap-1 border-blue-500 text-blue-500"><CheckCircle className="w-3 h-3" /> {t('inventory.badgeEleve')}</Badge>;
      default:
        return <Badge variant="secondary" className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t('inventory.badgeNormal')}</Badge>;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Warehouse className="w-5 h-5 sm:w-7 sm:h-7" />
            <span className="hidden sm:inline">{t('inventory.title')}</span>
            <span className="sm:hidden">{t('inventory.titleShort')}</span>
          </h2>
          <p className="text-xs sm:text-base text-muted-foreground">{t('inventory.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={fetchProducts} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-8 sm:h-9 text-xs sm:text-sm" onClick={exportToExcel}>
            {isFreePlan ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> : <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />}
            <span className="hidden sm:inline">Excel</span>
            <span className="sm:hidden">XLS</span>
          </Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-8 sm:h-9 text-xs sm:text-sm" onClick={exportToPDF}>
            {isFreePlan ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> : <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />}
            PDF
          </Button>
        </div>
      </div>

      {/* Tabs for switching between standard and quick inventory */}
      <Tabs defaultValue="standard" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 h-8 sm:h-9">
          <TabsTrigger value="standard" className="gap-2">
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">{t('inventory.tabStandard')}</span>
          </TabsTrigger>
          <TabsTrigger value="quick" className="gap-2">
            <ScanLine className="w-4 h-4" />
            <span className="hidden sm:inline">{t('inventory.quickMode')}</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">{t('inventory.history')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Quick Inventory Tab */}
        <TabsContent value="quick" className="mt-6">
          <QuickInventoryMode />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <InventoryHistory />
        </TabsContent>

        {/* Standard Inventory Tab */}
        <TabsContent value="standard" className="mt-3 sm:mt-6 space-y-3 sm:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-[10px] sm:text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                        <span className="hidden sm:inline">{t('inventory.estimatedValue')}</span>
                        <span className="sm:hidden">{t('inventory.valueShort')}</span>
                        <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{t('inventory.estimatedValueTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex flex-col">
                  {stats.totalValueHTG > 0 && (
                    <p className="text-sm sm:text-xl font-bold truncate">{formatNumber(stats.totalValueHTG)} HTG</p>
                  )}
                  {stats.totalValueUSD > 0 && (
                    <p className="text-[10px] sm:text-sm text-green-600">${formatNumber(stats.totalValueUSD)}</p>
                  )}
                </div>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-primary opacity-50 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">{t('inventory.products')}</p>
                <p className="text-sm sm:text-xl font-bold">{stats.totalProducts}</p>
              </div>
              <Package className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className={stats.alerteCount > 0 ? 'border-orange-500' : ''}>
          <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">{t('inventory.inAlert')}</p>
                <p className="text-sm sm:text-xl font-bold text-orange-500">{stats.alerteCount}</p>
              </div>
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className={stats.ruptureCount > 0 ? 'border-destructive' : ''}>
          <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">{t('inventory.outOfStockCount')}</p>
                <p className="text-sm sm:text-xl font-bold text-destructive">{stats.ruptureCount}</p>
              </div>
              <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-destructive opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-3 sm:pt-6 px-3 sm:px-6">
          <div className="flex flex-col gap-2 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
              <Input
                placeholder={t('inventory.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-9 h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder={t('inventory.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inventory.allCategories')}</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockLevel} onValueChange={(v) => setStockLevel(v as StockLevel)}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder={t('inventory.stock')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inventory.allStocks')}</SelectItem>
                  <SelectItem value="rupture">{t('inventory.stockLevelRupture')}</SelectItem>
                  <SelectItem value="alerte">{t('inventory.stockLevelAlerte')}</SelectItem>
                  <SelectItem value="normal">{t('inventory.stockLevelNormal')}</SelectItem>
                  <SelectItem value="eleve">{t('inventory.stockLevelEleve')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue placeholder={t('inventory.stockStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inventory.allStocks')}</SelectItem>
                  <SelectItem value="active">{t('inventory.statusActive')}</SelectItem>
                  <SelectItem value="inactive">{t('inventory.statusInactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table/Cards */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              {t('inventory.productCount', { count: filteredProducts.length })}
              {selectedProducts.size > 0 && (
                <Badge variant="secondary" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">
                  {selectedProducts.size} {t('inventory.selectedShort')}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button 
                variant={viewMode === 'table' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setViewMode('table')}
                className="hidden sm:flex h-7 sm:h-8 text-xs"
              >
                <List className="w-3.5 h-3.5 mr-1" />
                {t('inventory.table')}
              </Button>
              <Button 
                variant={viewMode === 'cards' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setViewMode('cards')}
                className="h-7 sm:h-8 text-xs"
              >
                <LayoutGrid className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">{t('inventory.cards')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {/* Cards View */}
          {viewMode === 'cards' && (
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : paginatedProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('inventory.noProductsFound')}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedProducts.map(product => {
                    const stock = getStockDisplay(product);
                    const status = getStockStatus(product);
                    
                    return (
                      <Card 
                        key={product.id} 
                        className={`relative ${!product.is_active ? 'opacity-50' : ''} ${
                          status === 'rupture' ? 'border-destructive' : 
                          status === 'alerte' ? 'border-orange-500' : ''
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{product.name}</h3>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge variant="outline" className="text-xs">{product.category}</Badge>
                                {!product.is_active && (
                                  <Badge variant="outline" className="text-xs">{t('inventory.inactive')}</Badge>
                                )}
                              </div>
                            </div>
                            {getStatusBadge(status)}
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">{t('inventory.stock')}</span>
                              <span className={`font-mono font-semibold ${
                                status === 'rupture' ? 'text-destructive' :
                                status === 'alerte' ? 'text-orange-500' : ''
                              }`}>
                                {stock.value.toFixed(stock.unit === 'm²' ? 2 : 0)} {stock.unit}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">{t('inventory.alertThreshold')}</span>
                              <span className="text-sm">{product.alert_threshold}</span>
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-1 mt-4 pt-3 border-t">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openAdjustmentModal(product, 'add')}
                            >
                              <Plus className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openAdjustmentModal(product, 'remove')}
                            >
                              <Minus className="w-4 h-4 text-red-500" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openAdjustmentModal(product, 'adjust')}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <ScrollArea className="h-[500px]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 hidden sm:table-cell">
                        <Checkbox
                          checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                          onCheckedChange={toggleAllSelection}
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-1">
                          {t('inventory.product')}
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hidden md:table-cell" onClick={() => handleSort('category')}>
                        <div className="flex items-center gap-1">
                          {t('inventory.category')}
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleSort('quantity')}>
                        <div className="flex items-center justify-end gap-1">
                          {t('inventory.stock')}
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right hidden sm:table-cell">{t('inventory.thresholdShort')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('inventory.stockStatus')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : paginatedProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {t('inventory.noProductsFound')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedProducts.map(product => {
                        const stock = getStockDisplay(product);
                        const status = getStockStatus(product);
                        
                        return (
                          <TableRow 
                            key={product.id} 
                            className={!product.is_active ? 'opacity-50' : ''}
                          >
                            <TableCell className="hidden sm:table-cell">
                              <Checkbox
                                checked={selectedProducts.has(product.id)}
                                onCheckedChange={() => toggleProductSelection(product.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{product.name}</span>
                                {!product.is_active && (
                                  <Badge variant="outline" className="mt-1 text-xs w-fit">{t('inventory.inactive')}</Badge>
                                )}
                                <div className="flex flex-wrap gap-1 mt-1 md:hidden">
                                  <Badge variant="outline" className="text-xs">{product.category}</Badge>
                                  {getStatusBadge(status)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge variant="outline">{product.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={
                                status === 'rupture' ? 'text-destructive font-bold' :
                                status === 'alerte' ? 'text-orange-500 font-semibold' : ''
                              }>
                                {stock.value.toFixed(stock.unit === 'm²' ? 2 : 0)}
                              </span>
                              <span className="text-muted-foreground text-sm ml-1">{stock.unit}</span>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                              {product.alert_threshold}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {getStatusBadge(status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openAdjustmentModal(product, 'add')}
                                  title={t('inventory.actionAdd')}
                                >
                                  <Plus className="w-4 h-4 text-green-500" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openAdjustmentModal(product, 'remove')}
                                  title={t('inventory.actionRemove')}
                                >
                                  <Minus className="w-4 h-4 text-red-500" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openAdjustmentModal(product, 'adjust')}
                                  title={t('inventory.actionAdjust')}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
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
      </Card>

      {/* Adjustment Modal */}
      <Dialog open={adjustmentModal.open} onOpenChange={(open) => !open && setAdjustmentModal({ open: false, product: null, type: 'add' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adjustmentModal.type === 'add' && t('inventory.addStock')}
              {adjustmentModal.type === 'remove' && t('inventory.removeStock')}
              {adjustmentModal.type === 'adjust' && t('inventory.adjustStock')}
            </DialogTitle>
          </DialogHeader>
          
          {adjustmentModal.product && (() => {
            const product = adjustmentModal.product;
            const isCeramic = product.category === 'ceramique';
            const isIron = product.category === 'fer';
            
            // Unité d'entrée: boîtes pour céramique, barres pour fer, unité standard sinon
            const inputUnit = isCeramic ? t('inventory.unitBoxes') : (isIron ? t('inventory.unitBars') : (product.unit || t('inventory.unitDefault')));
            const currentRaw = isCeramic && product.stock_boite !== null && product.stock_boite > 0 
              ? product.stock_boite 
              : (isIron && product.stock_barre !== null && product.stock_barre > 0 
                ? product.stock_barre 
                : product.quantity);
            
            // Calcul du stock affiché (m² pour céramique)
            const displayStock = getStockDisplay(product);
            const qty = parseFloat(adjustmentQuantity || '0');
            
            const getNewRaw = () => {
              if (adjustmentModal.type === 'add') return currentRaw + qty;
              if (adjustmentModal.type === 'remove') return Math.max(0, currentRaw - qty);
              return qty;
            };
            
            const newRaw = getNewRaw();
            const newDisplay = isCeramic && product.surface_par_boite 
              ? newRaw * product.surface_par_boite 
              : newRaw;
            
            return (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('inventory.currentStock')}: {currentRaw.toFixed(2)} {inputUnit}
                    {isCeramic && product.surface_par_boite && (
                      <span className="ml-1">({displayStock.value.toFixed(2)} m²)</span>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">
                    {adjustmentModal.type === 'adjust' ? t('inventory.newQuantity') : t('inventory.quantity')} ({inputUnit})
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    value={adjustmentQuantity}
                    onChange={(e) => setAdjustmentQuantity(e.target.value)}
                    placeholder={adjustmentModal.type === 'adjust' ? t('inventory.quantityPlaceholderAdjust') : t('inventory.quantityPlaceholderAdd')}
                  />
                  {isCeramic && product.surface_par_boite && (
                    <p className="text-xs text-muted-foreground">
                      {t('inventory.boxEqualsM2', { value: product.surface_par_boite })}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">{t('inventory.reasonRequired')}</Label>
                  <Textarea
                    id="reason"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder={t('inventory.reasonPlaceholder')}
                    rows={3}
                  />
                </div>

                {adjustmentQuantity && (
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm">
                      {t('inventory.newStock')}: <span className="font-bold">{newRaw.toFixed(2)}</span> {inputUnit}
                      {isCeramic && product.surface_par_boite && (
                        <span className="ml-1">(<span className="font-bold">{newDisplay.toFixed(2)}</span> m²)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentModal({ open: false, product: null, type: 'add' })}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAdjustment} disabled={adjustmentLoading || !adjustmentQuantity || !adjustmentReason}>
              {adjustmentLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};
