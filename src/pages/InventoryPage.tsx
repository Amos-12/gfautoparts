import { ResponsiveDashboardLayout } from '@/components/Layout/ResponsiveDashboardLayout';
import { InventoryManagement } from '@/components/Inventory/InventoryManagement';

const InventoryPage = () => {
  return (
    <ResponsiveDashboardLayout 
      title="Inventaire" 
      role="admin" 
      currentSection="inventory"
    >
      <InventoryManagement />
    </ResponsiveDashboardLayout>
  );
};

export default InventoryPage;
