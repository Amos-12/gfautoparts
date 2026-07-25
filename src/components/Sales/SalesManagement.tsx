import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Search, TrendingUp, Calendar, Eye, Trash2, Receipt, DollarSign, LayoutGrid, List, Download, FileText, Users, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { SaleDetailsDialog } from './SaleDetailsDialog';
import { SaleCard } from './SaleCard';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { useIsMobile } from '@/hooks/use-mobile';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { useCurrencyCalculations, currencyUtils } from '@/hooks/useCurrencyCalculations';
import { useCompanySettings } from '@/hooks/useCompanySettings';

import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';

interface Seller {
  user_id: string;
  full_name: string;
}

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  seller_id: string;
  profiles?: {
    full_name: string;
  };
  currencies?: {
    htg: number;
    usd: number;
  };
}

interface RevenueStats {
  totalHTG: number;
  totalUSD: number;
  todayHTG: number;
  todayUSD: number;
}

interface TvaStats {
  totalTVA_HTG: number;
  totalTVA_USD: number;
  todayTVA_HTG: number;
  todayTVA_USD: number;
}

const formatNumber = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatCompactNumber = (amount: number, isMobile: boolean): string => {
  if (!isMobile) return formatNumber(amount);
  
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1) + 'M';
  } else if (amount >= 1000) {
    return (amount / 1000).toFixed(1) + 'K';
  }
  return amount.toFixed(0);
};

export const SalesManagement = () => {
  // Centralized hooks
  const { settings: companySettingsHook } = useCompanySettings();
  const currencyCalc = useCurrencyCalculations();
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'HTG' | 'USD' | 'mixed'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({ totalHTG: 0, totalUSD: 0, todayHTG: 0, todayUSD: 0 });
  const [tvaStats, setTvaStats] = useState<TvaStats>({ totalTVA_HTG: 0, totalTVA_USD: 0, todayTVA_HTG: 0, todayTVA_USD: 0 });
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const isMobile = useIsMobile();

  // Auto-switch to cards on mobile
  useEffect(() => {
    if (isMobile) {
      setViewMode('cards');
    }
  }, [isMobile]);

  // Helper function to filter by period
  const filterByPeriod = (saleDate: Date, filter: 'all' | 'today' | 'week' | 'month'): boolean => {
    if (filter === 'all') return true;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const saleDay = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
    
    if (filter === 'today') {
      return saleDay.getTime() === today.getTime();
    }
    
    if (filter === 'week') {
      // Start of week (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - diffToMonday);
      return saleDay >= startOfWeek;
    }
    
    if (filter === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return saleDay >= startOfMonth;
    }
    
    return true;
  };

  const { 
    paginatedItems: paginatedSales, 
    currentPage, 
    totalPages, 
    totalItems, 
    pageSize, 
    nextPage, 
    prevPage, 
    hasNextPage, 
    hasPrevPage,
    resetPage
  } = usePagination(filteredSales, 20);

  useEffect(() => {
    fetchSales();
    fetchCompanySettings();
    fetchSellers();
    checkAdminRole();
  }, []);

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();
    if (data) {
      setCompanySettings(data);
    }
  };

  const fetchSellers = async () => {
    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('is_active', true);
      
      if (!rolesData) return;
      
      const userIds = rolesData.map(r => r.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      if (profilesData) {
        setSellers(profilesData);
      }
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  useEffect(() => {
    let filtered = sales.filter(sale =>
      sale.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply currency filter
    if (currencyFilter !== 'all') {
      filtered = filtered.filter(sale => {
        const currencies = sale.currencies || { htg: 0, usd: 0 };
        if (currencyFilter === 'HTG') {
          return currencies.htg > 0 && currencies.usd === 0;
        } else if (currencyFilter === 'USD') {
          return currencies.usd > 0 && currencies.htg === 0;
        } else if (currencyFilter === 'mixed') {
          return currencies.htg > 0 && currencies.usd > 0;
        }
        return true;
      });
    }

    // Apply period filter
    if (periodFilter !== 'all') {
      filtered = filtered.filter(sale => filterByPeriod(new Date(sale.created_at), periodFilter));
    }

    // Apply seller filter
    if (sellerFilter !== 'all') {
      filtered = filtered.filter(sale => sale.seller_id === sellerFilter);
    }

    setFilteredSales(filtered);
    resetPage();
  }, [searchTerm, currencyFilter, periodFilter, sellerFilter, sales]);

  const fetchSales = async () => {
    try {
      // Fetch sales, items and settings in parallel for better performance
      const [salesResult, itemsResult, settingsResult] = await Promise.all([
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('sale_items').select('sale_id, subtotal, currency'),
        supabase.from('company_settings').select('tva_rate').single()
      ]);

      if (salesResult.error) throw salesResult.error;
      
      const salesData = salesResult.data || [];
      const allItems = itemsResult.data || [];
      const tvaRate = settingsResult.data?.tva_rate || 0;

      // Build a map of sale_id -> currencies (HT amounts from items)
      const saleItemsMap = new Map<string, { htg: number; usd: number }>();
      allItems.forEach(item => {
        const existing = saleItemsMap.get(item.sale_id) || { htg: 0, usd: 0 };
        if (item.currency === 'USD') {
          existing.usd += item.subtotal;
        } else {
          existing.htg += item.subtotal;
        }
        saleItemsMap.set(item.sale_id, existing);
      });

      // Batch fetch all seller profiles at once instead of individual queries
      const uniqueSellerIds = [...new Set(salesData.map(s => s.seller_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', uniqueSellerIds);
      
      // Create a map for quick profile lookup
      const profilesMap = new Map<string, string>();
      (profilesData || []).forEach(p => {
        profilesMap.set(p.user_id, p.full_name);
      });

      // Process sales with pre-fetched data (no more individual queries)
      const salesWithSellers = salesData.map(sale => {
        const rawCurrencies = saleItemsMap.get(sale.id) || { htg: 0, usd: 0 };
        const totalRaw = rawCurrencies.htg + rawCurrencies.usd;
        
        // Apply discount proportionally to each currency
        const discountRatio = totalRaw > 0 ? (sale.discount_amount || 0) / totalRaw : 0;
        const htgAfterDiscount = rawCurrencies.htg * (1 - discountRatio);
        const usdAfterDiscount = rawCurrencies.usd * (1 - discountRatio);
        
        // Add TVA to get TTC amounts
        const currencies = {
          htg: htgAfterDiscount * (1 + tvaRate / 100),
          usd: usdAfterDiscount * (1 + tvaRate / 100)
        };
        
        return {
          ...sale,
          profiles: { full_name: profilesMap.get(sale.seller_id) || 'N/A' },
          currencies
        };
      });

      setSales(salesWithSellers as Sale[]);

      // Calculate revenue by currency
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const stats: RevenueStats = { totalHTG: 0, totalUSD: 0, todayHTG: 0, todayUSD: 0 };
      
      salesData.forEach(sale => {
        const currencies = saleItemsMap.get(sale.id) || { htg: 0, usd: 0 };
        // Calculate HT after discount
        const totalRaw = currencies.htg + currencies.usd;
        const discountRatio = totalRaw > 0 ? (sale.discount_amount || 0) / totalRaw : 0;
        stats.totalHTG += currencies.htg * (1 - discountRatio);
        stats.totalUSD += currencies.usd * (1 - discountRatio);
        
        const saleDate = new Date(sale.created_at);
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate.getTime() === today.getTime()) {
          stats.todayHTG += currencies.htg * (1 - discountRatio);
          stats.todayUSD += currencies.usd * (1 - discountRatio);
        }
      });
      
      setRevenueStats(stats);
      
      // Calculate TVA stats
      setTvaStats({
        totalTVA_HTG: stats.totalHTG * tvaRate / 100,
        totalTVA_USD: stats.totalUSD * tvaRate / 100,
        todayTVA_HTG: stats.todayHTG * tvaRate / 100,
        todayTVA_USD: stats.todayUSD * tvaRate / 100
      });

    } catch (error) {
      console.error('Error fetching sales:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les ventes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkAdminRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const { data, error } = await supabase.functions.invoke('delete-sale', {
        body: { saleId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erreur lors de la suppression');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erreur lors de la suppression');
      }

      toast({
        title: "Vente supprimée",
        description: data.message || `${data.restoredProducts || 0} produit(s) remis en stock`,
      });

      // Recharger la liste
      fetchSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer la vente",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Dynamic stats based on filtered sales - using centralized calculation logic
  const filteredStats = useMemo(() => {
    let htg = 0;
    let usd = 0;
    let tvaHtg = 0;
    let tvaUsd = 0;
    const tvaRate = companySettingsHook?.tvaRate || companySettings?.tva_rate || 0;
    const rate = companySettingsHook?.usdHtgRate || companySettings?.usd_htg_rate || 132;
    const displayCurrency = companySettingsHook?.displayCurrency || (companySettings?.default_display_currency || 'HTG') as 'USD' | 'HTG';
    
    filteredSales.forEach(sale => {
      htg += sale.currencies?.htg || 0;
      usd += sale.currencies?.usd || 0;
    });
    
    // TVA is already included in currencies (TTC), so calculate HT first then TVA
    const htgHT = htg / (1 + tvaRate / 100);
    const usdHT = usd / (1 + tvaRate / 100);
    tvaHtg = htg - htgHT;
    tvaUsd = usd - usdHT;
    
    // Unified total converted to display currency using currencyUtils
    const unifiedTotal = displayCurrency === 'HTG'
      ? htg + (usd * rate)
      : usd + (htg / rate);
    
    const unifiedTva = displayCurrency === 'HTG'
      ? tvaHtg + (tvaUsd * rate)
      : tvaUsd + (tvaHtg / rate);
    
    return {
      count: filteredSales.length,
      htg,
      usd,
      tvaHtg,
      tvaUsd,
      unifiedTotal,
      unifiedTva,
      displayCurrency
    };
  }, [filteredSales, companySettings, companySettingsHook]);


  // Export functions
  const exportToExcel = () => {
    const rate = companySettings?.usd_htg_rate || 132;
    const displayCurrency = (companySettings?.default_display_currency || 'HTG') as 'USD' | 'HTG';
    
    const data = filteredSales.map(sale => {
      const htg = sale.currencies?.htg || 0;
      const usd = sale.currencies?.usd || 0;
      const convertedTotal = displayCurrency === 'HTG' 
        ? htg + (usd * rate)
        : usd + (htg / rate);
      
      return {
        'Date': formatDate(sale.created_at),
        'Client': sale.customer_name || 'Non renseigné',
        'Vendeur': sale.profiles?.full_name || 'N/A',
        [`Total (${displayCurrency})`]: convertedTotal.toFixed(2),
        'Montant HTG': htg.toFixed(2),
        'Montant USD': usd.toFixed(2),
        'Paiement': sale.payment_method
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventes');
    XLSX.writeFile(wb, `ventes_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({ title: "Export Excel", description: `${filteredSales.length} ventes exportées` });
  };

  const exportToPDF = async () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPos = 15;
    
    // Load logo if available
    if (companySettings?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = companySettings.logo_url;
        });
        pdf.addImage(img, 'PNG', 15, yPos, 30, 30);
      } catch (e) {
        console.log('Logo loading failed');
      }
    }
    
    // Company info - right side
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(companySettings?.company_name || 'Entreprise', pageWidth - 15, yPos + 5, { align: 'right' });
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(companySettings?.address || '', pageWidth - 15, yPos + 12, { align: 'right' });
    pdf.text(companySettings?.city || '', pageWidth - 15, yPos + 17, { align: 'right' });
    pdf.text(`Tél: ${companySettings?.phone || ''}`, pageWidth - 15, yPos + 22, { align: 'right' });
    pdf.text(companySettings?.email || '', pageWidth - 15, yPos + 27, { align: 'right' });
    
    yPos = 55;
    
    // Title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RAPPORT DES VENTES', pageWidth / 2, yPos, { align: 'center' });
    
    // Period info
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const periodLabels: Record<string, string> = {
      all: 'Toutes les ventes',
      today: "Aujourd'hui",
      week: 'Cette semaine',
      month: 'Ce mois'
    };
    pdf.text(`Période: ${periodLabels[periodFilter]} | Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, yPos, { align: 'center' });
    
    // Stats box
    yPos += 12;
    pdf.setFillColor(245, 245, 245);
    pdf.roundedRect(15, yPos, pageWidth - 30, 22, 3, 3, 'F');
    
    const displayCurrency = filteredStats.displayCurrency;
    const currencySymbol = displayCurrency === 'USD' ? '$' : '';
    const currencySuffix = displayCurrency === 'HTG' ? ' HTG' : '';
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    yPos += 8;
    pdf.text(`Ventes: ${filteredStats.count}`, 25, yPos);
    pdf.text(`Total: ${currencySymbol}${formatNumber(filteredStats.unifiedTotal)}${currencySuffix}`, 70, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`TVA: ${currencySymbol}${formatNumber(filteredStats.unifiedTva)}${currencySuffix}`, 70, yPos);
    pdf.text(`(HTG: ${formatNumber(filteredStats.htg)} | USD: $${formatNumber(filteredStats.usd)})`, 130, yPos);
    
    // Table header
    yPos += 18;
    pdf.setFillColor(50, 50, 50);
    pdf.setTextColor(255, 255, 255);
    pdf.roundedRect(15, yPos - 5, pageWidth - 30, 8, 1, 1, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Date', 20, yPos);
    pdf.text('Client', 55, yPos);
    pdf.text('Vendeur', 100, yPos);
    pdf.text(`Montant (${displayCurrency})`, 145, yPos);
    pdf.text('Paiement', 175, yPos);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    yPos += 10;
    
    const rate = companySettings?.usd_htg_rate || 132;
    
    // Table rows
    filteredSales.slice(0, 35).forEach((sale, index) => {
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
      
      // Alternate row background
      if (index % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(15, yPos - 4, pageWidth - 30, 7, 'F');
      }
      
      pdf.text(formatDate(sale.created_at).substring(0, 16), 20, yPos);
      pdf.text((sale.customer_name || 'N/A').substring(0, 18), 55, yPos);
      pdf.text((sale.profiles?.full_name || 'N/A').substring(0, 16), 100, yPos);
      
      // Convert amount to display currency
      const htg = sale.currencies?.htg || 0;
      const usd = sale.currencies?.usd || 0;
      const convertedAmount = displayCurrency === 'HTG' ? htg + (usd * rate) : usd + (htg / rate);
      const amount = `${currencySymbol}${formatNumber(convertedAmount).substring(0, 12)}${currencySuffix}`;
      pdf.text(amount, 145, yPos);
      pdf.text(sale.payment_method.substring(0, 10), 175, yPos);
      
      yPos += 7;
    });
    
    if (filteredSales.length > 35) {
      pdf.setFont('helvetica', 'italic');
      pdf.text(`... et ${filteredSales.length - 35} autres ventes`, 20, yPos + 5);
    }
    
    // Footer
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Généré par ${companySettings?.company_name || 'Système'} - ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    pdf.save(`rapport_ventes_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: "Export PDF", description: `Rapport généré avec ${filteredSales.length} ventes` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ShoppingCart className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }


  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with currency indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-2xl font-bold text-foreground">Gestion des Ventes</h2>
        <Badge 
          variant="outline" 
          className={`text-xs px-2 py-0.5 ${
            filteredStats.displayCurrency === 'USD' 
              ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' 
              : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
          }`}
        >
          Affichage: {filteredStats.displayCurrency === 'USD' ? '$ USD' : 'HTG'}
        </Badge>
      </div>

      {/* Stats Cards - Dynamic based on filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Ventes</p>
                <p className="text-sm sm:text-base md:text-lg font-bold">{filteredStats.count}</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-primary/30">
          <CardContent className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Revenu Total</p>
                <p className="text-sm sm:text-base md:text-lg font-bold truncate text-primary">
                  {filteredStats.displayCurrency === 'USD' 
                    ? `$${formatCompactNumber(filteredStats.unifiedTotal, isMobile)}`
                    : `${formatCompactNumber(filteredStats.unifiedTotal, isMobile)} HTG`
                  }
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {companySettings?.tva_rate > 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-2 sm:p-3 md:p-4">
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">TVA ({companySettings.tva_rate}%)</p>
                  <p className="text-sm sm:text-base md:text-lg font-bold truncate">
                    {filteredStats.displayCurrency === 'USD'
                      ? `$${formatCompactNumber(filteredStats.unifiedTva, isMobile)}`
                      : `${formatCompactNumber(filteredStats.unifiedTva, isMobile)} HTG`
                    }
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sales Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Historique des Ventes
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel} className="h-8">
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="h-8">
                <FileText className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client ou vendeur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 items-center overflow-x-auto pb-1">
              {/* Period filter */}
              <Select value={periodFilter} onValueChange={(value: 'all' | 'today' | 'week' | 'month') => setPeriodFilter(value)}>
                <SelectTrigger className="w-[90px] sm:w-[130px] shrink-0 h-9">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout</SelectItem>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Seller filter */}
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger className="w-[85px] sm:w-[140px] shrink-0 h-9">
                  <Users className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Vendeur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {sellers.map(seller => (
                    <SelectItem key={seller.user_id} value={seller.user_id}>
                      {seller.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Currency filter */}
              <Select value={currencyFilter} onValueChange={(value: 'all' | 'HTG' | 'USD' | 'mixed') => setCurrencyFilter(value)}>
                <SelectTrigger className="w-[80px] sm:w-[110px] shrink-0 h-9">
                  <DollarSign className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Devise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute</SelectItem>
                  <SelectItem value="HTG">HTG</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="mixed">Mixte</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Reset filters button */}
              {(searchTerm || periodFilter !== 'all' || sellerFilter !== 'all' || currencyFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2.5 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchTerm('');
                    setPeriodFilter('all');
                    setSellerFilter('all');
                    setCurrencyFilter('all');
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline text-xs">Reset</span>
                </Button>
              )}
              
              {/* View toggle - desktop only */}
              {!isMobile && (
                <div className="flex border rounded-md overflow-hidden shrink-0">
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none h-9 px-2.5"
                    onClick={() => setViewMode('table')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none h-9 px-2.5"
                    onClick={() => setViewMode('cards')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Card view for mobile or when selected */}
          {viewMode === 'cards' ? (
            <div className="space-y-2">
              {paginatedSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>Aucune vente trouvée</p>
                </div>
              ) : (
                paginatedSales.map((sale, index) => (
                  <SaleCard
                    key={sale.id}
                    sale={sale}
                    isAdmin={isAdmin}
                    showSwipeHint={index === 0}
                    onView={(id) => {
                      setSelectedSaleId(id);
                      setDialogOpen(true);
                    }}
                    onDelete={handleDeleteSale}
                  />
                ))
              )}
            </div>
          ) : (
            /* Table view for desktop */
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden md:table-cell">Vendeur</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead className="hidden sm:table-cell">Paiement</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucune vente trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {formatDate(sale.created_at)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {sale.customer_name || <span className="text-muted-foreground italic">Non renseigné</span>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                          {sale.profiles?.full_name || <span className="text-muted-foreground italic">N/A</span>}
                        </TableCell>
                        <TableCell className="font-bold text-xs sm:text-sm">
                          <div className="flex flex-col">
                            {sale.currencies?.htg ? (
                              <span>{formatNumber(sale.currencies.htg)} HTG</span>
                            ) : null}
                            {sale.currencies?.usd ? (
                              <span className="text-muted-foreground text-xs">${formatNumber(sale.currencies.usd)}</span>
                            ) : null}
                            {!sale.currencies?.htg && !sale.currencies?.usd && (
                              <span>{formatNumber(sale.total_amount)} HTG</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="capitalize text-xs">
                            {sale.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 sm:gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                              onClick={() => {
                                setSelectedSaleId(sale.id);
                                setDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              <span className="hidden sm:inline ml-1">Voir</span>
                            </Button>
                            
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="destructive"
                                    className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                                    title="Supprimer cette vente"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="w-[90vw] max-w-md">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Êtes-vous sûr de vouloir supprimer cette vente ?
                                      Cette action est irréversible.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteSale(sale.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
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
      </Card>
      
      <SaleDetailsDialog 
        saleId={selectedSaleId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};