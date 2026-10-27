import { useState, useEffect, useCallback, useRef } from 'react';
import {
  startOfDay, endOfDay, subDays,
  startOfWeek, endOfWeek, subWeeks,
  startOfMonth, endOfMonth, subMonths,
} from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KPICard } from '@/components/Dashboard/KPICard';
import { SellerGoalsCard } from '@/components/Dashboard/SellerGoalsCard';
import { SellerPerformanceComparison } from '@/components/Dashboard/SellerPerformanceComparison';
import { SellerTrendChart } from '@/components/Dashboard/SellerTrendChart';
import { 
  TrendingUp,
  Receipt,
  Package,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatNumber } from '@/lib/utils';
import { useSaleCalculations, SaleForCalc } from '@/hooks/useSaleCalculations';
import { SaleItemForCalc } from '@/hooks/useCurrencyCalculations';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

interface TrendDataPoint {
  date: string;
  revenue: number;
  sales: number;
}

export const SellerDashboardStats = () => {
  const { user } = useAuth();
  const saleCalc = useSaleCalculations();
  
  const [stats, setStats] = useState({
    totalSales: 0,
    todaySales: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    weekSales: 0,
    weekRevenue: 0,
    monthSales: 0,
    monthRevenue: 0,
    averageSale: 0,
    yesterdaySales: 0,
    yesterdayRevenue: 0,
    lastWeekRevenue: 0,
    lastMonthRevenue: 0,
    topProducts: [] as { product_name: string; quantity: number; revenue: number }[]
  });
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Use hook values with fallbacks
  const displayCurrency = saleCalc?.displayCurrency || 'HTG';
  const usdHtgRate = saleCalc?.usdHtgRate || 132;

  const inFlight = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!user || !saleCalc) return;
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const now = new Date();

      // Calendar boundaries (midnight -> 23:59:59.999, weeks Monday->Sunday)
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const yesterdayStart = startOfDay(subDays(now, 1));
      const yesterdayEnd = endOfDay(subDays(now, 1));
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // Only load the data actually needed (previous month -> now) to keep it fast
      const windowStart = new Date(Math.min(
        lastMonthStart.getTime(),
        lastWeekStart.getTime(),
        startOfDay(subDays(now, 6)).getTime()
      ));

      const salesCols = 'id, created_at, total_amount, subtotal, discount_amount, discount_type, discount_value, discount_currency, customer_name';
      const fetchWindowSales = async () => {
        const PAGE = 1000;
        let all: any[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('sales')
            .select(salesCols)
            .eq('seller_id', user.id)
            .gte('created_at', windowStart.toISOString())
            .order('created_at', { ascending: false })
            .range(from, from + PAGE - 1);
          if (error) throw error;
          all = all.concat(data || []);
          if (!data || data.length < PAGE) break;
        }
        return all;
      };

      const [{ count: totalCount }, windowSales] = await Promise.all([
        supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', user.id),
        fetchWindowSales(),
      ]);

      // Load related items in small parallel chunks (short URLs, never rejected)
      const saleIds = windowSales.map(s => s.id);
      const chunks: string[][] = [];
      for (let i = 0; i < saleIds.length; i += 50) chunks.push(saleIds.slice(i, i + 50));
      const chunkResults = await Promise.all(chunks.map(chunk =>
        supabase
          .from('sale_items')
          .select('sale_id, product_name, quantity, subtotal, currency, profit_amount, purchase_price_at_sale')
          .in('sale_id', chunk)
          .then(({ data, error }) => {
            if (error) console.error('sale_items chunk error:', error);
            return (data || []) as any[];
          })
      ));
      const allSaleItems: (SaleItemForCalc & { sale_id: string; product_name: string })[] = chunkResults.flat();

      // Index items once
      const itemsBySale = new Map<string, any[]>();
      allSaleItems.forEach(item => {
        if (!itemsBySale.has(item.sale_id)) itemsBySale.set(item.sale_id, []);
        itemsBySale.get(item.sale_id)!.push(item);
      });

      const safe = (n: any) => (Number.isFinite(Number(n)) ? Number(n) : 0);
      // Sale TTC: computed from items when available, otherwise stored total_amount (already TTC)
      const saleTTC = (sale: any) => {
        const items = itemsBySale.get(sale.id);
        if (items && items.length) {
          const v = saleCalc.calculateSaleTotal(sale as SaleForCalc, items).totalTTC;
          if (Number.isFinite(v) && v > 0) return v;
        }
        return safe(sale.total_amount);
      };
      const revenueOf = (list: any[]) => list.reduce((sum, s) => sum + saleTTC(s), 0);

      const between = (from: Date, to: Date) => windowSales.filter(s => {
        const d = new Date(s.created_at);
        return d >= from && d <= to;
      });

      const todaySales = between(todayStart, todayEnd);
      const yesterdaySales = between(yesterdayStart, yesterdayEnd);
      const weekSales = between(weekStart, weekEnd);
      const lastWeekSales = between(lastWeekStart, lastWeekEnd);
      const monthSales = between(monthStart, monthEnd);
      const lastMonthSales = between(lastMonthStart, lastMonthEnd);

      const todayRevenue = revenueOf(todaySales);
      const yesterdayRevenue = revenueOf(yesterdaySales);
      const weekRevenue = revenueOf(weekSales);
      const lastWeekRevenue = revenueOf(lastWeekSales);
      const monthRevenue = revenueOf(monthSales);
      const lastMonthRevenue = revenueOf(lastMonthSales);

      // Trend for the last 7 calendar days (midnight -> 23:59:59)
      const trendDataCalc: TrendDataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = startOfDay(subDays(now, i));
        const dayEnd = endOfDay(subDays(now, i));
        const daySales = between(dayStart, dayEnd);
        trendDataCalc.push({
          date: dayStart.toLocaleDateString('fr-FR', { weekday: 'short' }),
          revenue: revenueOf(daySales),
          sales: daySales.length
        });
      }
      setTrendData(trendDataCalc);

      // Top products of the current month, converted to the display currency
      const monthIds = new Set(monthSales.map(s => s.id));
      const productStats = allSaleItems
        .filter(item => monthIds.has(item.sale_id))
        .reduce((acc: any, item) => {
          const name = item.product_name || 'Produit';
          if (!acc[name]) {
            acc[name] = { product_name: name, quantity: 0, revenue: 0 };
          }
          acc[name].quantity += safe(item.quantity);
          const sub = safe(item.subtotal);
          const itemRevenue = displayCurrency === 'USD'
            ? (item.currency === 'USD' ? sub : sub / usdHtgRate)
            : (item.currency === 'USD' ? sub * usdHtgRate : sub);
          acc[name].revenue += itemRevenue;
          return acc;
        }, {});

      const topProducts = Object.values(productStats || {})
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5);

      const averageSale = monthSales.length ? monthRevenue / monthSales.length : 0;

      setStats({
        totalSales: totalCount || 0,
        todaySales: todaySales.length,
        totalRevenue: monthRevenue,
        todayRevenue,
        weekSales: weekSales.length,
        weekRevenue,
        monthSales: monthSales.length,
        monthRevenue,
        averageSale,
        yesterdaySales: yesterdaySales.length,
        yesterdayRevenue,
        lastWeekRevenue,
        lastMonthRevenue,
        topProducts: topProducts as any
      });

      // Recent sales derived from the same data (no extra request)
      const recent = windowSales.slice(0, 5).map(sale => ({ ...sale, displayAmount: saleTTC(sale) }));
      setRecentSales(recent);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, saleCalc, displayCurrency, usdHtgRate]);


  useEffect(() => {
    if (user && saleCalc) {
      fetchStats();
    }
  }, [user, saleCalc, fetchStats]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && saleCalc) {
        fetchStats();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user, saleCalc, fetchStats]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  // Sparkline data for KPIs
  const revenueSparkline = trendData.map(d => ({ value: d.revenue }));
  const salesSparkline = trendData.map(d => ({ value: d.sales }));

  // Average calculations
  const averageDailySales = stats.monthSales / 30;
  const averageDailyRevenue = stats.monthRevenue / 30;

  // Top products for bar chart
  const topProductsChartData = stats.topProducts.map((p, i) => ({
    name: p.product_name.length > 15 ? p.product_name.substring(0, 15) + '...' : p.product_name,
    fullName: p.product_name,
    revenue: p.revenue,
    quantity: p.quantity,
    rank: i + 1
  }));

  if (loading || !saleCalc) {
    return (
      <div className="flex items-center justify-center h-64">
        <Package className="w-8 h-8 text-primary animate-pulse" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2">
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
            <span className="hidden sm:inline">MàJ:</span> {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-7 sm:h-8 text-xs sm:text-sm"
        >
          <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </div>

      {/* KPI Cards with Sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <KPICard
          title="Revenu Aujourd'hui"
          value={stats.todayRevenue}
          previousValue={stats.yesterdayRevenue}
          icon={DollarSign}
          sparklineData={revenueSparkline}
          colorScheme="seller-profit"
          currency={displayCurrency}
        />
        <KPICard
          title="Ventes"
          value={stats.todaySales}
          previousValue={stats.yesterdaySales}
          icon={Receipt}
          format="number"
          sparklineData={salesSparkline}
          colorScheme="seller-sales"
        />
        <KPICard
          title="Panier Moyen"
          value={stats.averageSale}
          icon={ShoppingCart}
          colorScheme="seller-average"
          size="sm"
          currency={displayCurrency}
        />
        <KPICard
          title="Total Ventes"
          value={stats.totalSales}
          icon={TrendingUp}
          format="number"
          colorScheme="seller-revenue"
          size="sm"
        />
      </div>

      {/* Trend Chart - hidden on mobile */}
      <div className="hidden sm:block">
        <SellerTrendChart data={trendData} currency={displayCurrency} />
      </div>

      {/* Goals & Comparison Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <SellerGoalsCard
          todaySales={stats.todaySales}
          todayRevenue={stats.todayRevenue}
          averageDailySales={averageDailySales}
          averageDailyRevenue={averageDailyRevenue}
          currency={displayCurrency}
        />
        <SellerPerformanceComparison
          comparisons={[
            { 
              label: "Aujourd'hui vs Hier", 
              current: stats.todayRevenue, 
              previous: stats.yesterdayRevenue 
            },
            { 
              label: "Cette Semaine", 
              current: stats.weekRevenue, 
              previous: stats.lastWeekRevenue 
            },
            { 
              label: "Ce Mois", 
              current: stats.monthRevenue, 
              previous: stats.lastMonthRevenue 
            }
          ]}
          currency={displayCurrency}
        />
      </div>

      {/* Top Products & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Top Products with Bar Chart */}
        <Card className="animate-fade-in-up dark:border-border/50 dark:bg-card/80" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Top 5 Produits
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {stats.topProducts.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-xs sm:text-base">Aucune vente enregistrée</p>
              </div>
            ) : (
              <>
                <div className="h-[140px] sm:h-[180px] mb-3 sm:mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsChartData} layout="vertical" margin={{ left: 0, right: 40 }}>
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={75}
                        tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded-lg shadow-lg p-2 sm:p-3 text-xs sm:text-sm">
                              <p className="font-medium">{data.fullName}</p>
                                <p className="text-muted-foreground">
                                  {displayCurrency === 'USD' ? `$${formatNumber(data.revenue)}` : `${formatNumber(data.revenue)} HTG`} • {data.quantity} unités
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="revenue" 
                        radius={[0, 4, 4, 0]}
                        animationDuration={1000}
                      >
                        {topProductsChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? 'hsl(var(--primary))' : `hsl(var(--primary) / ${1 - index * 0.15})`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  {stats.topProducts.map((product, index) => (
                    <div key={product.product_name} className="flex items-center justify-between text-[10px] sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <Badge variant="outline" className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[8px] sm:text-xs shrink-0">
                          {index + 1}
                        </Badge>
                        <span className="truncate">{product.product_name}</span>
                      </div>
                      <span className="font-medium text-primary shrink-0 ml-2">
                        {displayCurrency === 'USD' ? `$${formatNumber(product.revenue)}` : `${formatNumber(product.revenue)} HTG`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card className="animate-fade-in-up dark:border-border/50 dark:bg-card/80" style={{ animationDelay: '400ms' }}>
          <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Ventes Récentes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {recentSales.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Receipt className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-xs sm:text-base">Aucune vente récente</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
                    <div className="min-w-0">
                      <p className="font-medium truncate text-xs sm:text-sm">
                        {sale.customer_name || 'Client anonyme'}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString('fr-FR', { 
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] sm:text-sm shrink-0 ml-2">
                      {displayCurrency === 'USD' 
                        ? `$${formatNumber(sale.displayAmount)}`
                        : `${formatNumber(sale.displayAmount)} HTG`
                      }
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
