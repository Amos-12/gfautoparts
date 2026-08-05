import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { SellerWorkflow } from '@/components/Seller/SellerWorkflow';
import { ProformaWorkflow } from '@/components/Seller/ProformaWorkflow';
import { SellerDashboardStats } from '@/components/Dashboard/SellerDashboardStats';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { ProductManagement } from '@/components/Products/ProductManagement';
import { SaleDetailsDialog } from '@/components/Sales/SaleDetailsDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp,
  Receipt,
  Calendar,
  Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSaleCalculations, SaleForCalc } from '@/hooks/useSaleCalculations';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import logo from '@/assets/logo.png';

interface EnrichedSale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  discount_amount?: number;
  discount_currency?: string;
  subtotal?: number;
  displayAmount: number;
}

// Cart item type for proforma conversion
interface ProformaCartItem {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: 'USD' | 'HTG';
  cartQuantity: number;
  displayUnit?: string;
  actualPrice?: number;
  sourceUnit?: 'barre' | 'tonne';
  sourceValue?: number;
  unit: string;
  quantity: number;
  alert_threshold: number;
  is_active: boolean;
  sale_type: 'retail' | 'wholesale';
  // Other optional fields
  diametre?: string;
  dimension?: string;
  surface_par_boite?: number;
  prix_m2?: number;
  longueur_barre?: number;
  prix_par_barre?: number;
  bars_per_ton?: number;
}

const SellerDashboard = () => {
  const { user, loading: authLoading, role } = useAuth();
  const saleCalc = useSaleCalculations();
  const [sales, setSales] = useState<EnrichedSale[]>([]);
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loadingApproval, setLoadingApproval] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [showSaleDetails, setShowSaleDetails] = useState(false);
  
  // State for proforma to sale conversion
  const [proformaCart, setProformaCart] = useState<ProformaCartItem[] | undefined>(undefined);
  const [proformaCustomerName, setProformaCustomerName] = useState<string | undefined>(undefined);

  // Use hook values with fallbacks
  const displayCurrency = saleCalc?.displayCurrency || 'HTG';

  useEffect(() => {
    if (user && !authLoading) {
      checkApprovalStatus();
    }
  }, [user, authLoading]);

  // Refetch sales when period filter changes
  useEffect(() => {
    if (user && !authLoading && saleCalc && currentSection === 'history') {
      fetchMySales();
    }
  }, [periodFilter, currentSection, saleCalc]);

  const checkApprovalStatus = async () => {
    if (!user) return;
    
    try {
      setLoadingApproval(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('is_active')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setIsApproved(data?.is_active ?? false);
    } catch (error) {
      console.error('Error checking approval status:', error);
      setIsApproved(false);
    } finally {
      setLoadingApproval(false);
    }
  };

  const fetchMySales = useCallback(async () => {
    if (!user || !saleCalc) return;

    try {
      let query = supabase
        .from('sales')
        .select('id, created_at, total_amount, subtotal, discount_amount, discount_currency, discount_type, discount_value, customer_name, payment_method')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      // Apply period filter
      const now = new Date();
      if (periodFilter === 'today') {
        query = query.gte('created_at', startOfDay(now).toISOString());
      } else if (periodFilter === 'week') {
        query = query.gte('created_at', startOfWeek(now, { weekStartsOn: 1 }).toISOString());
      } else if (periodFilter === 'month') {
        query = query.gte('created_at', startOfMonth(now).toISOString());
      } else {
        // Only limit when showing all
        query = query.limit(20);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (!data || data.length === 0) {
        setSales([]);
        return;
      }

      // Fetch sale items for proper calculation
      const saleIds = data.map(s => s.id);
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('sale_id, subtotal, currency, profit_amount')
        .in('sale_id', saleIds);

      // Calculate proper TTC for each sale using the centralized hook
      const enrichedSales: EnrichedSale[] = data.map(sale => {
        const itemsForSale = (saleItems || []).filter(item => item.sale_id === sale.id);
        const result = saleCalc.calculateSaleTotal(sale as SaleForCalc, itemsForSale);
        
        return {
          ...sale,
          displayAmount: result.totalTTC
        };
      });

      setSales(enrichedSales);
    } catch (error) {
      console.error('Error fetching sales:', error);
    }
  }, [user, saleCalc, periodFilter]);

  // Handler for converting proforma to sale
  const handleConvertProformaToSale = (items: ProformaCartItem[], customerName: string) => {
    setProformaCart(items);
    setProformaCustomerName(customerName);
    setCurrentSection('sale');
  };

  // Clear proforma data after sale completion
  const handleSaleComplete = () => {
    setProformaCart(undefined);
    setProformaCustomerName(undefined);
    fetchMySales();
  };

  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <SellerDashboardStats />;
      case 'sale':
        return (
          <SellerWorkflow 
            onSaleComplete={handleSaleComplete}
            initialCart={proformaCart as any}
            initialCustomerName={proformaCustomerName}
          />
        );
      case 'proforma':
        return <ProformaWorkflow onConvertToSale={handleConvertProformaToSale as any} />;
      case 'products':
        return <ProductManagement />;
      case 'notifications':
        return <StockAlerts />;
      case 'history':
        const periodLabels: Record<string, string> = {
          all: '20 récentes',
          today: "Aujourd'hui",
          week: 'Cette semaine',
          month: 'Ce mois'
        };
        
        // Calculate total for filtered period using displayAmount (properly calculated TTC)
        const periodTotal = sales.reduce((sum, sale) => sum + sale.displayAmount, 0);
        
        return (
          <Card className="shadow-lg">
            <CardHeader className="pb-2 sm:pb-4 px-3 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  Mes Ventes
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">
                    ({sales.length} ventes)
                  </span>
                </CardTitle>
                <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as typeof periodFilter)}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">20 récentes</SelectItem>
                    <SelectItem value="today">Aujourd'hui</SelectItem>
                    <SelectItem value="week">Cette semaine</SelectItem>
                    <SelectItem value="month">Ce mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Period stats */}
              {sales.length > 0 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>Total {periodLabels[periodFilter]}:</span>
                  <span className="font-semibold text-foreground">
                    {displayCurrency === 'USD' 
                      ? `$${periodTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : `${periodTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HTG`
                    }
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {sales.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                  <Receipt className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-xs sm:text-sm">Aucune vente pour cette période</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {sales.map((sale) => (
                    <div 
                      key={sale.id} 
                      className="flex items-center justify-between p-2 sm:p-3 border rounded-lg hover:bg-accent/50 transition-all cursor-pointer group"
                      onClick={() => {
                        setSelectedSaleId(sale.id);
                        setShowSaleDetails(true);
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs sm:text-sm truncate max-w-[140px] sm:max-w-none flex items-center gap-1">
                          {sale.customer_name || 'Client anonyme'}
                          <Eye className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 sm:gap-2 flex-wrap">
                          <span>
                            {new Date(sale.created_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="px-1.5 py-0.5 bg-muted rounded text-[9px] sm:text-xs capitalize">
                            {sale.payment_method === 'espece' ? 'Espèces' : sale.payment_method === 'cheque' ? 'Chèque' : sale.payment_method === 'virement' ? 'Virement' : sale.payment_method || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="font-bold text-xs sm:text-sm text-success">
                          {displayCurrency === 'USD' 
                            ? `$${sale.displayAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : `${sale.displayAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HTG`
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      default:
        return <SellerWorkflow onSaleComplete={fetchMySales} />;
    }
  };

  if (authLoading || (user && loadingApproval)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
        <div className="text-center">
          <img src={logo} alt="Logo" className="w-14 h-14 object-contain mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
        <div className="text-center">
          <p className="text-muted-foreground">Veuillez vous connecter</p>
        </div>
      </div>
    );
  }

  // If seller not approved, redirect to Index page which handles inactive accounts
  if (isApproved === false) {
    window.location.href = '/';
    return null;
  }

  return (
    <ResponsiveDashboardLayout 
      title="Espace Vendeur" 
      role="seller" 
      currentSection={currentSection} 
      onSectionChange={setCurrentSection}
    >
      <div className="space-y-6">
        {renderContent()}
      </div>

      <SaleDetailsDialog
        saleId={selectedSaleId}
        open={showSaleDetails}
        onOpenChange={setShowSaleDetails}
      />
    </ResponsiveDashboardLayout>
  );
};

export default SellerDashboard;
