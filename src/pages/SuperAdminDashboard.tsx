import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SaasKPIs } from '@/components/SuperAdmin/SaasKPIs';
import { CompanyList } from '@/components/SuperAdmin/CompanyList';
import { GlobalUsersPanel } from '@/components/SuperAdmin/GlobalUsersPanel';
import { GlobalActivityLogs } from '@/components/SuperAdmin/GlobalActivityLogs';
import { SuperAdminDbMonitoring } from '@/components/SuperAdmin/SuperAdminDbMonitoring';
import { SubscriptionPlansManager } from '@/components/SuperAdmin/SubscriptionPlansManager';
import { PaymentsPanel } from '@/components/SuperAdmin/PaymentsPanel';
import { PaymentExchangeRateSettings } from '@/components/SuperAdmin/PaymentExchangeRateSettings';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Shield, Building2, Users, Activity, Database, CreditCard, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logo from '@/assets/logo.png';

const SuperAdminDashboard = () => {
  const { t } = useTranslation();
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role !== null && (!user || role !== 'super_admin')) {
      navigate('/auth');
    }
  }, [user, role, loading, navigate]);

  if (loading || role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src={logo} alt="Logo" className="w-14 h-14 object-contain mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-bold text-primary">{t('superAdmin.title')}</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{t('superAdmin.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{t('auth.signOut')}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <SaasKPIs />

        <Tabs defaultValue="companies" className="w-full">
          <TabsList className="w-full flex overflow-x-auto">
            <TabsTrigger value="companies" className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('superAdmin.companies')}</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t('superAdmin.users')}</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('superAdmin.plans')}</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">{t('superAdmin.activity')}</span>
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">{t('superAdmin.database')}</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">{t('superAdmin.payments')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-6">
            <CompanyList />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <GlobalUsersPanel />
          </TabsContent>
          <TabsContent value="plans" className="mt-6">
            <SubscriptionPlansManager />
          </TabsContent>
          <TabsContent value="logs" className="mt-6">
            <GlobalActivityLogs />
          </TabsContent>
          <TabsContent value="database" className="mt-6">
            <SuperAdminDbMonitoring />
          </TabsContent>
          <TabsContent value="payments" className="mt-6">
            <div className="space-y-6">
              <PaymentExchangeRateSettings />
              <PaymentsPanel />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;
