import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const FREE_PLANS = ['trial', 'free', 'gratuit', ''];

export interface SubscriptionStatus {
  plan: string;
  isFreePlan: boolean;
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number;
  subscriptionEnd: string | null;
  maxUsers: number;
  maxProducts: number;
  maxSalesMonthly: number;
  companyName: string;
}

const DEFAULT_STATUS: SubscriptionStatus = {
  plan: 'trial',
  isFreePlan: true,
  isActive: true,
  isExpired: false,
  daysRemaining: 30,
  subscriptionEnd: null,
  maxUsers: 3,
  maxProducts: 50,
  maxSalesMonthly: 100,
  companyName: '',
};

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('name, is_active, subscription_plan, subscription_end, max_users, max_products')
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          setLoading(false);
          return;
        }

        // Fetch plan limits from subscription_plans
        let maxSalesMonthly = 100;
        if (data.subscription_plan) {
          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('max_sales_monthly')
            .eq('id', data.subscription_plan)
            .maybeSingle();
          if (planData?.max_sales_monthly) {
            maxSalesMonthly = planData.max_sales_monthly;
          }
        }

        const today = new Date().toISOString().split('T')[0];
        const isExpired = data.subscription_end ? data.subscription_end < today : false;
        const daysRemaining = data.subscription_end
          ? Math.max(0, Math.ceil((new Date(data.subscription_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;

        const planValue = data.subscription_plan || 'trial';
        const isFreePlan = FREE_PLANS.includes(planValue.toLowerCase());

        setStatus({
          plan: planValue,
          isFreePlan,
          isActive: data.is_active ?? true,
          isExpired,
          daysRemaining,
          subscriptionEnd: data.subscription_end,
          maxUsers: data.max_users ?? 3,
          maxProducts: data.max_products ?? 50,
          maxSalesMonthly,
          companyName: data.name || '',
        });
      } catch (err) {
        console.error('Error fetching subscription:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  return { ...status, loading };
}
