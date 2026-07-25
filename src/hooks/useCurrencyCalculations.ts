import { useMemo, useCallback } from 'react';
import { useCompanySettings, CompanySettings } from './useCompanySettings';
import { formatNumber } from '@/lib/utils';

// Types for sale items - compatible with database structure
export interface SaleItemForCalc {
  subtotal: number;
  currency?: string | null;
  profit_amount?: number | null;
  purchase_price_at_sale?: number | null;
  quantity?: number;
  unit_price?: number;
}

export interface SubtotalResult {
  htg: number;
  usd: number;
  unified: number;
  displayCurrency: 'USD' | 'HTG';
  hasMultipleCurrencies: boolean;
}

export interface TotalTTCResult {
  subtotalHT: number;
  discount: number;
  afterDiscount: number;
  tva: number;
  totalTTC: number;
  currency: 'USD' | 'HTG';
}

export interface CurrencyCalculations {
  // Settings access
  settings: CompanySettings;
  
  // Core conversion functions
  convert: (amount: number, from: 'USD' | 'HTG' | string | null, to: 'USD' | 'HTG') => number;
  
  // Formatting functions
  format: (amount: number, currency?: 'USD' | 'HTG') => string;
  formatCompact: (amount: number, currency?: 'USD' | 'HTG') => string;
  formatWithSymbol: (amount: number, currency: 'USD' | 'HTG') => string;
  
  // Calculate unified subtotal from multi-currency items
  calculateUnifiedSubtotal: (items: SaleItemForCalc[]) => SubtotalResult;
  
  // Calculate total TTC with discount and TVA applied
  calculateTotalTTC: (params: {
    items: SaleItemForCalc[];
    discountAmount?: number;
    discountCurrency?: 'USD' | 'HTG' | string | null;
  }) => TotalTTCResult;
  
  // Calculate unified profit with optional discount adjustment
  calculateUnifiedProfit: (items: SaleItemForCalc[], discountPercent?: number) => number;
  
  // Utility to get currency symbol
  getCurrencySymbol: (currency: 'USD' | 'HTG') => string;
}

export function useCurrencyCalculations(): CurrencyCalculations | null {
  const { settings, loading } = useCompanySettings();

  // Extract scalar values to avoid unstable object references in dependencies
  const usdHtgRate = settings.usdHtgRate;
  const displayCurrency = settings.displayCurrency;
  const tvaRate = settings.tvaRate;

  const convert = useCallback((
    amount: number,
    from: 'USD' | 'HTG' | string | null,
    to: 'USD' | 'HTG'
  ): number => {
    const sourceCurrency = (from || 'HTG') as 'USD' | 'HTG';
    if (sourceCurrency === to) return amount;
    
    return sourceCurrency === 'USD'
      ? amount * usdHtgRate  // USD to HTG
      : amount / usdHtgRate; // HTG to USD
  }, [usdHtgRate]);

  const format = useCallback((amount: number, currency?: 'USD' | 'HTG'): string => {
    return formatNumber(amount, 2);
  }, []);

  const formatCompact = useCallback((amount: number, currency?: 'USD' | 'HTG'): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return formatNumber(amount, 0);
  }, []);

  const formatWithSymbol = useCallback((amount: number, currency: 'USD' | 'HTG'): string => {
    const formatted = formatNumber(amount, 2);
    return currency === 'USD' ? `$${formatted}` : `${formatted} HTG`;
  }, []);

  const getCurrencySymbol = useCallback((currency: 'USD' | 'HTG'): string => {
    return currency === 'USD' ? '$' : 'HTG';
  }, []);

  const calculateUnifiedSubtotal = useCallback((items: SaleItemForCalc[]): SubtotalResult => {
    let htgTotal = 0;
    let usdTotal = 0;
    
    items.forEach(item => {
      const currency = item.currency || 'HTG';
      if (currency === 'USD') {
        usdTotal += item.subtotal;
      } else {
        htgTotal += item.subtotal;
      }
    });
    
    const hasMultipleCurrencies = htgTotal > 0 && usdTotal > 0;
    
    // Convert to display currency
    const unified = displayCurrency === 'USD'
      ? usdTotal + (htgTotal / usdHtgRate)
      : htgTotal + (usdTotal * usdHtgRate);
    
    return {
      htg: htgTotal,
      usd: usdTotal,
      unified,
      displayCurrency,
      hasMultipleCurrencies,
    };
  }, [displayCurrency, usdHtgRate]);

  const calculateTotalTTC = useCallback((params: {
    items: SaleItemForCalc[];
    discountAmount?: number;
    discountCurrency?: 'USD' | 'HTG' | string | null;
  }): TotalTTCResult => {
    const { items, discountAmount = 0, discountCurrency: discCurrency } = params;
    
    // Calculate unified subtotal
    const subtotalResult = calculateUnifiedSubtotal(items);
    const subtotalHT = subtotalResult.unified;
    
    // Convert discount to display currency if needed
    const discountInDisplayCurrency = discountAmount > 0
      ? convert(discountAmount, discCurrency || 'HTG', displayCurrency)
      : 0;
    
    // Apply discount
    const afterDiscount = Math.max(0, subtotalHT - discountInDisplayCurrency);
    
    // Calculate TVA on post-discount amount
    const tva = afterDiscount * (tvaRate / 100);
    
    // Final TTC
    const totalTTC = afterDiscount + tva;
    
    return {
      subtotalHT,
      discount: discountInDisplayCurrency,
      afterDiscount,
      tva,
      totalTTC,
      currency: displayCurrency,
    };
  }, [displayCurrency, tvaRate, calculateUnifiedSubtotal, convert]);

  const calculateUnifiedProfit = useCallback((
    items: SaleItemForCalc[],
    discountPercent: number = 0
  ): number => {
    let htgProfit = 0;
    let usdProfit = 0;
    
    items.forEach(item => {
      const profit = item.profit_amount || 0;
      const currency = item.currency || 'HTG';
      
      if (currency === 'USD') {
        usdProfit += profit;
      } else {
        htgProfit += profit;
      }
    });
    
    // Convert to display currency
    const unifiedProfit = displayCurrency === 'USD'
      ? usdProfit + (htgProfit / usdHtgRate)
      : htgProfit + (usdProfit * usdHtgRate);
    
    // Adjust for discount proportion (discount reduces profit proportionally)
    const adjustedProfit = unifiedProfit * (1 - discountPercent / 100);
    
    return adjustedProfit;
  }, [displayCurrency, usdHtgRate]);

  // Memoize the returned object to keep a stable reference
  // This prevents downstream effects from re-running when none of the dependencies changed
  const api = useMemo<CurrencyCalculations>(() => ({
    settings,
    convert,
    format,
    formatCompact,
    formatWithSymbol,
    getCurrencySymbol,
    calculateUnifiedSubtotal,
    calculateTotalTTC,
    calculateUnifiedProfit,
  }), [
    settings,
    convert,
    format,
    formatCompact,
    formatWithSymbol,
    getCurrencySymbol,
    calculateUnifiedSubtotal,
    calculateTotalTTC,
    calculateUnifiedProfit,
  ]);

  // Return null while loading to signal that calculations aren't ready
  if (loading) return null;

  return api;
}

// Pure utility functions for use outside of React (e.g., PDF generation)
// These require settings to be passed explicitly
export const currencyUtils = {
  convert: (
    amount: number,
    from: 'USD' | 'HTG' | string | null,
    to: 'USD' | 'HTG',
    usdHtgRate: number
  ): number => {
    const sourceCurrency = (from || 'HTG') as 'USD' | 'HTG';
    if (sourceCurrency === to) return amount;
    return sourceCurrency === 'USD'
      ? amount * usdHtgRate
      : amount / usdHtgRate;
  },

  formatWithSymbol: (amount: number, currency: 'USD' | 'HTG'): string => {
    const formatted = formatNumber(amount, 2);
    return currency === 'USD' ? `$${formatted}` : `${formatted} HTG`;
  },

  calculateUnifiedSubtotal: (
    items: SaleItemForCalc[],
    usdHtgRate: number,
    displayCurrency: 'USD' | 'HTG'
  ): SubtotalResult => {
    let htgTotal = 0;
    let usdTotal = 0;
    
    items.forEach(item => {
      const currency = item.currency || 'HTG';
      if (currency === 'USD') {
        usdTotal += item.subtotal;
      } else {
        htgTotal += item.subtotal;
      }
    });
    
    const hasMultipleCurrencies = htgTotal > 0 && usdTotal > 0;
    const unified = displayCurrency === 'USD'
      ? usdTotal + (htgTotal / usdHtgRate)
      : htgTotal + (usdTotal * usdHtgRate);
    
    return {
      htg: htgTotal,
      usd: usdTotal,
      unified,
      displayCurrency,
      hasMultipleCurrencies,
    };
  },

  calculateTotalTTC: (
    items: SaleItemForCalc[],
    discountAmount: number,
    discountCurrency: 'USD' | 'HTG' | string | null,
    usdHtgRate: number,
    displayCurrency: 'USD' | 'HTG',
    tvaRate: number
  ): TotalTTCResult => {
    const subtotalResult = currencyUtils.calculateUnifiedSubtotal(items, usdHtgRate, displayCurrency);
    const subtotalHT = subtotalResult.unified;
    
    const discountInDisplayCurrency = discountAmount > 0
      ? currencyUtils.convert(discountAmount, discountCurrency, displayCurrency, usdHtgRate)
      : 0;
    
    const afterDiscount = Math.max(0, subtotalHT - discountInDisplayCurrency);
    const tva = afterDiscount * (tvaRate / 100);
    const totalTTC = afterDiscount + tva;
    
    return {
      subtotalHT,
      discount: discountInDisplayCurrency,
      afterDiscount,
      tva,
      totalTTC,
      currency: displayCurrency,
    };
  },

  calculateUnifiedProfit: (
    items: SaleItemForCalc[],
    usdHtgRate: number,
    displayCurrency: 'USD' | 'HTG',
    discountPercent: number = 0
  ): number => {
    let htgProfit = 0;
    let usdProfit = 0;
    
    items.forEach(item => {
      const profit = item.profit_amount || 0;
      const currency = item.currency || 'HTG';
      
      if (currency === 'USD') {
        usdProfit += profit;
      } else {
        htgProfit += profit;
      }
    });
    
    const unifiedProfit = displayCurrency === 'USD'
      ? usdProfit + (htgProfit / usdHtgRate)
      : htgProfit + (usdProfit * usdHtgRate);
    
    return unifiedProfit * (1 - discountPercent / 100);
  },
};
