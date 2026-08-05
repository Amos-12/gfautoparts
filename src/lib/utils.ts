import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// Calculate unified total from multi-currency items
export function calculateUnifiedTotal(
  items: Array<{ subtotal: number; currency?: string | null }>,
  usdHtgRate: number,
  displayCurrency: 'USD' | 'HTG' = 'HTG'
): { htg: number; usd: number; unified: number } {
  let htgTotal = 0;
  let usdTotal = 0;
  
  items.forEach(item => {
    if (item.currency === 'USD') {
      usdTotal += item.subtotal;
    } else {
      htgTotal += item.subtotal;
    }
  });
  
  const unified = displayCurrency === 'USD'
    ? usdTotal + (htgTotal / usdHtgRate)
    : htgTotal + (usdTotal * usdHtgRate);
  
  return {
    htg: htgTotal,
    usd: usdTotal,
    unified
  };
}

// Calculate unified profit from multi-currency items
export function calculateUnifiedProfit(
  items: Array<{ profit_amount?: number | null; currency?: string | null }>,
  usdHtgRate: number,
  displayCurrency: 'USD' | 'HTG' = 'HTG'
): number {
  let htgProfit = 0;
  let usdProfit = 0;
  
  items.forEach(item => {
    const profit = item.profit_amount || 0;
    if (item.currency === 'USD') {
      usdProfit += profit;
    } else {
      htgProfit += profit;
    }
  });
  
  return displayCurrency === 'USD'
    ? usdProfit + (htgProfit / usdHtgRate)
    : htgProfit + (usdProfit * usdHtgRate);
}

// Format currency value with symbol
export function formatCurrencyValue(amount: number, currency: 'USD' | 'HTG'): string {
  return currency === 'USD'
    ? `$${formatNumber(amount)}`
    : `${formatNumber(amount)} HTG`;
}

// Convert amount from source currency to target currency
export function convertCurrency(
  amount: number,
  sourceCurrency: 'USD' | 'HTG' | string | null,
  targetCurrency: 'USD' | 'HTG',
  usdHtgRate: number
): number {
  const source = (sourceCurrency || 'HTG') as 'USD' | 'HTG';
  if (source === targetCurrency) return amount;
  
  return source === 'USD'
    ? amount * usdHtgRate     // USD vers HTG
    : amount / usdHtgRate;    // HTG vers USD
}

// Format AND convert an amount
export function formatConvertedCurrency(
  amount: number,
  sourceCurrency: 'USD' | 'HTG' | string | null,
  targetCurrency: 'USD' | 'HTG',
  usdHtgRate: number
): string {
  const converted = convertCurrency(amount, sourceCurrency, targetCurrency, usdHtgRate);
  return formatCurrencyValue(converted, targetCurrency);
}
