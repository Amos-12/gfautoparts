import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { AdminDashboardCharts } from '@/components/Dashboard/AdminDashboardCharts';
import { AnalyticsDashboard } from '@/components/Dashboard/AnalyticsDashboard';
import { UserManagementPanel } from '@/components/UserManagement/UserManagementPanel';
import { AdvancedReports } from '@/components/Reports/AdvancedReports';
import { TvaReport } from '@/components/Reports/TvaReport';
import { StockAlerts } from '@/components/Notifications/StockAlerts';
import { ProductManagement } from '@/components/Products/ProductManagement';
import { SalesManagement } from '@/components/Sales/SalesManagement';
import { CompanySettings } from '@/components/Settings/CompanySettings';
import { ActivityLogPanel } from '@/components/ActivityLog/ActivityLogPanel';
import { DatabaseMonitoring } from '@/components/Settings/DatabaseMonitoring';
import { SellerPerformanceReport } from '@/components/Reports/SellerPerformanceReport';
import { CategoryManagement } from '@/components/Categories/CategoryManagement';
import { useSubscription } from '@/hooks/useSubscription';
import { ExpiredScreen } from '@/components/Subscription/ExpiredScreen';
import { LockedFeature } from '@/components/Subscription/LockedFeature';
import { UpgradeBanner } from '@/components/Subscription/UpgradeBanner';
import { useAuth } from '@/hooks/useAuth';

const AdminDashboard = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [currentSection, setCurrentSection] = useState(searchParams.get('section') || 'dashboard');
  const { isExpired, plan, isFreePlan, companyName, loading: subLoading } = useSubscription();
  const { signOut } = useAuth();

  if (!subLoading && isExpired) {
    return <ExpiredScreen companyName={companyName} currentPlan={plan} onLogout={signOut} />;
  }
  
  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <AdminDashboardCharts />;
      case 'analytics':
        if (isFreePlan) return <LockedFeature title={t('subscription.lockedAnalytics')} description={t('subscription.lockedAnalyticsDesc')} requiredPlan="Pro" />;
        return <AnalyticsDashboard />;
      case 'categories':
        return <CategoryManagement />;
      case 'products':
        return <ProductManagement />;
      case 'sales':
        return <SalesManagement />;
      case 'users':
        return <UserManagementPanel />;
      case 'seller-reports':
        if (isFreePlan) return <LockedFeature title={t('subscription.lockedSellerReports')} description={t('subscription.lockedSellerReportsDesc')} requiredPlan="Pro" />;
        return <SellerPerformanceReport />;
      case 'reports':
        if (isFreePlan) return <LockedFeature title={t('subscription.lockedReports')} description={t('subscription.lockedReportsDesc')} requiredPlan="Pro" />;
        return <AdvancedReports />;
      case 'tva-report':
        if (isFreePlan) return <LockedFeature title={t('subscription.lockedTva')} description={t('subscription.lockedTvaDesc')} requiredPlan="Basic" />;
        return <TvaReport />;
      case 'activity':
        return <ActivityLogPanel />;
      case 'notifications':
        return <StockAlerts />;
      case 'settings':
        return <CompanySettings />;
      case 'database':
        return <DatabaseMonitoring />;
      default:
        return <AdminDashboardCharts />;
    }
  };

  return (
    <ResponsiveDashboardLayout 
      title={t('dashboard.adminTitle')} 
      role="admin" 
      currentSection={currentSection}
      onSectionChange={setCurrentSection}
    >
      <div className="space-y-6">
        <UpgradeBanner />
        {renderContent()}
      </div>
    </ResponsiveDashboardLayout>
  );
};

export default AdminDashboard;