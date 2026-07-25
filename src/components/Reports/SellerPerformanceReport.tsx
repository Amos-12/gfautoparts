import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  ShoppingCart, 
  Award,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Package
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface SellerStats {
  seller_id: string;
  seller_name: string;
  total_revenue_usd: number;
  total_revenue_htg: number;
  total_revenue_converted: number;
  total_sales: number;
  total_profit: number;
  average_cart: number;
  trend_percent: number;
  top_products: { name: string; quantity: number; revenue: number }[];
}

interface CompanySettings {
  usd_htg_rate: number;
  default_display_currency: string;
}

export const SellerPerformanceReport = () => {
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({ usd_htg_rate: 132, default_display_currency: 'HTG' });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('usd_htg_rate, default_display_currency')
        .single();
      if (data) {
        setCompanySettings({
          usd_htg_rate: data.usd_htg_rate || 132,
          default_display_currency: data.default_display_currency || 'HTG'
        });
      }
    };
    fetchSettings();
  }, []);

  const fetchSellerStats = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(period);
      const startDate = startOfDay(subDays(new Date(), daysAgo)).toISOString();
      const endDate = endOfDay(new Date()).toISOString();
      
      // Previous period for trend calculation
      const prevStartDate = startOfDay(subDays(new Date(), daysAgo * 2)).toISOString();
      const prevEndDate = startOfDay(subDays(new Date(), daysAgo)).toISOString();

      // Fetch all sellers
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['seller', 'admin']);

      const sellerProfiles = profiles?.filter(p => 
        userRoles?.some(r => r.user_id === p.user_id)
      ) || [];

      // Fetch current period sales with sale_items including currency
      const { data: currentSales } = await supabase
        .from('sales')
        .select(`
          id,
          seller_id,
          total_amount,
          created_at,
          sale_items (
            product_name,
            quantity,
            subtotal,
            profit_amount,
            currency
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Fetch previous period sales for trend
      const { data: prevSales } = await supabase
        .from('sales')
        .select('seller_id, total_amount')
        .gte('created_at', prevStartDate)
        .lt('created_at', prevEndDate);

      // Calculate stats per seller
      const sellerStatsMap = new Map<string, SellerStats>();

      sellerProfiles.forEach(profile => {
        sellerStatsMap.set(profile.user_id, {
          seller_id: profile.user_id,
          seller_name: profile.full_name,
          total_revenue_usd: 0,
          total_revenue_htg: 0,
          total_revenue_converted: 0,
          total_sales: 0,
          total_profit: 0,
          average_cart: 0,
          trend_percent: 0,
          top_products: []
        });
      });

      // Process current sales
      const productSalesMap = new Map<string, Map<string, { quantity: number; revenue: number }>>();

      currentSales?.forEach(sale => {
        const stats = sellerStatsMap.get(sale.seller_id);
        if (stats) {
          stats.total_sales += 1;
          
          sale.sale_items?.forEach((item: any) => {
            const currency = item.currency || 'HTG';
            const amount = item.subtotal || 0;
            
            if (currency === 'USD') {
              stats.total_revenue_usd += amount;
              stats.total_revenue_converted += companySettings.default_display_currency === 'USD' 
                ? amount 
                : amount * companySettings.usd_htg_rate;
            } else {
              stats.total_revenue_htg += amount;
              stats.total_revenue_converted += companySettings.default_display_currency === 'USD' 
                ? amount / companySettings.usd_htg_rate 
                : amount;
            }
            
            stats.total_profit += item.profit_amount || 0;
            
            // Track products for this seller (convert to display currency for proper comparison)
            if (!productSalesMap.has(sale.seller_id)) {
              productSalesMap.set(sale.seller_id, new Map());
            }
            const sellerProducts = productSalesMap.get(sale.seller_id)!;
            const existing = sellerProducts.get(item.product_name) || { quantity: 0, revenue: 0 };
            const revenueConverted = companySettings.default_display_currency === 'USD'
              ? (currency === 'USD' ? amount : amount / companySettings.usd_htg_rate)
              : (currency === 'USD' ? amount * companySettings.usd_htg_rate : amount);
            sellerProducts.set(item.product_name, {
              quantity: existing.quantity + item.quantity,
              revenue: existing.revenue + revenueConverted
            });
          });
        }
      });

      // Calculate previous period revenue per seller
      const prevRevenueMap = new Map<string, number>();
      prevSales?.forEach(sale => {
        const current = prevRevenueMap.get(sale.seller_id) || 0;
        prevRevenueMap.set(sale.seller_id, current + (sale.total_amount || 0));
      });

      // Finalize stats
      sellerStatsMap.forEach((stats, sellerId) => {
        if (stats.total_sales > 0) {
          stats.average_cart = stats.total_revenue_converted / stats.total_sales;
        }
        
        const prevRevenue = prevRevenueMap.get(sellerId) || 0;
        if (prevRevenue > 0) {
          stats.trend_percent = ((stats.total_revenue_converted - prevRevenue) / prevRevenue) * 100;
        } else if (stats.total_revenue_converted > 0) {
          stats.trend_percent = 100;
        }

        // Get top 5 products
        const sellerProducts = productSalesMap.get(sellerId);
        if (sellerProducts) {
          stats.top_products = Array.from(sellerProducts.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
        }
      });

      // Sort by revenue
      const sortedSellers = Array.from(sellerStatsMap.values())
        .filter(s => s.total_sales > 0)
        .sort((a, b) => b.total_revenue_converted - a.total_revenue_converted);

      setSellers(sortedSellers);
    } catch (error) {
      console.error('Error fetching seller stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerStats();
  }, [period, companySettings]);

  const displayCurrency = companySettings.default_display_currency as 'USD' | 'HTG';

  const exportToExcel = () => {
    const data = sellers.map((s, index) => ({
      'Rang': index + 1,
      'Vendeur': s.seller_name,
      'Ventes USD': s.total_revenue_usd,
      'Ventes HTG': s.total_revenue_htg,
      [`Total (${displayCurrency})`]: s.total_revenue_converted,
      'Nombre de ventes': s.total_sales,
      'Panier moyen': s.average_cart,
      'Bénéfice': s.total_profit,
      'Tendance (%)': s.trend_percent.toFixed(1)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance Vendeurs');
    XLSX.writeFile(wb, `performance_vendeurs_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const formatCurrency = (amount: number, currency: 'USD' | 'HTG' = 'HTG') => {
    const formatted = new Intl.NumberFormat('fr-FR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
    return currency === 'USD' ? `$ ${formatted}` : `${formatted} HTG`;
  };

  const totalRevenueUSD = sellers.reduce((sum, s) => sum + s.total_revenue_usd, 0);
  const totalRevenueHTG = sellers.reduce((sum, s) => sum + s.total_revenue_htg, 0);
  const totalRevenueConverted = sellers.reduce((sum, s) => sum + s.total_revenue_converted, 0);
  const totalSales = sellers.reduce((sum, s) => sum + s.total_sales, 0);
  const totalProfit = sellers.reduce((sum, s) => sum + s.total_profit, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-foreground">Performance des Vendeurs</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Analyse des ventes par vendeur</p>
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs px-2 py-0.5 ${
              companySettings.default_display_currency === 'USD' 
                ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' 
                : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
            }`}
          >
            {companySettings.default_display_currency === 'USD' ? '$ USD' : 'HTG'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28 sm:w-40 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Aujourd'hui</SelectItem>
              <SelectItem value="7">7 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="90">3 mois</SelectItem>
              <SelectItem value="365">1 an</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={fetchSellerStats} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm" onClick={exportToExcel} disabled={sellers.length === 0}>
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Ventes USD</p>
                <p className="text-sm sm:text-lg font-bold">{formatCurrency(totalRevenueUSD, 'USD')}</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-500/10 rounded-full">
                <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Ventes HTG</p>
                <p className="text-sm sm:text-lg font-bold">{formatCurrency(totalRevenueHTG, 'HTG')}</p>
              </div>
              <div className="p-2 sm:p-3 bg-primary/10 rounded-full">
                <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Total ({displayCurrency})</p>
                <p className="text-sm sm:text-lg font-bold text-primary">{formatCurrency(totalRevenueConverted, displayCurrency)}</p>
              </div>
              <div className="p-2 sm:p-3 bg-primary/10 rounded-full">
                <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Ventes totales</p>
                <p className="text-sm sm:text-lg font-bold">{totalSales}</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-500/10 rounded-full">
                <ShoppingCart className="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">Vendeurs actifs</p>
                <p className="text-sm sm:text-lg font-bold">{sellers.length}</p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-500/10 rounded-full">
                <Users className="w-4 h-4 sm:w-6 sm:h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sellers Table */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
            Classement des Vendeurs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sellers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucune vente trouvée pour cette période
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {sellers.map((seller, index) => (
                <Collapsible 
                  key={seller.seller_id}
                  open={expandedSeller === seller.seller_id}
                  onOpenChange={(open) => setExpandedSeller(open ? seller.seller_id : null)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-2.5 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                            index === 0 ? 'bg-yellow-500 text-yellow-950' :
                            index === 1 ? 'bg-gray-300 text-gray-700' :
                            index === 2 ? 'bg-amber-600 text-amber-50' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-xs sm:text-sm">{seller.seller_name}</p>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">{seller.total_sales} ventes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-4">
                          {/* Mobile: show converted total only */}
                          <div className="text-right sm:hidden">
                            <p className="text-xs font-semibold">{formatCurrency(seller.total_revenue_converted, displayCurrency)}</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-sm text-green-600">{formatCurrency(seller.total_revenue_usd, 'USD')}</p>
                            <p className="text-sm text-blue-600">{formatCurrency(seller.total_revenue_htg, 'HTG')}</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="font-semibold">{formatCurrency(seller.total_revenue_converted, displayCurrency)}</p>
                            <p className="text-xs text-muted-foreground">Total converti</p>
                          </div>
                          <div className="text-right hidden lg:block">
                            <p className="font-semibold">{formatCurrency(seller.total_profit, displayCurrency)}</p>
                            <p className="text-xs text-muted-foreground">Bénéfice</p>
                          </div>
                          <Badge variant={seller.trend_percent >= 0 ? 'default' : 'destructive'} className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2">
                            {seller.trend_percent >= 0 ? (
                              <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            ) : (
                              <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            )}
                            {Math.abs(seller.trend_percent).toFixed(0)}%
                          </Badge>
                          {expandedSeller === seller.seller_id ? (
                            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/30 p-3 sm:p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4">
                          <div>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">USD</p>
                            <p className="text-xs sm:text-base font-semibold text-green-600">{formatCurrency(seller.total_revenue_usd, 'USD')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">HTG</p>
                            <p className="text-xs sm:text-base font-semibold text-blue-600">{formatCurrency(seller.total_revenue_htg, 'HTG')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">Total converti ({displayCurrency})</p>
                            <p className="text-xs sm:text-base font-semibold">{formatCurrency(seller.total_revenue_converted, displayCurrency)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">Panier moy.</p>
                            <p className="text-xs sm:text-base font-semibold">{formatCurrency(seller.average_cart, displayCurrency)}</p>
                          </div>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mb-2">Taux: 1 USD = {companySettings.usd_htg_rate} HTG</p>
                        <h4 className="font-medium mb-2 flex items-center gap-2 text-xs sm:text-sm">
                          <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                          Top 5 Produits
                        </h4>
                        {seller.top_products.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs sm:text-sm">Produit</TableHead>
                                  <TableHead className="text-right text-xs sm:text-sm">Qté</TableHead>
                                  <TableHead className="text-right text-xs sm:text-sm">Revenu</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {seller.top_products.map((product, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="font-medium text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">{product.name}</TableCell>
                                    <TableCell className="text-right text-xs sm:text-sm">{product.quantity}</TableCell>
                                    <TableCell className="text-right text-xs sm:text-sm">{formatCurrency(product.revenue, displayCurrency)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs sm:text-sm">Aucun produit vendu</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};