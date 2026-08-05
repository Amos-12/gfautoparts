import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList
} from 'recharts';
import { 
  Calendar, 
  TrendingUp, 
  Package, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Target, 
  RefreshCw,
  Clock,
  Wallet,
  BarChart3,
  Download,
  FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { KPICard } from './KPICard';
import { AdminBusinessHealth } from './AdminBusinessHealth';
import { AdminTopSellersChart } from './AdminTopSellersChart';
import { RecentActivities } from './RecentActivities';
import { formatNumber } from '@/lib/utils';
import { generateAdminDashboardPdf } from '@/lib/adminDashboardPdf';
import { useSaleCalculations } from '@/hooks/useSaleCalculations';
import { useCurrencyCalculations } from '@/hooks/useCurrencyCalculations';
import { useCompanySettings } from '@/hooks/useCompanySettings';

interface RevenueData {
  date: string;
  revenue: number;
  profit: number;
  sales: number;
}

interface ProductSalesData {
  name: string;
  sales: number;
  revenue: number;
  percent?: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface SellerData {
  name: string;
  sales: number;
  revenue: number;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export const AdminDashboardCharts = () => {
  // Centralized hooks
  const { settings: companySettingsHook } = useCompanySettings();
  const saleCalc = useSaleCalculations();
  const currencyCalc = useCurrencyCalculations();
  
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topProducts, setTopProducts] = useState<ProductSalesData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [topSellers, setTopSellers] = useState<SellerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Stats data
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalSellers, setTotalSellers] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [avgBasket, setAvgBasket] = useState(0);
  
  // Profit stats
  const [todayProfit, setTodayProfit] = useState(0);
  const [weekProfit, setWeekProfit] = useState(0);
  const [monthProfit, setMonthProfit] = useState(0);
  
  // Trending data
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [prevWeekRevenue, setPrevWeekRevenue] = useState(0);
  const [prevMonthRevenue, setPrevMonthRevenue] = useState(0);
  const [prevMonthProfit, setPrevMonthProfit] = useState(0);
  
  // Use hook values with fallbacks
  const usdHtgRate = companySettingsHook?.usdHtgRate || 132;
  const displayCurrency = companySettingsHook?.displayCurrency || 'HTG';

  // Sparkline data
  const [revenueSparkline, setRevenueSparkline] = useState<number[]>([]);
  const [profitSparkline, setProfitSparkline] = useState<number[]>([]);
  const [salesSparkline, setSalesSparkline] = useState<number[]>([]);

  // Prevent concurrent fetches
  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    // Guard: if already fetching, skip
    if (isFetchingRef.current) return;
    
    // If calculations aren't ready yet, keep the skeleton and wait for next render.
    if (!saleCalc) return;

    isFetchingRef.current = true;
    
    try {
      setLoading(true);

      // First fetch company settings to get displayCurrency and rate
      const settings = await fetchCompanySettings();
      const rate = settings?.usd_htg_rate || 132;
      const currency = (settings?.default_display_currency || 'HTG') as 'USD' | 'HTG';

      // Then fetch all data that depends on currency settings
      await Promise.all([
        fetchStatsData(rate, currency),
        fetchRevenueData(rate, currency),
        fetchTopProducts(rate, currency),
        fetchCategoryData(),
        fetchTopSellers(rate, currency),
        fetchSparklineData(rate, currency),
      ]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching chart data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [period, saleCalc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchCompanySettings = async () => {
    // Use hook values - already fetched by useCompanySettings
    const rate = companySettingsHook?.usdHtgRate || 132;
    const currency = companySettingsHook?.displayCurrency || 'HTG';
    return { usd_htg_rate: rate, default_display_currency: currency };
  };

  const fetchSparklineData = async (rate: number, currency: 'USD' | 'HTG') => {
    if (!saleCalc) return;
    
    const days = 7;
    const sparklineRevenue: number[] = [];
    const sparklineProfit: number[] = [];
    const sparklineSales: number[] = [];

    // Fetch all sales and items once for efficiency
    const { data: allSales } = await supabase
      .from('sales')
      .select('id, created_at, total_amount, subtotal, discount_amount, discount_currency');
    
    const { data: allItems } = await supabase
      .from('sale_items')
      .select('sale_id, subtotal, profit_amount, currency');
    
    const sales = (allSales || []).map(s => ({
      id: s.id,
      created_at: s.created_at,
      total_amount: s.total_amount,
      subtotal: s.subtotal,
      discount_amount: s.discount_amount,
      discount_currency: s.discount_currency
    }));
    
    const items = (allItems || []).map(item => ({
      sale_id: item.sale_id,
      subtotal: item.subtotal,
      currency: (item.currency || 'HTG') as 'USD' | 'HTG',
      profit_amount: item.profit_amount || 0
    }));

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayStats = saleCalc.calculatePeriodStats(sales, items, dayStart, dayEnd);
      
      // Revenu réel = TTC (après remise + TVA)
      sparklineRevenue.push(dayStats.revenueTTC);
      sparklineProfit.push(dayStats.profitNet);
      sparklineSales.push(dayStats.count);
    }

    setRevenueSparkline(sparklineRevenue);
    setProfitSparkline(sparklineProfit);
    setSalesSparkline(sparklineSales);
  };

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) {
      if (current > 0) return { value: 100, isPositive: true };
      return { value: 0, isPositive: false };
    }
    const percent = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(percent * 10) / 10),
      isPositive: current >= previous
    };
  };

  const fetchStatsData = async (rate: number, currency: 'USD' | 'HTG') => {
    if (!saleCalc) return;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date();
      
      // Fetch all sales with discount info for accurate calculations
      const { data: allSales } = await supabase
        .from('sales')
        .select('id, created_at, total_amount, subtotal, discount_amount, discount_currency, discount_type, discount_value');
      
      // Fetch all sale items with sale_id
      const { data: allItems } = await supabase
        .from('sale_items')
        .select('sale_id, subtotal, profit_amount, currency');
      
      const sales = (allSales || []).map(s => ({
        id: s.id,
        created_at: s.created_at,
        total_amount: s.total_amount,
        subtotal: s.subtotal,
        discount_amount: s.discount_amount,
        discount_currency: s.discount_currency,
        discount_type: s.discount_type,
        discount_value: s.discount_value
      }));
      
      const items = (allItems || []).map(item => ({
        sale_id: item.sale_id,
        subtotal: item.subtotal,
        currency: (item.currency || 'HTG') as 'USD' | 'HTG',
        profit_amount: item.profit_amount || 0
      }));
      
      // Today's stats
      const todayStats = saleCalc.calculatePeriodStats(sales, items, today, now);
      setTodaySales(todayStats.count);
      setTodayRevenue(todayStats.revenueTTC); // Revenu réel (TTC) en devise d'affichage
      setTodayProfit(todayStats.profitNet);
      setAvgBasket(todayStats.avgBasket);
      
      // Yesterday's stats
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(today);
      yesterdayEnd.setMilliseconds(-1);
      const yesterdayStats = saleCalc.calculatePeriodStats(sales, items, yesterday, yesterdayEnd);
      setYesterdayRevenue(yesterdayStats.revenueTTC);
      setYesterdayProfit(yesterdayStats.profitNet);

      // Week stats
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const weekStats = saleCalc.calculatePeriodStats(sales, items, weekAgo, now);
      setWeekRevenue(weekStats.revenueTTC);
      setWeekProfit(weekStats.profitNet);

      // Previous week stats
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const prevWeekStats = saleCalc.calculatePeriodStats(sales, items, twoWeeksAgo, weekAgo);
      setPrevWeekRevenue(prevWeekStats.revenueTTC);

      // Month stats
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const monthStats = saleCalc.calculatePeriodStats(sales, items, monthAgo, now);
      setMonthRevenue(monthStats.revenueTTC);
      setMonthProfit(monthStats.profitNet);

      // Previous month stats
      const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const prevMonthStats = saleCalc.calculatePeriodStats(sales, items, twoMonthsAgo, monthAgo);
      setPrevMonthRevenue(prevMonthStats.revenueTTC);
      setPrevMonthProfit(prevMonthStats.profitNet);

      // Products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      setTotalProducts(productsCount || 0);

      // Low stock count
      const { data: lowStock } = await supabase
        .from('products')
        .select('id, quantity, alert_threshold')
        .eq('is_active', true);
      
      const lowStockItems = lowStock?.filter(p => p.quantity <= p.alert_threshold) || [];
      setLowStockCount(lowStockItems.length);

      // Sellers count
      const { count: sellersCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'seller')
        .eq('is_active', true);
      
      setTotalSellers(sellersCount || 0);

    } catch (error) {
      console.error('Error fetching stats data:', error);
    }
  };

  const fetchRevenueData = async (rate: number, currency: 'USD' | 'HTG') => {
    if (!saleCalc) return;
    
    const daysBack = period === 'daily' ? 7 : period === 'weekly' ? 28 : 90;
    
    const chartData: RevenueData[] = [];
    
    // Fetch all sales and items once for efficiency
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);
    
    const { data: allSales } = await supabase
      .from('sales')
      .select('id, created_at, total_amount, subtotal, discount_amount, discount_currency')
      .gte('created_at', startDate.toISOString());
    
    const { data: allItems } = await supabase
      .from('sale_items')
      .select('sale_id, subtotal, profit_amount, currency')
      .in('sale_id', (allSales || []).map(s => s.id));
    
    const sales = (allSales || []).map(s => ({
      id: s.id,
      created_at: s.created_at,
      total_amount: s.total_amount,
      subtotal: s.subtotal,
      discount_amount: s.discount_amount,
      discount_currency: s.discount_currency
    }));
    
    const items = (allItems || []).map(item => ({
      sale_id: item.sale_id,
      subtotal: item.subtotal,
      currency: (item.currency || 'HTG') as 'USD' | 'HTG',
      profit_amount: item.profit_amount || 0
    }));
    
    for (let i = daysBack - 1; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayStats = saleCalc.calculatePeriodStats(sales, items, dayStart, dayEnd);

      chartData.push({
        date: dayStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        revenue: dayStats.revenueTTC,
        profit: dayStats.profitNet,
        sales: dayStats.count
      });
    }

    setRevenueData(chartData);
  };

  const fetchTopProducts = async (rate: number, currency: 'USD' | 'HTG') => {
    const daysBack = period === 'daily' ? 7 : period === 'weekly' ? 28 : 365;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    // Fetch sale items with sale info including discount
    const { data: itemsData, error } = await supabase
      .from('sale_items')
      .select('product_name, quantity, subtotal, currency, sale_id, sales!inner(id, created_at, subtotal, discount_amount, discount_currency)')
      .gte('sales.created_at', startDate.toISOString());

    if (error) throw error;

    // Group items by sale to calculate discount ratio per sale
    const salesMap = new Map<string, { saleSubtotal: number; discountAmount: number; discountCurrency: string }>();
    itemsData?.forEach((item: any) => {
      const saleId = item.sale_id;
      if (!salesMap.has(saleId)) {
        salesMap.set(saleId, {
          saleSubtotal: item.sales.subtotal || 0,
          discountAmount: item.sales.discount_amount || 0,
          discountCurrency: item.sales.discount_currency || 'HTG'
        });
      }
    });

    const grouped = itemsData?.reduce((acc: Record<string, { sales: number; revenue: number }>, item: any) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = { sales: 0, revenue: 0 };
      }
      acc[item.product_name].sales += Number(item.quantity);
      
      // Convert item subtotal to display currency
      const itemSubtotalInDisplay = currency === 'USD'
        ? (item.currency === 'USD' ? item.subtotal : item.subtotal / rate)
        : (item.currency === 'USD' ? item.subtotal * rate : item.subtotal);
      
      // Get sale discount info
      const saleInfo = salesMap.get(item.sale_id);
      if (saleInfo && saleInfo.saleSubtotal > 0 && saleInfo.discountAmount > 0) {
        // Convert discount to display currency
        const discountInDisplay = currency === 'USD'
          ? (saleInfo.discountCurrency === 'USD' ? saleInfo.discountAmount : saleInfo.discountAmount / rate)
          : (saleInfo.discountCurrency === 'USD' ? saleInfo.discountAmount * rate : saleInfo.discountAmount);
        
        // Calculate proportional discount for this item
        const discountRatio = itemSubtotalInDisplay / (currency === 'USD'
          ? (item.currency === 'USD' ? saleInfo.saleSubtotal : saleInfo.saleSubtotal / rate)
          : (item.currency === 'USD' ? saleInfo.saleSubtotal * rate : saleInfo.saleSubtotal));
        
        const itemDiscount = discountInDisplay * discountRatio;
        acc[item.product_name].revenue += Math.max(0, itemSubtotalInDisplay - itemDiscount);
      } else {
        acc[item.product_name].revenue += itemSubtotalInDisplay;
      }
      
      return acc;
    }, {}) || {};

    const totalRevenue = Object.values(grouped).reduce((sum: number, p) => sum + p.revenue, 0);

    const topProductsData = Object.entries(grouped)
      .map(([name, data]) => ({
        name: name.length > 20 ? name.slice(0, 20) + '...' : name,
        sales: data.sales,
        revenue: data.revenue,
        percent: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    setTopProducts(topProductsData);
  };

  const fetchCategoryData = async () => {
    const { data: products } = await supabase
      .from('products')
      .select('category');

    const categories = products?.reduce((acc: any, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {}) || {};

    const chartData = Object.entries(categories).map(([name, value]: [string, any], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: COLORS[index % COLORS.length]
    }));

    setCategoryData(chartData);
  };

  const fetchTopSellers = async (rate: number, currency: 'USD' | 'HTG') => {
    try {
      // Fetch sales with discount info
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, seller_id, subtotal, discount_amount, discount_currency');
      
      // Create a map of sale discount info
      const salesMap = new Map<string, { sellerId: string; saleSubtotal: number; discountAmount: number; discountCurrency: string }>();
      salesData?.forEach(sale => {
        salesMap.set(sale.id, {
          sellerId: sale.seller_id,
          saleSubtotal: sale.subtotal || 0,
          discountAmount: sale.discount_amount || 0,
          discountCurrency: sale.discount_currency || 'HTG'
        });
      });

      // Fetch sale_items with currency for proper conversion
      const { data: saleItemsData } = await supabase
        .from('sale_items')
        .select('subtotal, currency, sale_id');

      // Group revenue by seller with discount applied proportionally
      const sellerGroups: Record<string, { revenue: number }> = {};
      
      saleItemsData?.forEach((item: any) => {
        const saleInfo = salesMap.get(item.sale_id);
        if (!saleInfo) return;
        
        const sellerId = saleInfo.sellerId;
        if (!sellerGroups[sellerId]) {
          sellerGroups[sellerId] = { revenue: 0 };
        }
        
        // Convert item subtotal to display currency
        const itemSubtotalInDisplay = currency === 'USD'
          ? (item.currency === 'USD' ? item.subtotal : item.subtotal / rate)
          : (item.currency === 'USD' ? item.subtotal * rate : item.subtotal);
        
        // Apply proportional discount
        if (saleInfo.saleSubtotal > 0 && saleInfo.discountAmount > 0) {
          // Convert discount to display currency
          const discountInDisplay = currency === 'USD'
            ? (saleInfo.discountCurrency === 'USD' ? saleInfo.discountAmount : saleInfo.discountAmount / rate)
            : (saleInfo.discountCurrency === 'USD' ? saleInfo.discountAmount * rate : saleInfo.discountAmount);
          
          // Calculate sale subtotal in display currency for ratio
          // This is an approximation - we'll use the stored subtotal directly
          const saleSubtotalInDisplay = currency === 'USD'
            ? saleInfo.saleSubtotal / rate // Assume subtotal stored in HTG
            : saleInfo.saleSubtotal;
          
          const discountRatio = itemSubtotalInDisplay / saleSubtotalInDisplay;
          const itemDiscount = discountInDisplay * Math.min(1, discountRatio);
          sellerGroups[sellerId].revenue += Math.max(0, itemSubtotalInDisplay - itemDiscount);
        } else {
          sellerGroups[sellerId].revenue += itemSubtotalInDisplay;
        }
      });

      // Count sales per seller
      const salesCountBySeller: Record<string, number> = {};
      salesData?.forEach(sale => {
        salesCountBySeller[sale.seller_id] = (salesCountBySeller[sale.seller_id] || 0) + 1;
      });

      const sellerIds = Object.keys(sellerGroups);
      if (sellerIds.length === 0) {
        setTopSellers([]);
        return;
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', sellerIds);

      const sellers = sellerIds
        .map(sellerId => {
          const profile = profilesData?.find(p => p.user_id === sellerId);
          const stats = sellerGroups[sellerId];
          return {
            name: profile?.full_name || 'Vendeur inconnu',
            sales: salesCountBySeller[sellerId] || 0,
            revenue: stats.revenue
          };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopSellers(sellers);
    } catch (error) {
      console.error('Error fetching top sellers:', error);
      setTopSellers([]);
    }
  };

  const profitMargin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;
  const stockTurnover = 2.5; // Placeholder - would need historical data to calculate

  const handleExportPdf = async () => {
    try {
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      const periodLabel = period === 'daily' ? 'Journalier' : period === 'weekly' ? 'Hebdomadaire' : 'Mensuel';

      await generateAdminDashboardPdf(
        {
          todayRevenue,
          weekRevenue,
          monthRevenue,
          todayProfit,
          todaySales,
          avgBasket,
          totalProducts,
          totalSellers,
          lowStockCount,
          profitMargin,
        },
        topProducts,
        categoryData,
        topSellers,
        {
          company_name: companyData?.company_name || 'Mon Entreprise',
          address: companyData?.address || '',
          city: companyData?.city || '',
          phone: companyData?.phone || '',
          email: companyData?.email || '',
          logo_url: companyData?.logo_url,
          usd_htg_rate: usdHtgRate,
          tva_rate: companyData?.tva_rate,
          company_description: companyData?.company_description,
          payment_terms: companyData?.payment_terms,
        },
        periodLabel
      );

      toast({
        title: "PDF exporté",
        description: "Le rapport du tableau de bord a été téléchargé",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'exporter le PDF",
        variant: "destructive",
      });
    }
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32 flex items-center justify-center">
                <div className="text-muted-foreground">Chargement...</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header with refresh and indicators */}
      <div className="flex flex-col gap-2">
        {/* Row 1: Title + Action buttons */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground">Tableau de Bord</h2>
          <div className="flex items-center gap-1.5">
            <Button 
              variant="outline" 
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={handleExportPdf}
            >
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {/* Row 2: Badges and period selector */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Badge variant="outline" className="flex items-center gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2">
            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 text-[10px] sm:text-xs bg-muted/50 px-1.5 sm:px-2">
            <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
            1 USD = {formatNumber(usdHtgRate)} HTG
          </Badge>
          <Badge 
            variant="outline" 
            className={`text-[10px] sm:text-xs px-1.5 sm:px-2 ${
              displayCurrency === 'USD' 
                ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' 
                : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
            }`}
          >
            {displayCurrency === 'USD' ? '$ USD' : 'HTG'}
          </Badge>
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-[115px] sm:w-40 h-7 sm:h-8 text-[10px] sm:text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">7 derniers jours</SelectItem>
              <SelectItem value="weekly">4 semaines</SelectItem>
              <SelectItem value="monthly">3 mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards - Row 1: Métriques prioritaires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="animate-fade-in priority-card" style={{ animationDelay: '0ms' }}>
          <KPICard
            title="Revenus Aujourd'hui"
            value={todayRevenue}
            previousValue={yesterdayRevenue}
            icon={DollarSign}
            format="currency"
            currency={displayCurrency}
            sparklineData={revenueSparkline.map(v => ({ value: v }))}
            colorScheme="admin-revenue"
          />
        </div>
        <div className="animate-fade-in priority-card" style={{ animationDelay: '50ms' }}>
          <KPICard
            title="Bénéfices Aujourd'hui"
            value={todayProfit}
            previousValue={yesterdayProfit}
            icon={TrendingUp}
            format="currency"
            currency={displayCurrency}
            sparklineData={profitSparkline.map(v => ({ value: v }))}
            colorScheme="admin-profit"
          />
        </div>
        <div className="animate-fade-in priority-card" style={{ animationDelay: '100ms' }}>
          <KPICard
            title="Revenus Semaine"
            value={weekRevenue}
            previousValue={prevWeekRevenue}
            icon={Wallet}
            format="currency"
            currency={displayCurrency}
            sparklineData={salesSparkline.map(v => ({ value: v }))}
            colorScheme="admin-target"
          />
        </div>
        <div className="animate-fade-in priority-card" style={{ animationDelay: '150ms' }}>
          <KPICard
            title="Bénéfices Mois"
            value={monthProfit}
            previousValue={prevMonthProfit}
            icon={TrendingUp}
            format="currency"
            currency={displayCurrency}
            sparklineData={profitSparkline.map(v => ({ value: v }))}
            colorScheme="admin-profit"
          />
        </div>
      </div>

      {/* KPI Cards - Row 2: Métriques secondaires (petites) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <KPICard
            title="Ventes"
            value={todaySales}
            icon={ShoppingCart}
            format="number"
            colorScheme="admin-sales"
            size="sm"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
          <KPICard
            title="Panier Moyen"
            value={avgBasket}
            icon={BarChart3}
            format="currency"
            currency={displayCurrency}
            colorScheme="admin-orders"
            size="sm"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <KPICard
            title="Revenus Mois"
            value={monthRevenue}
            previousValue={prevMonthRevenue}
            icon={Target}
            format="currency"
            currency={displayCurrency}
            colorScheme="admin-inventory"
            size="sm"
          />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
          <KPICard
            title="Produits"
            value={totalProducts}
            icon={Package}
            format="number"
            colorScheme="admin-products"
            size="sm"
          />
        </div>
      </div>

      {/* Main Charts Grid - Revenue Chart + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Revenue/Profit Trend - 2/3 width */}
        <div className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <Card className="admin-card-revenue h-full">
            <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-admin-revenue" />
                <span className="hidden sm:inline">Évolution Revenus & Bénéfices</span>
                <span className="sm:hidden">Revenus & Bénéfices</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <ResponsiveContainer width="100%" height={200} className="sm:!h-[320px]">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--admin-revenue))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--admin-revenue))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--admin-profit))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--admin-profit))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={35} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))',
                      fontSize: '12px'
                    }}
                    formatter={(value: any, name: string) => [
                      displayCurrency === 'USD' ? `$${formatNumber(value)}` : `${formatNumber(value)} HTG`,
                      name
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name="Revenus"
                    stroke="hsl(var(--admin-revenue))" 
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="profit" 
                    name="Bénéfices"
                    stroke="hsl(var(--admin-profit))" 
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities - 1/3 width */}
        <div className="animate-fade-in" style={{ animationDelay: '450ms' }}>
          <RecentActivities />
        </div>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        {/* Top Products */}
        <Card className="admin-card-products animate-fade-in" style={{ animationDelay: '500ms' }}>
          <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-admin-products" />
              Top Produits
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="h-[250px] sm:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts.slice(0, window.innerWidth < 640 ? 5 : 10)} layout="vertical" margin={{ left: 5, right: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 9, fill: 'hsl(var(--foreground))' }}
                    width={75}
                  />
                  <Tooltip 
                    formatter={(value: any) => [displayCurrency === 'USD' ? `$${formatNumber(value)}` : `${formatNumber(value)} HTG`, 'Revenus']} 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))',
                      fontSize: '11px'
                    }} 
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--admin-products))" 
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList 
                      dataKey="percent"
                      position="right"
                      formatter={(value: number) => `${value}%`}
                      fill="hsl(var(--muted-foreground))"
                      fontSize={9}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Sellers */}
        <div className="animate-fade-in" style={{ animationDelay: '550ms' }}>
          <AdminTopSellersChart sellers={topSellers} currency={displayCurrency} />
        </div>
      </div>

      {/* Category Distribution & Business Health Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        {/* Category Distribution */}
        <Card className="admin-card-inventory animate-fade-in" style={{ animationDelay: '600ms' }}>
          <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
              <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20">
                <BarChart3 className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <span className="hidden sm:inline">Distribution par Catégorie</span>
              <span className="sm:hidden">Catégories</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="flex flex-col items-center gap-3 sm:gap-4">
              {/* Pie Chart */}
              <div className="relative w-[140px] h-[140px] sm:w-[180px] sm:h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius="85%"
                      innerRadius="55%"
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: string) => [`${value} produits`, name]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--card-foreground))',
                        fontSize: '11px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Total in center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-lg sm:text-2xl font-bold text-foreground">{categoryData.reduce((sum, c) => sum + c.value, 0)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Produits</p>
                </div>
              </div>
              
              {/* Legend as compact list */}
              <div className="w-full space-y-1 sm:space-y-1.5">
                {categoryData.slice(0, 4).map((category, index) => {
                  const total = categoryData.reduce((sum, c) => sum + c.value, 0);
                  const percent = total > 0 ? ((category.value / total) * 100).toFixed(0) : 0;
                  return (
                    <div key={index} className="flex items-center justify-between px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-muted/30">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div 
                          className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-[10px] sm:text-xs font-medium text-foreground truncate max-w-[80px] sm:max-w-[100px]">{category.name}</span>
                      </div>
                      <span className="text-[10px] sm:text-xs font-semibold text-foreground">{percent}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Health */}
        <div className="animate-fade-in" style={{ animationDelay: '650ms' }}>
          <AdminBusinessHealth
            revenue={monthRevenue}
            revenueTarget={monthRevenue > 0 ? monthRevenue * 1.2 : 1000000}
            profitMargin={monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0}
            stockTurnover={todaySales > 0 ? todaySales / 30 : 0.5}
            lowStockCount={lowStockCount}
            totalProducts={totalProducts}
            currency={displayCurrency}
          />
        </div>
      </div>
    </div>
  );
};
