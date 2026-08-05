import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  LogOut, 
  Settings,
  Bell,
  User,
  Menu,
  Home,
  ClipboardList,
  Database,
  Warehouse,
  UserCheck,
  FolderTree,
  BarChart3,
  Receipt,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';

interface ResponsiveDashboardLayoutProps {
  children: ReactNode;
  title: string;
  role: 'admin' | 'seller';
  currentSection?: string;
  onSectionChange?: (section: string) => void;
}

export const ResponsiveDashboardLayout = ({ 
  children, 
  title, 
  role, 
  currentSection = 'dashboard',
  onSectionChange 
}: ResponsiveDashboardLayoutProps) => {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const fetchCompanySettings = async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching company settings:', error);
        return;
      }

      if (data) {
        setCompanySettings(data);
      }
    };

    fetchCompanySettings();
  }, []);

  // Update document title dynamically
  useEffect(() => {
    if (companySettings?.company_name) {
      document.title = companySettings.company_name;
    }
  }, [companySettings?.company_name]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (role !== 'admin') return;
      
      try {
        // Count low stock products
        const { data: products } = await supabase
          .from('products')
          .select('id, quantity, alert_threshold')
          .eq('is_active', true);
        
        const lowStockCount = products?.filter(p => p.quantity <= p.alert_threshold).length || 0;
        
        // Count sales from last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: salesCount } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', oneDayAgo);
        
        setNotificationCount(lowStockCount + (salesCount || 0));
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    fetchNotifications();
    
    // Refresh notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [role]);

  const adminNavItems = [
    { icon: Home, label: 'Dashboard', value: 'dashboard' },
    { icon: BarChart3, label: 'Analytics', value: 'analytics' },
    { icon: FolderTree, label: 'Catégories', value: 'categories' },
    { icon: Package, label: 'Produits', value: 'products' },
    { icon: ShoppingCart, label: 'Ventes', value: 'sales' },
    { icon: Warehouse, label: 'Inventaire', value: 'inventory', route: '/inventory' },
    { icon: Users, label: 'Utilisateurs', value: 'users' },
    { icon: UserCheck, label: 'Perf. Vendeurs', value: 'seller-reports' },
    { icon: TrendingUp, label: 'Rapports', value: 'reports' },
    { icon: Receipt, label: 'Rapport TVA', value: 'tva-report' },
    { icon: ClipboardList, label: "Logs", value: 'activity' },
    { icon: Bell, label: 'Notifications', value: 'notifications' },
    { icon: Settings, label: 'Paramètres', value: 'settings' },
    { icon: Database, label: 'Base de données', value: 'database' },
    { icon: HelpCircle, label: 'Aide', value: 'help', route: '/help' }
  ];

  const sellerNavItems = [
    { icon: Home, label: 'Dashboard', value: 'dashboard' },
    { icon: ShoppingCart, label: 'Nouvelle vente', value: 'sale' },
    { icon: Receipt, label: 'Pro-forma', value: 'proforma' },
    { icon: TrendingUp, label: 'Mes ventes', value: 'history' },
    { icon: HelpCircle, label: 'Aide', value: 'help', route: '/help' }
  ];

  const navItems = role === 'admin' ? adminNavItems : sellerNavItems;

  const handleNavClick = (value: string, route?: string) => {
    setIsMobileMenuOpen(false);
    if (route) {
      navigate(route);
      return;
    }
    if (onSectionChange) {
      onSectionChange(value);
    } else {
      if (role === 'admin') {
        navigate(`/admin?section=${value}`);
      } else if (role === 'seller') {
        navigate(`/seller?section=${value}`);
      }
    }
  };

  const SidebarContent = ({ isDesktop = false }: { isDesktop?: boolean }) => (
    <div className={cn("h-full flex flex-col", isDesktop && sidebarCollapsed && "")}>
      <div className={cn(
        "border-b border-border pb-4 pt-6 px-6",
        isDesktop && sidebarCollapsed ? "text-center px-3" : "text-center"
      )}>
        {companySettings?.logo_url ? (
          <img 
            src={companySettings.logo_url} 
            alt="Logo" 
            className={cn(
              "object-contain mx-auto mb-2",
              isDesktop && sidebarCollapsed ? "w-10 h-10" : "w-16 h-16"
            )} 
          />
        ) : (
          <img 
            src={logo} 
            alt="Logo" 
            className={cn(
              "object-contain mx-auto mb-2",
              isDesktop && sidebarCollapsed ? "w-10 h-10" : "w-16 h-16"
            )} 
          />
        )}
        {!(isDesktop && sidebarCollapsed) && (
          <>
            <h2 className={cn(
              "font-semibold text-foreground",
              (companySettings?.company_name || title).length > 30 ? "text-sm" : "text-base"
            )}>
              {companySettings?.company_name || title}
            </h2>
            <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="mt-2">
              {role === 'admin' ? 'Administrateur' : 'Vendeur'}
            </Badge>
          </>
        )}
      </div>
      
      <ScrollArea className="flex-1 px-4 py-3">
        <nav className="space-y-1">
          {navItems.map((item: any, index: number) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.value}
                variant={currentSection === item.value ? 'default' : 'ghost'}
                className={cn(
                  "w-full transition-all duration-200 group",
                  isDesktop && sidebarCollapsed ? "justify-center px-2" : "justify-start",
                  currentSection === item.value 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]" 
                    : "hover:bg-primary/10 hover:text-primary hover:translate-x-1"
                )}
                style={{ 
                  animationDelay: `${index * 30}ms`,
                  animation: !isDesktop ? 'fade-in 0.3s ease-out forwards' : undefined
                }}
                onClick={() => handleNavClick(item.value, item.route)}
                title={isDesktop && sidebarCollapsed ? item.label : undefined}
              >
                <Icon className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  !(isDesktop && sidebarCollapsed) && "mr-3",
                  currentSection === item.value ? "scale-110" : "group-hover:scale-110"
                )} />
                {!(isDesktop && sidebarCollapsed) && (
                  <span className="transition-colors duration-200">{item.label}</span>
                )}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Toggle Button for Desktop */}
      {isDesktop && (
        <div className="px-6 pb-6 pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full"
            title={sidebarCollapsed ? 'Étendre le menu' : 'Réduire le menu'}
          >
            {sidebarCollapsed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Réduire
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pt-[calc(64px+var(--safe-area-top,0px))] pb-[var(--safe-area-bottom,0px)]">
      {/* Safe area background - prevents content from showing under status bar */}
      <div 
        className="fixed top-0 left-0 right-0 z-[60] bg-background"
        style={{ height: 'var(--safe-area-top, 0px)' }}
      />
      {/* Safe area background - prevents content from showing under navigation bar */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[60] bg-background"
        style={{ height: 'var(--safe-area-bottom, 0px)' }}
      />
      
      {/* Header - Fixed at top, respecting safe area */}
      <header className="bg-background border-b border-border shadow-md fixed top-[var(--safe-area-top,0px)] left-0 right-0 z-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 min-w-0">
            {/* Left side - Mobile menu button + Logo */}
            <div className="flex items-center min-w-0 flex-1">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden mr-1 sm:mr-2 flex-shrink-0">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0 flex flex-col" style={{ paddingBottom: 'var(--safe-area-bottom, 0px)' }}>
                  <div className="flex-1 overflow-hidden">
                    <SidebarContent />
                  </div>
                  
                  {/* Compact Profile section in mobile menu - always visible at bottom */}
                  <div className="border-t border-border bg-background p-3 flex-shrink-0">
                    <div 
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigate('/profile');
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{profile?.full_name || 'Utilisateur'}</p>
                      </div>
                      <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0.5">
                        {role === 'admin' ? 'Admin' : 'Vendeur'}
                      </Badge>
                    </div>
                  </div>
                  {/* Background fill for navigation bar area */}
                  <div 
                    className="bg-background w-full flex-shrink-0"
                    style={{ height: 'var(--safe-area-bottom, 0px)' }}
                  />
                </SheetContent>
              </Sheet>
              
              <div className="flex items-center min-w-0">
                {companySettings?.logo_url ? (
                  <img 
                    src={companySettings.logo_url} 
                    alt="Logo" 
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain mr-2 sm:mr-3 flex-shrink-0" 
                  />
                ) : (
                  <img 
                    src={logo} 
                    alt="Logo" 
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain mr-2 sm:mr-3 flex-shrink-0" 
                  />
                )}
                <h1 className={cn(
                  "font-bold text-primary hidden sm:block max-w-[150px] md:max-w-[250px] lg:max-w-none truncate",
                  (companySettings?.company_name || 'Gestion de Stock').length > 30 
                    ? "text-base lg:text-lg" 
                    : "text-lg lg:text-xl"
                )}>
                  {companySettings?.company_name || 'Gestion de Stock'}
                </h1>
              </div>
            </div>

            {/* Right side - User info and actions */}
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 flex-shrink-0">
              <div className="hidden lg:flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span className="font-medium max-w-[120px] truncate">{profile?.full_name}</span>
              </div>

              {role === 'admin' && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="hover:bg-primary/10 relative flex-shrink-0"
                  onClick={() => {
                    if (onSectionChange) {
                      onSectionChange('notifications');
                    } else {
                      navigate('/admin?section=notifications');
                    }
                  }}
                >
                  <Bell className="w-4 h-4" />
                  {notificationCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </Badge>
                  )}
                </Button>
              )}

              <Button 
                variant="ghost" 
                size="icon"
                className="hover:bg-primary/10 flex-shrink-0 hidden sm:flex"
                onClick={() => navigate('/profile')}
                title="Profil"
              >
                <User className="w-4 h-4" />
              </Button>

              <ThemeToggle />

              <Button 
                variant="outline"
                size="sm"
                onClick={signOut}
                className="hover:bg-destructive hover:text-destructive-foreground transition-smooth flex-shrink-0"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden md:inline">Déconnexion</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <div className="flex w-full">
        {/* Desktop Sidebar - Fixed, respecting safe area */}
          <aside className={cn(
            "flex-shrink-0 hidden lg:block bg-background border-r border-border fixed left-0 top-[calc(64px+var(--safe-area-top,0px))] h-[calc(100vh-64px-var(--safe-area-top,0px)-var(--safe-area-bottom,0px))] transition-all duration-300 z-40",
            sidebarCollapsed ? "w-20" : "w-64"
          )}>
            <SidebarContent isDesktop={true} />
          </aside>

          {/* Spacer for fixed sidebar */}
          <div className={cn(
            "hidden lg:block flex-shrink-0 transition-all duration-300",
            sidebarCollapsed ? "w-20" : "w-64"
          )} />

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-[calc(16px+var(--safe-area-bottom,0px))]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};