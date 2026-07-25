import { useMemo, useCallback } from 'react';
import { useCurrencyCalculations, SaleItemForCalc, currencyUtils } from './useCurrencyCalculations';
import { useCompanySettings } from './useCompanySettings';

// Types for sales data
export interface SaleForCalc {
  id: string;
  created_at: string;
  total_amount: number;
  subtotal?: number;
  discount_amount?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
  discount_currency?: string | null;
  seller_id?: string;
  customer_name?: string | null;
  payment_method?: string | null;
}

export interface PeriodStats {
  count: number;
  revenueTTC: number;
  revenueHT: number;
  profitNet: number;
  avgBasket: number;
  tvaCollected: number;
  totalDiscount: number;
}

export interface SaleCalculations {
  // Calculate revenue TTC from sales with items (correctly applying discounts)
  calculateRevenueTTC: (sales: SaleForCalc[], saleItems: SaleItemForCalc[]) => number;
  
  // Calculate HT subtotal (before TVA, after discount)
  calculateRevenueHT: (sales: SaleForCalc[], saleItems: SaleItemForCalc[]) => number;
  
  // Calculate net profit (adjusted for discounts)
  calculateNetProfit: (sales: SaleForCalc[], saleItems: SaleItemForCalc[]) => number;
  
  // Calculate TVA collected
  calculateTvaCollected: (sales: SaleForCalc[], saleItems: SaleItemForCalc[]) => number;
  
  // Calculate stats for a specific period
  calculatePeriodStats: (
    sales: SaleForCalc[],
    saleItems: SaleItemForCalc[],
    startDate: Date,
    endDate?: Date
  ) => PeriodStats;
  
  // Calculate total for a single sale with items
  calculateSaleTotal: (sale: SaleForCalc, items: SaleItemForCalc[]) => {
    subtotalHT: number;
    discount: number;
    afterDiscount: number;
    tva: number;
    totalTTC: number;
    profit: number;
    currency: 'USD' | 'HTG';
  };
  
  // Get display currency
  displayCurrency: 'USD' | 'HTG';
  
  // Get USD to HTG rate
  usdHtgRate: number;
  
  // Get TVA rate
  tvaRate: number;
}

export function useSaleCalculations(): SaleCalculations | null {
  const calc = useCurrencyCalculations();
  const { settings, loading } = useCompanySettings();

  // Extract scalar values to avoid unstable object references in dependencies
  const usdHtgRate = settings.usdHtgRate;
  const displayCurrency = settings.displayCurrency;
  const tvaRate = settings.tvaRate;

  const calculateSaleTotal = useCallback((sale: SaleForCalc, items: SaleItemForCalc[]) => {
    // Use the discount_currency from the sale, fallback to HTG for older sales
    const discountCurrency = (sale.discount_currency || 'HTG') as 'USD' | 'HTG';
    
    if (!calc) {
      // Fallback calculation without hook
      const result = currencyUtils.calculateTotalTTC(
        items,
        sale.discount_amount || 0,
        discountCurrency,
        usdHtgRate,
        displayCurrency,
        tvaRate
      );
      
      const profit = currencyUtils.calculateUnifiedProfit(
        items,
        usdHtgRate,
        displayCurrency,
        result.subtotalHT > 0 ? (result.discount / result.subtotalHT) * 100 : 0
      );
      
      return { ...result, profit };
    }
    
    const result = calc.calculateTotalTTC({
      items,
      discountAmount: sale.discount_amount || 0,
      discountCurrency: discountCurrency,
    });
    
    // Calculate profit with discount adjustment
    const discountPercent = result.subtotalHT > 0 
      ? (result.discount / result.subtotalHT) * 100 
      : 0;
    const profit = calc.calculateUnifiedProfit(items, discountPercent);
    
    return { ...result, profit };
  }, [calc, usdHtgRate, displayCurrency, tvaRate]);

  const calculateRevenueTTC = useCallback((
    sales: SaleForCalc[],
    saleItems: SaleItemForCalc[]
  ): number => {
    // Group items by sale_id for efficient lookup
    const itemsBySale = new Map<string, SaleItemForCalc[]>();
    saleItems.forEach(item => {
      const saleId = (item as any).sale_id;
      if (saleId) {
        if (!itemsBySale.has(saleId)) {
          itemsBySale.set(saleId, []);
        }
        itemsBySale.get(saleId)!.push(item);
      }
    });

    let totalTTC = 0;
    
    sales.forEach(sale => {
      const items = itemsBySale.get(sale.id) || [];
      const saleResult = calculateSaleTotal(sale, items);
      totalTTC += saleResult.totalTTC;
    });
    
    return totalTTC;
  }, [calculateSaleTotal]);

  const calculateRevenueHT = useCallback((
    sales: SaleForCalc[],
    saleItems: SaleItemForCalc[]
  ): number => {
    const itemsBySale = new Map<string, SaleItemForCalc[]>();
    saleItems.forEach(item => {
      const saleId = (item as any).sale_id;
      if (saleId) {
        if (!itemsBySale.has(saleId)) {
          itemsBySale.set(saleId, []);
        }
        itemsBySale.get(saleId)!.push(item);
      }
    });

    let totalHT = 0;
    
    sales.forEach(sale => {
      const items = itemsBySale.get(sale.id) || [];
      const saleResult = calculateSaleTotal(sale, items);
      totalHT += saleResult.afterDiscount;
    });
    
    return totalHT;
  }, [calculateSaleTotal]);

  const calculateNetProfit = useCallback((
    sales: SaleForCalc[],
    saleItems: SaleItemForCalc[]
  ): number => {
    const itemsBySale = new Map<string, SaleItemForCalc[]>();
    saleItems.forEach(item => {
      const saleId = (item as any).sale_id;
      if (saleId) {
        if (!itemsBySale.has(saleId)) {
          itemsBySale.set(saleId, []);
        }
        itemsBySale.get(saleId)!.push(item);
      }
    });

    let totalProfit = 0;
    
    sales.forEach(sale => {
      const items = itemsBySale.get(sale.id) || [];
      const saleResult = calculateSaleTotal(sale, items);
      totalProfit += saleResult.profit;
    });
    
    return totalProfit;
  }, [calculateSaleTotal]);

  const calculateTvaCollected = useCallback((
    sales: SaleForCalc[],
    saleItems: SaleItemForCalc[]
  ): number => {
    const itemsBySale = new Map<string, SaleItemForCalc[]>();
    saleItems.forEach(item => {
      const saleId = (item as any).sale_id;
      if (saleId) {
        if (!itemsBySale.has(saleId)) {
          itemsBySale.set(saleId, []);
        }
        itemsBySale.get(saleId)!.push(item);
      }
    });

    let totalTva = 0;
    
    sales.forEach(sale => {
      const items = itemsBySale.get(sale.id) || [];
      const saleResult = calculateSaleTotal(sale, items);
      totalTva += saleResult.tva;
    });
    
    return totalTva;
  }, [calculateSaleTotal]);

  const calculatePeriodStats = useCallback((
    sales: SaleForCalc[],
    saleItems: SaleItemForCalc[],
    startDate: Date,
    endDate?: Date
  ): PeriodStats => {
    // Filter sales by period
    const periodSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      const afterStart = saleDate >= startDate;
      const beforeEnd = endDate ? saleDate <= endDate : true;
      return afterStart && beforeEnd;
    });

    // Get item IDs for filtered sales
    const saleIds = new Set(periodSales.map(s => s.id));
    const periodItems = saleItems.filter(item => {
      const saleId = (item as any).sale_id;
      return saleId && saleIds.has(saleId);
    });

    const revenueTTC = calculateRevenueTTC(periodSales, periodItems);
    const revenueHT = calculateRevenueHT(periodSales, periodItems);
    const profitNet = calculateNetProfit(periodSales, periodItems);
    const tvaCollected = calculateTvaCollected(periodSales, periodItems);

    // Calculate total discount using discount_currency
    let totalDiscount = 0;
    periodSales.forEach(sale => {
      if (sale.discount_amount) {
        const discCurrency = (sale.discount_currency || 'HTG') as 'USD' | 'HTG';
        // Convert discount to display currency
        totalDiscount += currencyUtils.convert(
          sale.discount_amount,
          discCurrency,
          displayCurrency,
          usdHtgRate
        );
      }
    });

    return {
      count: periodSales.length,
      revenueTTC,
      revenueHT,
      profitNet,
      avgBasket: periodSales.length > 0 ? revenueTTC / periodSales.length : 0,
      tvaCollected,
      totalDiscount,
    };
  }, [calculateRevenueTTC, calculateRevenueHT, calculateNetProfit, calculateTvaCollected, displayCurrency, usdHtgRate]);

  // Memoize to keep a stable reference; prevents downstream effects from re-running endlessly.
  // IMPORTANT: This must be called unconditionally to respect the Rules of Hooks.
  const result = useMemo<SaleCalculations>(
    () => ({
      calculateRevenueTTC,
      calculateRevenueHT,
      calculateNetProfit,
      calculateTvaCollected,
      calculatePeriodStats,
      calculateSaleTotal,
      displayCurrency,
      usdHtgRate,
      tvaRate,
    }),
    [
      calculateRevenueTTC,
      calculateRevenueHT,
      calculateNetProfit,
      calculateTvaCollected,
      calculatePeriodStats,
      calculateSaleTotal,
      displayCurrency,
      usdHtgRate,
      tvaRate,
    ]
  );

  // Return null while loading (AFTER all hooks have been called)
  if (loading) return null;

  return result;
}

// Pure utility functions for use outside of React (e.g., PDF generation)
export const saleCalculationUtils = {
  calculateSaleTotal: (
    sale: SaleForCalc,
    items: SaleItemForCalc[],
    usdHtgRate: number,
    displayCurrency: 'USD' | 'HTG',
    tvaRate: number
  ) => {
    // Use the discount_currency from the sale, fallback to HTG for older sales
    const discountCurrency = (sale.discount_currency || 'HTG') as 'USD' | 'HTG';
    
    const result = currencyUtils.calculateTotalTTC(
      items,
      sale.discount_amount || 0,
      discountCurrency,
      usdHtgRate,
      displayCurrency,
      tvaRate
    );
    
    const discountPercent = result.subtotalHT > 0 
      ? (result.discount / result.subtotalHT) * 100 
      : 0;
    const profit = currencyUtils.calculateUnifiedProfit(
      items,
      usdHtgRate,
      displayCurrency,
      discountPercent
    );
    
    return { ...result, profit };
  },
};
