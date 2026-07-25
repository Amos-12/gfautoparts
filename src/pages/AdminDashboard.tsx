import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const AdminDashboard = () => {
  const [searchParams] = useSearchParams();
  const [currentSection, setCurrentSection] = useState(searchParams.get('section') || 'dashboard');
  
  const renderContent = () => {
    switch (currentSection) {
      case 'dashboard':
        return <AdminDashboardCharts />;
      case 'analytics':
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
        return <SellerPerformanceReport />;
      case 'reports':
        return <AdvancedReports />;
      case 'tva-report':
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
      title="Tableau de Bord Admin" 
      role="admin" 
      currentSection={currentSection}
      onSectionChange={setCurrentSection}
    >
      <div className="space-y-6">
        {renderContent()}
      </div>
    </ResponsiveDashboardLayout>
  );
};

export default AdminDashboard;