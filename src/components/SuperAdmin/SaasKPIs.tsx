import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Users, DollarSign, Clock } from 'lucide-react';
import { KPICard } from '@/components/Dashboard/KPICard';
import { useTranslation } from 'react-i18next';

interface SaasStats {
  totalCompanies: number;
  activeCompanies: number;
  trialCompanies: number;
  expiredCompanies: number;
  totalUsers: number;
  mrr: number;
}

export const SaasKPIs = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SaasStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    trialCompanies: 0,
    expiredCompanies: 0,
    totalUsers: 0,
    mrr: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, is_active, subscription_plan, subscription_end');

        const { count: userCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (companies) {
          const today = new Date().toISOString().split('T')[0];
          const active = companies.filter((c) => c.is_active && c.subscription_end >= today);
          const trial = companies.filter((c) => c.subscription_plan === 'trial' && c.subscription_end >= today);
          const expired = companies.filter((c) => c.subscription_end < today);

          const planPrices: Record<string, number> = { basic: 19, pro: 39, premium: 59 };
          const mrr = companies
            .filter((c) => c.is_active && c.subscription_end >= today && c.subscription_plan !== 'trial')
            .reduce((sum, c) => sum + (planPrices[c.subscription_plan] || 0), 0);

          setStats({
            totalCompanies: companies.length,
            activeCompanies: active.length,
            trialCompanies: trial.length,
            expiredCompanies: expired.length,
            totalUsers: userCount || 0,
            mrr,
          });
        }
      } catch (err) {
        console.error('Error fetching SaaS stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 sm:h-28 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      <KPICard
        title={t('superAdmin.kpis.companies')}
        value={stats.totalCompanies}
        previousValue={stats.activeCompanies}
        icon={Building2}
        format="number"
        colorScheme="admin-revenue"
        size="sm"
      />
      <KPICard
        title={t('superAdmin.kpis.users')}
        value={stats.totalUsers}
        icon={Users}
        format="number"
        colorScheme="admin-sellers"
        size="sm"
      />
      <KPICard
        title={t('superAdmin.kpis.mrr')}
        value={stats.mrr}
        icon={DollarSign}
        format="currency"
        currency="USD"
        colorScheme="admin-profit"
        size="sm"
      />
      <KPICard
        title={t('superAdmin.kpis.trial')}
        value={stats.trialCompanies}
        icon={Clock}
        format="number"
        colorScheme="warning"
        size="sm"
      />
    </div>
  );
};
