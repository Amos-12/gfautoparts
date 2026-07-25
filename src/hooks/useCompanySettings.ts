import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanySettings {
  usdHtgRate: number;
  displayCurrency: 'USD' | 'HTG';
  tvaRate: number;
  companyName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  paymentTerms: string | null;
  companyDescription: string | null;
}

const DEFAULT_SETTINGS: CompanySettings = {
  usdHtgRate: 132,
  displayCurrency: 'HTG',
  tvaRate: 10,
  companyName: 'SYSTEM MANAGEMENT',
  address: '123 Rue Principale',
  city: 'CAYES 8110',
  phone: '+221 XX XXX XX XX',
  email: 'contact@systemmanagement.sn',
  logoUrl: null,
  paymentTerms: 'Paiement comptant ou à crédit selon accord',
  companyDescription: 'Gestion de la comptabilité',
};

interface UseCompanySettingsReturn {
  settings: CompanySettings;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// Cache for settings to avoid multiple fetches
let cachedSettings: CompanySettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // 1 minute

export function useCompanySettings(): UseCompanySettingsReturn {
  const [settings, setSettings] = useState<CompanySettings>(cachedSettings || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!cachedSettings);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async (forceRefresh = false) => {
    // Use cache if available and not expired
    const now = Date.now();
    if (!forceRefresh && cachedSettings && (now - cacheTimestamp) < CACHE_DURATION) {
      setSettings(cachedSettings);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        const newSettings: CompanySettings = {
          usdHtgRate: Number(data.usd_htg_rate) || DEFAULT_SETTINGS.usdHtgRate,
          displayCurrency: (data.default_display_currency as 'USD' | 'HTG') || DEFAULT_SETTINGS.displayCurrency,
          tvaRate: Number(data.tva_rate) || DEFAULT_SETTINGS.tvaRate,
          companyName: data.company_name || DEFAULT_SETTINGS.companyName,
          address: data.address || DEFAULT_SETTINGS.address,
          city: data.city || DEFAULT_SETTINGS.city,
          phone: data.phone || DEFAULT_SETTINGS.phone,
          email: data.email || DEFAULT_SETTINGS.email,
          logoUrl: data.logo_url,
          paymentTerms: data.payment_terms,
          companyDescription: data.company_description,
        };

        cachedSettings = newSettings;
        cacheTimestamp = now;
        setSettings(newSettings);
      }
    } catch (err) {
      console.error('Error fetching company settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchSettings(true);
  }, [fetchSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, error, refresh };
}

// Utility function to clear cache (useful for testing or after settings update)
export function clearCompanySettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}
