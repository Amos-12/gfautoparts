import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Calculator, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { generateTvaReportPDF } from '@/lib/pdfGenerator';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCurrencyCalculations } from '@/hooks/useCurrencyCalculations';

interface TvaSaleData {
  id: string;
  created_at: string;
  customer_name: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  htg_subtotal: number;
  usd_subtotal: number;
}

interface TvaTotals {
  totalHT_HTG: number;
  totalHT_USD: number;
  totalTVA_HTG: number;
  totalTVA_USD: number;
  totalTTC_HTG: number;
  totalTTC_USD: number;
  unifiedTotalHT: number;
  unifiedTotalTVA: number;
  unifiedTotalTTC: number;
}

const formatNumber = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const TvaReport = () => {
  const [salesData, setSalesData] = useState<TvaSaleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [totals, setTotals] = useState<TvaTotals>({
    totalHT_HTG: 0, totalHT_USD: 0,
    totalTVA_HTG: 0, totalTVA_USD: 0,
    totalTTC_HTG: 0, totalTTC_USD: 0,
    unifiedTotalHT: 0, unifiedTotalTVA: 0, unifiedTotalTTC: 0
  });

  // Use centralized hooks
  const { settings: companySettings } = useCompanySettings();
  const currencyCalc = useCurrencyCalculations();

  const { 
    paginatedItems, 
    currentPage, 
    totalPages, 
    totalItems, 
    pageSize, 
    nextPage, 
    prevPage, 
    hasNextPage, 
    hasPrevPage 
  } = usePagination(salesData, 20);

  const fetchTvaData = async () => {
    if (!companySettings || !currencyCalc) {
      toast({
        title: "Erreur",
        description: "Paramètres de l'entreprise non chargés",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Fetch sales in date range
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id, created_at, customer_name, subtotal, discount_amount, total_amount')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;

      // Fetch all sale items for these sales
      const saleIds = (sales || []).map(s => s.id);
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('sale_id, subtotal, currency')
        .in('sale_id', saleIds);

      if (itemsError) throw itemsError;

      // Build currency map
      const currencyMap = new Map<string, { htg: number; usd: number }>();
      (items || []).forEach(item => {
        const existing = currencyMap.get(item.sale_id) || { htg: 0, usd: 0 };
        if (item.currency === 'USD') {
          existing.usd += item.subtotal;
        } else {
          existing.htg += item.subtotal;
        }
        currencyMap.set(item.sale_id, existing);
      });

      // Combine data
      const enrichedSales: TvaSaleData[] = (sales || []).map(sale => {
        const currencies = currencyMap.get(sale.id) || { htg: 0, usd: 0 };
        return {
          ...sale,
          htg_subtotal: currencies.htg,
          usd_subtotal: currencies.usd
        };
      });

      setSalesData(enrichedSales);

      // Calculate totals using centralized calculation logic
      const tvaRate = companySettings.tvaRate;
      const rate = companySettings.usdHtgRate;
      const displayCurrency = companySettings.displayCurrency;

      let totalHT_HTG = 0, totalHT_USD = 0;
      
      enrichedSales.forEach(sale => {
        // Convert items to format for currencyCalc
        const saleItems = [
          { subtotal: sale.htg_subtotal, currency: 'HTG' as const, profit_amount: 0 },
          { subtotal: sale.usd_subtotal, currency: 'USD' as const, profit_amount: 0 }
        ].filter(item => item.subtotal > 0);
        
        // Calculate unified subtotal
        const subtotalResult = currencyCalc.calculateUnifiedSubtotal(saleItems);
        
        // Subtract discount proportionally
        const totalRaw = sale.htg_subtotal + sale.usd_subtotal;
        const discountRatio = totalRaw > 0 ? sale.discount_amount / totalRaw : 0;
        
        totalHT_HTG += sale.htg_subtotal * (1 - discountRatio);
        totalHT_USD += sale.usd_subtotal * (1 - discountRatio);
      });

      const totalTVA_HTG = totalHT_HTG * tvaRate / 100;
      const totalTVA_USD = totalHT_USD * tvaRate / 100;
      const totalTTC_HTG = totalHT_HTG + totalTVA_HTG;
      const totalTTC_USD = totalHT_USD + totalTVA_USD;

      // Unified totals using currencyCalc.convert
      let unifiedTotalHT: number, unifiedTotalTVA: number, unifiedTotalTTC: number;
      if (displayCurrency === 'HTG') {
        unifiedTotalHT = totalHT_HTG + currencyCalc.convert(totalHT_USD, 'USD', 'HTG');
        unifiedTotalTVA = totalTVA_HTG + currencyCalc.convert(totalTVA_USD, 'USD', 'HTG');
        unifiedTotalTTC = totalTTC_HTG + currencyCalc.convert(totalTTC_USD, 'USD', 'HTG');
      } else {
        unifiedTotalHT = totalHT_USD + currencyCalc.convert(totalHT_HTG, 'HTG', 'USD');
        unifiedTotalTVA = totalTVA_USD + currencyCalc.convert(totalTVA_HTG, 'HTG', 'USD');
        unifiedTotalTTC = totalTTC_USD + currencyCalc.convert(totalTTC_HTG, 'HTG', 'USD');
      }

      setTotals({
        totalHT_HTG, totalHT_USD,
        totalTVA_HTG, totalTVA_USD,
        totalTTC_HTG, totalTTC_USD,
        unifiedTotalHT, unifiedTotalTVA, unifiedTotalTTC
      });

    } catch (error) {
      console.error('Error fetching TVA data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données TVA",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!companySettings) return;
    
    // Convert hook settings to pdfGenerator format
    const pdfCompanySettings = {
      company_name: companySettings.companyName,
      company_description: companySettings.companyDescription,
      address: companySettings.address,
      city: companySettings.city,
      phone: companySettings.phone,
      email: companySettings.email,
      tva_rate: companySettings.tvaRate,
      logo_url: companySettings.logoUrl || undefined,
      payment_terms: companySettings.paymentTerms || undefined,
      usd_htg_rate: companySettings.usdHtgRate,
      default_display_currency: companySettings.displayCurrency,
    };
    
    generateTvaReportPDF(
      salesData,
      pdfCompanySettings,
      { from: new Date(dateFrom), to: new Date(dateTo) },
      totals
    );
    
    toast({
      title: "Export réussi",
      description: "Le rapport TVA a été téléchargé"
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateCompact = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getTvaForSale = (sale: TvaSaleData) => {
    if (!companySettings || !currencyCalc) return { ht: 0, tva: 0, ttc: 0 };
    const tvaRate = companySettings.tvaRate;
    const displayCurrency = companySettings.displayCurrency;

    // Calculate HT after discount using centralized logic
    const totalRaw = sale.htg_subtotal + sale.usd_subtotal;
    const discountRatio = totalRaw > 0 ? sale.discount_amount / totalRaw : 0;
    const htHTG = sale.htg_subtotal * (1 - discountRatio);
    const htUSD = sale.usd_subtotal * (1 - discountRatio);

    // Convert to display currency
    const ht = currencyCalc.convert(htHTG, 'HTG', displayCurrency) + currencyCalc.convert(htUSD, 'USD', displayCurrency);

    const tva = ht * tvaRate / 100;
    const ttc = ht + tva;

    return { ht, tva, ttc };
  };

  const displayCurrency = companySettings?.displayCurrency || 'HTG';
  const tvaRate = companySettings?.tvaRate || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
            Rapport TVA Collectée
            <Badge 
              variant="outline" 
              className={`ml-auto text-xs px-2 py-0.5 ${
                displayCurrency === 'USD' 
                  ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' 
                  : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
              }`}
            >
              {displayCurrency === 'USD' ? '$ USD' : 'HTG'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 items-end">
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Date début</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-sm">Date fin</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <Button onClick={fetchTvaData} disabled={loading} className="h-8 sm:h-10 text-xs sm:text-sm">
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Générer</span>
            </Button>
            {salesData.length > 0 && (
              <Button variant="outline" onClick={handleExportPDF} className="h-8 sm:h-10 text-xs sm:text-sm">
                <Download className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Export PDF</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {salesData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Total HT</p>
              <p className="text-base sm:text-xl font-bold">
                {displayCurrency === 'HTG' 
                  ? `${formatNumber(totals.unifiedTotalHT)} HTG`
                  : `$${formatNumber(totals.unifiedTotalHT)}`
                }
              </p>
              {totals.totalHT_USD > 0 && totals.totalHT_HTG > 0 && (
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  <span>{formatNumber(totals.totalHT_HTG)} HTG</span>
                  <span className="mx-1">+</span>
                  <span>${formatNumber(totals.totalHT_USD)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">TVA ({tvaRate}%)</p>
              <p className="text-base sm:text-xl font-bold text-orange-600 dark:text-orange-400">
                {displayCurrency === 'HTG' 
                  ? `${formatNumber(totals.unifiedTotalTVA)} HTG`
                  : `$${formatNumber(totals.unifiedTotalTVA)}`
                }
              </p>
              {totals.totalTVA_USD > 0 && totals.totalTVA_HTG > 0 && (
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  <span>{formatNumber(totals.totalTVA_HTG)} HTG</span>
                  <span className="mx-1">+</span>
                  <span>${formatNumber(totals.totalTVA_USD)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Total TTC</p>
              <p className="text-base sm:text-xl font-bold text-green-600 dark:text-green-400">
                {displayCurrency === 'HTG' 
                  ? `${formatNumber(totals.unifiedTotalTTC)} HTG`
                  : `$${formatNumber(totals.unifiedTotalTTC)}`
                }
              </p>
              {totals.totalTTC_USD > 0 && totals.totalTTC_HTG > 0 && (
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  <span>{formatNumber(totals.totalTTC_HTG)} HTG</span>
                  <span className="mx-1">+</span>
                  <span>${formatNumber(totals.totalTTC_USD)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Details Table */}
      {salesData.length > 0 && (
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              Détail ({totalItems} ventes)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Date</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">N° Vente</TableHead>
                    <TableHead className="text-xs sm:text-sm">Client</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">HT</TableHead>
                    <TableHead className="text-center text-xs sm:text-sm hidden sm:table-cell">TVA</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">TVA</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">TTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((sale) => {
                    const { ht, tva, ttc } = getTvaForSale(sale);
                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="text-xs sm:text-sm">
                          <span className="sm:hidden">{formatDateCompact(sale.created_at)}</span>
                          <span className="hidden sm:inline">{formatDate(sale.created_at)}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs hidden sm:table-cell">
                          {sale.id.substring(0, 8)}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[80px] sm:max-w-none truncate">
                          {sale.customer_name || <span className="text-muted-foreground italic">-</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">
                          {displayCurrency === 'HTG' 
                            ? `${formatNumber(ht)}`
                            : `$${formatNumber(ht)}`
                          }
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{tvaRate}%</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm text-orange-600 dark:text-orange-400">
                          {displayCurrency === 'HTG' 
                            ? `${formatNumber(tva)}`
                            : `$${formatNumber(tva)}`
                          }
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm font-bold">
                          {displayCurrency === 'HTG' 
                            ? `${formatNumber(ttc)}`
                            : `$${formatNumber(ttc)}`
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
      )}

      {salesData.length === 0 && !loading && (
        <Card>
          <CardContent className="p-6 sm:p-8 text-center text-muted-foreground">
            <Calculator className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm sm:text-base">Sélectionnez une période et cliquez sur "Générer" pour voir le rapport TVA</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
