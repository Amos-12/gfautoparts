import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Printer, Receipt as ReceiptIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateReceipt, generateInvoice } from '@/lib/pdfGenerator';
import { toast } from '@/hooks/use-toast';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCurrencyCalculations } from '@/hooks/useCurrencyCalculations';
import { formatLocalizedDateTime } from '@/lib/locale';

interface SaleDetailsDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  unit?: string;
  currency?: string;
  products?: {
    category: string;
    diametre?: string;
    bars_per_ton?: number;
    surface_par_boite?: number;
  };
}

export const SaleDetailsDialog = ({ saleId, open, onOpenChange }: SaleDetailsDialogProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);
  const [sellerName, setSellerName] = useState('');

  const { settings: companySettings } = useCompanySettings();
  const currencyCalc = useCurrencyCalculations();

  useEffect(() => {
    if (open && saleId) {
      loadSaleDetails();
    }
  }, [open, saleId]);

  const loadSaleDetails = async () => {
    if (!saleId) return;
    try {
      setLoading(true);
      const { data: sale, error: saleError } = await supabase
        .from('sales').select('*').eq('id', saleId).single();
      if (saleError) throw saleError;

      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('user_id', sale.seller_id).single();
      setSellerName(profile?.full_name || 'N/A');

      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select(`*, products:product_id (category, diametre, bars_per_ton, surface_par_boite)`)
        .eq('sale_id', saleId);
      if (itemsError) throw itemsError;

      setSaleData({ ...sale, items: (items || []) as SaleItem[] });
    } catch (error) {
      console.error('Error loading sale details:', error);
      toast({ title: t('common.error'), description: t('sales.loadError'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const currencySubtotals = useMemo(() => {
    if (!saleData?.items) return { usd: 0, htg: 0, hasMultipleCurrencies: false };
    const subtotals = { usd: 0, htg: 0 };
    saleData.items.forEach((item: SaleItem) => {
      const currency = item.currency || 'HTG';
      if (currency === 'USD') subtotals.usd += item.subtotal;
      else subtotals.htg += item.subtotal;
    });
    return { ...subtotals, hasMultipleCurrencies: subtotals.usd > 0 && subtotals.htg > 0 };
  }, [saleData?.items]);

  const formatCurrencyAmount = (amount: number, currency: string = 'HTG'): string => {
    const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return currency === 'USD' ? `$${formatted}` : `${formatted} HTG`;
  };

  const formatNumber = (amount: number): string => {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const handlePrintReceipt = () => {
    if (!saleData || !companySettings) return;
    const pdfSettings = {
      company_name: companySettings.companyName, company_description: companySettings.companyDescription,
      address: companySettings.address, city: companySettings.city, phone: companySettings.phone,
      email: companySettings.email, tva_rate: companySettings.tvaRate,
      logo_url: companySettings.logoUrl || undefined, payment_terms: companySettings.paymentTerms || undefined,
      usd_htg_rate: companySettings.usdHtgRate, default_display_currency: companySettings.displayCurrency,
    };
    const cartItems = saleData.items.map((item: SaleItem) => ({
      id: item.product_id, name: item.product_name, category: item.products?.category || 'general',
      unit: item.unit || 'unité', cartQuantity: item.quantity, price: item.unit_price,
      actualPrice: item.subtotal, displayUnit: item.unit, currency: item.currency || 'HTG',
      diametre: item.products?.diametre, bars_per_ton: item.products?.bars_per_ton,
      surface_par_boite: item.products?.surface_par_boite
    }));
    generateReceipt(saleData, pdfSettings, cartItems, sellerName);
  };

  const handlePrintInvoice = () => {
    if (!saleData || !companySettings) return;
    const pdfSettings = {
      company_name: companySettings.companyName, company_description: companySettings.companyDescription,
      address: companySettings.address, city: companySettings.city, phone: companySettings.phone,
      email: companySettings.email, tva_rate: companySettings.tvaRate,
      logo_url: companySettings.logoUrl || undefined, payment_terms: companySettings.paymentTerms || undefined,
      usd_htg_rate: companySettings.usdHtgRate, default_display_currency: companySettings.displayCurrency,
    };
    const cartItems = saleData.items.map((item: SaleItem) => ({
      id: item.product_id, name: item.product_name, category: item.products?.category || 'general',
      unit: item.unit || 'unité', cartQuantity: item.quantity, price: item.unit_price,
      actualPrice: item.subtotal, displayUnit: item.unit, currency: item.currency || 'HTG',
      diametre: item.products?.diametre, bars_per_ton: item.products?.bars_per_ton,
      surface_par_boite: item.products?.surface_par_boite
    }));
    generateInvoice(saleData, pdfSettings, cartItems, sellerName);
  };

  const getUnifiedTotals = (): { subtotal: number; tva: number; total: number; currency: string; tvaRate: number } => {
    if (!companySettings || !saleData || !currencyCalc) {
      return { subtotal: 0, tva: 0, total: saleData?.total_amount || 0, currency: 'HTG', tvaRate: 0 };
    }
    const displayCurrency = companySettings.displayCurrency;
    const tvaRate = companySettings.tvaRate;
    const saleItems = saleData.items.map((item: SaleItem) => ({
      subtotal: item.subtotal, currency: (item.currency || 'HTG') as 'USD' | 'HTG', profit_amount: 0
    }));
    const result = currencyCalc.calculateTotalTTC({
      items: saleItems, discountAmount: saleData.discount_amount || 0,
      discountCurrency: (saleData.discount_currency as 'USD' | 'HTG') || 'HTG'
    });
    return { subtotal: result.subtotalHT, tva: result.tva, total: result.totalTTC, currency: displayCurrency, tvaRate };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-auto max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle className="text-base sm:text-lg">{t('sales.details.title')}</DialogTitle>
          {companySettings?.displayCurrency && (
            <Badge 
              variant="outline" 
              className={`text-xs px-2 py-1 ${
                companySettings.displayCurrency === 'USD' 
                  ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' 
                  : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
              }`}
            >
              {t('sales.display')}: {companySettings.displayCurrency === 'USD' ? '$ USD' : 'HTG'}
            </Badge>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">{t('common.loading')}</div>
        ) : saleData ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t('sales.details.date')}:</span>
                <p className="text-xs sm:text-sm">{formatLocalizedDateTime(saleData.created_at)}</p>
              </div>
              <div>
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t('sales.details.seller')}:</span>
                <p className="text-xs sm:text-sm">{sellerName}</p>
              </div>
              {saleData.customer_name && (
                <div>
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t('sales.details.client')}:</span>
                  <p className="text-xs sm:text-sm">{saleData.customer_name}</p>
                </div>
              )}
              {saleData.customer_address && (
                <div>
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t('sales.details.address')}:</span>
                  <p className="text-xs sm:text-sm">{saleData.customer_address}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-sm sm:text-base">{t('sales.details.items')}</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">{t('sales.details.product')}</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm hidden sm:table-cell">{t('sales.details.currency')}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">{t('sales.details.qty')}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">{t('sales.details.unitPrice')}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">{t('sales.details.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleData.items.map((item: SaleItem) => {
                      const currency = item.currency || 'HTG';
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">
                            {item.product_name}
                            <span className="sm:hidden ml-1">
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${currency === 'USD' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                {currency === 'USD' ? '$' : 'G'}
                              </Badge>
                            </span>
                          </TableCell>
                          <TableCell className="text-center hidden sm:table-cell">
                            <Badge variant="outline" className={currency === 'USD' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}>
                              {currency === 'USD' ? '$ USD' : 'G HTG'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap">
                            {item.quantity} {item.unit || ''}
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                            {formatCurrencyAmount(item.unit_price, currency)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-xs sm:text-sm whitespace-nowrap">
                            {formatCurrencyAmount(item.subtotal, currency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-1 sm:space-y-2 border-t pt-3 sm:pt-4 text-xs sm:text-sm">
              {currencySubtotals.hasMultipleCurrencies ? (
                <>
                  <div className="flex justify-between">
                    <span>{t('sales.details.subtotalUSD')}:</span>
                    <span className="text-green-600 dark:text-green-400">${formatNumber(currencySubtotals.usd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('sales.details.subtotalHTG')}:</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatNumber(currencySubtotals.htg)} HTG</span>
                  </div>
                  {companySettings && (
                    <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground border-t pt-2">
                      <span>{t('sales.details.rate')}:</span>
                      <span>1 USD = {companySettings.usdHtgRate || 132} HTG</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between">
                  <span>{t('sales.details.subtotal')}:</span>
                  <span>
                    {currencySubtotals.usd > 0 
                      ? `$${formatNumber(currencySubtotals.usd)}`
                      : `${formatNumber(currencySubtotals.htg)} HTG`
                    }
                  </span>
                </div>
              )}
              
              {saleData.discount_amount > 0 && (
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>
                    {t('common.discount')}
                    {saleData.discount_type === 'percentage' && ` (${saleData.discount_value}%)`}:
                  </span>
                  <span>
                    {(() => {
                      const displayCurr = companySettings?.displayCurrency || 'HTG';
                      const rate = companySettings?.usdHtgRate || 132;
                      const discountCurrency = saleData.discount_currency || 'HTG';
                      let discountConverted = saleData.discount_amount;
                      if (discountCurrency !== displayCurr) {
                        if (discountCurrency === 'HTG' && displayCurr === 'USD') discountConverted = saleData.discount_amount / rate;
                        else discountConverted = saleData.discount_amount * rate;
                      }
                      return `-${formatCurrencyAmount(discountConverted, displayCurr)}`;
                    })()}
                  </span>
                </div>
              )}
              
              {getUnifiedTotals().tvaRate > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>{t('sales.details.subtotalHT')}:</span>
                    <span>{formatCurrencyAmount(getUnifiedTotals().subtotal, getUnifiedTotals().currency)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>TVA ({getUnifiedTotals().tvaRate}%):</span>
                    <span>{formatCurrencyAmount(getUnifiedTotals().tva, getUnifiedTotals().currency)}</span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between text-sm sm:text-lg font-bold border-t pt-2">
                <span>{getUnifiedTotals().tvaRate > 0 ? `${t('sales.details.totalTTC')}:` : `${t('common.total')}:`}</span>
                <span className="text-primary">
                  {formatCurrencyAmount(getUnifiedTotals().total, getUnifiedTotals().currency)}
                </span>
              </div>
              
              <div className="flex justify-between text-muted-foreground">
                <span>{t('sales.details.paymentMethod')}:</span>
                <span className="capitalize">{saleData.payment_method}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end border-t pt-3 sm:pt-4">
              <Button variant="outline" onClick={handlePrintReceipt} className="text-xs sm:text-sm">
                <ReceiptIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                {t('common.receipt')}
              </Button>
              <Button onClick={handlePrintInvoice} className="text-xs sm:text-sm">
                <Printer className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                {t('common.invoice')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">{t('common.noData')}</div>
        )}
      </DialogContent>
    </Dialog>
  );
};
