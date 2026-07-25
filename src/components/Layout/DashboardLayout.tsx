import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  LogOut, 
  Settings,
  Bell,
  User
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  role: 'admin' | 'seller';
}

export const DashboardLayout = ({ children, title, role }: DashboardLayoutProps) => {
  const { signOut, profile } = useAuth();

  const adminNavItems = [
    { icon: Package, label: 'Produits', value: 'products' },
    { icon: ShoppingCart, label: 'Ventes', value: 'sales' },
    { icon: Users, label: 'Utilisateurs', value: 'users' },
    { icon: TrendingUp, label: 'Statistiques', value: 'stats' }
  ];

  const sellerNavItems = [
    { icon: ShoppingCart, label: 'Nouvelle vente', value: 'sale' },
    { icon: Package, label: 'Produits', value: 'products' },
    { icon: TrendingUp, label: 'Mes ventes', value: 'history' }
  ];

  const navItems = role === 'admin' ? adminNavItems : sellerNavItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-secondary">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-primary mr-3" />
              <h1 className="text-xl font-bold text-primary">Complexe Petit Pas</h1>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                {role === 'admin' ? 'Administrateur' : 'Vendeur'}
              </Badge>
              
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span className="font-medium">{profile?.full_name}</span>
              </div>

              <Button 
                variant="ghost" 
                size="icon"
                className="hover:bg-primary/10"
              >
                <Bell className="w-4 h-4" />
              </Button>

              <Button 
                variant="ghost" 
                size="icon"
                className="hover:bg-primary/10"
              >
                <Settings className="w-4 h-4" />
              </Button>

              <Button 
                variant="outline"
                size="sm"
                onClick={signOut}
                className="hover:bg-destructive hover:text-destructive-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-64 flex-shrink-0">
            <Card className="p-6 shadow-lg">
              <h2 className="font-semibold text-foreground mb-4">{title}</h2>
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.value}
                      variant="ghost"
                      className="w-full justify-start hover:bg-primary/10 hover:text-primary"
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {item.label}
                    </Button>
                  );
                })}
              </nav>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};