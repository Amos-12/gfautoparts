import { useTranslation } from 'react-i18next';
import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { InventoryManagement } from '@/components/Inventory/InventoryManagement';

const InventoryPage = () => {
  const { t } = useTranslation();
  return (
    <ResponsiveDashboardLayout 
      title={t('inventory.titleShort')} 
      role="admin" 
      currentSection="inventory"
    >
      <InventoryManagement />
    </ResponsiveDashboardLayout>
  );
};

export default InventoryPage;
