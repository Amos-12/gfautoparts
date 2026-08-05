import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, UserCheck, UserX, Mail, Calendar, Search, UserPlus, RefreshCcw, Settings, Trash2, LayoutGrid, List, Shield, User, Crown, Download, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from 'react-i18next';
import { formatLocalizedDate } from '@/lib/locale';

interface User {
  id: string;
  full_name: string;
  email?: string;
  role: 'admin' | 'seller';
  is_active: boolean;
  created_at: string;
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getAvatarColor = (role: string, isActive: boolean) => {
  if (role === 'admin') return 'bg-primary text-primary-foreground';
  if (isActive) return 'bg-green-500 text-white';
  return 'bg-orange-500 text-white';
};

export const UserManagementPanel = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'seller'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [emailToPromote, setEmailToPromote] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);
  const [selectedUserCategories, setSelectedUserCategories] = useState<{
    userId: string;
    userName: string;
    categories: string[];
  }>({ userId: '', userName: '', categories: [] });
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const isMobile = useIsMobile();
  const { plan, isFreePlan } = useSubscription();

  const effectiveViewMode = isMobile ? 'cards' : viewMode;

  const ALL_CATEGORIES = [
    { value: 'alimentaires', label: t('products.categoryLabels.alimentaires') },
    { value: 'boissons', label: t('products.categoryLabels.boissons') },
    { value: 'gazeuses', label: t('products.categoryLabels.gazeuses') },
    { value: 'electronique', label: t('products.categoryLabels.electronique') },
    { value: 'ceramique', label: t('products.categoryLabels.ceramique') },
    { value: 'fer', label: t('products.categoryLabels.fer') },
    { value: 'materiaux_de_construction', label: t('products.categoryLabels.materiaux_de_construction') },
    { value: 'energie', label: t('products.categoryLabels.energie') },
    { value: 'blocs', label: t('products.categoryLabels.blocs') },
    { value: 'vetements', label: t('products.categoryLabels.vetements') },
    { value: 'autres', label: t('products.categoryLabels.autres') }
  ];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: userRoles, error } = await supabase.from('user_roles').select('user_id, role, is_active');
      if (error) throw error;
      const userIds = userRoles?.map((ur) => ur.user_id) || [];
      if (userIds.length === 0) { setUsers([]); return; }
      const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('user_id, full_name, email, created_at').in('user_id', userIds);
      if (profilesError) throw profilesError;
      const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
      const usersData = (userRoles || []).map((userRole: any) => {
        const profile = profileMap.get(userRole.user_id);
        return {
          id: userRole.user_id,
          full_name: profile?.full_name || t('users.nameNotDefined'),
          email: profile?.email || t('users.emailNotDefined'),
          role: userRole.role,
          is_active: userRole.is_active,
          created_at: profile?.created_at || new Date().toISOString(),
        };
      });
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: t('common.error'), description: t('common.loadError'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('user_roles').update({ is_active: !currentStatus }).eq('user_id', userId);
      if (error) throw error;
      const currentUser = users.find(u => u.id === userId);
      const { data: { user } } = await supabase.auth.getUser();
      if (currentUser && user) {
        const actionType = !currentStatus ? 'user_approved' : 'user_deactivated';
        await (supabase as any).from('activity_logs').insert({
          user_id: user.id, action_type: actionType, entity_type: 'user', entity_id: userId,
          description: !currentStatus ? `User "${currentUser.full_name}" approved` : `User "${currentUser.full_name}" deactivated`,
          metadata: { target_user_name: currentUser.full_name, target_user_email: currentUser.email, new_status: !currentStatus }
        });
      }
      toast({ title: t('common.success'), description: !currentStatus ? t('users.sellerActivated') : t('users.sellerDeactivated') });
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({ title: t('common.error'), description: t('users.statusChangeError'), variant: "destructive" });
    }
  };

  const handlePromoteToAdmin = async () => {
    if (!emailToPromote.trim()) {
      toast({ title: t('common.error'), description: t('users.enterEmail'), variant: "destructive" });
      return;
    }
    try {
      setIsPromoting(true);
      const { data, error } = await supabase.rpc('promote_user_to_admin', { user_email: emailToPromote.trim() });
      if (error) throw error;
      toast({ title: t('common.success'), description: t('users.promoteSuccess') });
      setEmailToPromote('');
      fetchUsers();
    } catch (error) {
      console.error('Error promoting user:', error);
      toast({ title: t('common.error'), description: t('users.promoteError'), variant: "destructive" });
    } finally {
      setIsPromoting(false);
    }
  };

  const loadUserCategories = async (userId: string, userName: string) => {
    try {
      const { data, error } = await supabase.from('seller_authorized_categories').select('category').eq('user_id', userId);
      if (error) throw error;
      setSelectedUserCategories({ userId, userName, categories: data?.map(d => d.category) || [] });
      setIsCategoryDialogOpen(true);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({ title: t('common.error'), description: t('users.categoriesLoadError'), variant: "destructive" });
    }
  };

  const toggleCategory = (category: string, checked: boolean | string) => {
    const isChecked = checked === true;
    setSelectedUserCategories(prev => ({
      ...prev,
      categories: isChecked ? [...prev.categories, category] : prev.categories.filter(c => c !== category)
    }));
  };

  const saveUserCategories = async () => {
    try {
      const { userId, categories } = selectedUserCategories;
      await supabase.from('seller_authorized_categories').delete().eq('user_id', userId);
      if (categories.length > 0) {
        const rows = categories.map(cat => ({ user_id: userId, category: cat as any, company_id: profile?.company_id || '' }));
        const { error } = await supabase.from('seller_authorized_categories').insert(rows);
        if (error) throw error;
      }
      toast({ title: t('common.success'), description: categories.length > 0 ? t('users.categoriesSaved') : t('users.allCategoriesNow') });
      setIsCategoryDialogOpen(false);
      setSelectedUserCategories({ userId: '', userName: '', categories: [] });
    } catch (error) {
      console.error('Error saving categories:', error);
      toast({ title: t('common.error'), description: t('users.categoriesSaveError'), variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, userRole: string, isActive: boolean) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.id === userId) {
        toast({ title: t('common.error'), description: t('users.cantDeleteSelf'), variant: "destructive" });
        return;
      }
      if (userRole === 'seller' && isActive) {
        toast({ title: t('common.error'), description: t('users.deactivateSellerFirst'), variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.rpc('delete_user_account', { target_user_id: userId });
      if (error) throw error;
      toast({ title: t('common.success'), description: t('users.deleteSuccess', { name: userName }) });
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      let errorMessage = t('users.deleteError');
      if (error.message?.includes('Seuls les administrateurs') || error.message?.includes('administrators')) {
        errorMessage = t('users.noPermission');
      } else if (error.message?.includes('propre compte') || error.message?.includes('own account')) {
        errorMessage = t('users.cantDeleteSelf');
      } else if (error.message?.includes('vendeur actif') || error.message?.includes('active seller')) {
        errorMessage = t('users.deactivateSellerFirst');
      } else if (error.message?.includes('non trouvé') || error.message?.includes('not found')) {
        errorMessage = t('users.userNotFound');
      }
      toast({ title: t('common.error'), description: errorMessage, variant: "destructive" });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? user.is_active : !user.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const { paginatedItems: paginatedUsers, currentPage, totalPages, totalItems, pageSize, nextPage, prevPage, hasNextPage, hasPrevPage } = usePagination(filteredUsers, 20);

  const totalUsers = users.length;
  const adminUsers = users.filter(u => u.role === 'admin').length;
  const sellerUsers = users.filter(u => u.role === 'seller').length;
  const activeUsers = users.filter(u => u.role === 'seller' && u.is_active).length;
  const inactiveUsers = users.filter(u => u.role === 'seller' && !u.is_active).length;

  const exportToExcel = () => {
    if (isFreePlan) { toast({ title: t('common.premiumFeature'), description: t('common.premiumExportExcel'), variant: "destructive" }); return; }
    const exportData = filteredUsers.map(user => ({
      [t('common.name')]: user.full_name,
      [t('common.email')]: user.email || 'N/A',
      [t('users.role')]: user.role === 'admin' ? t('roles.admin') : t('roles.seller'),
      [t('common.status')]: user.is_active ? t('common.active') : t('common.inactive'),
      [t('users.joinDate')]: formatLocalizedDate(user.created_at)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('nav.users'));
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    XLSX.writeFile(wb, `utilisateurs_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: t('common.exportSuccess'), description: t('users.exportedUsers', { count: exportData.length }) });
  };

  if (loading) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Users className="w-8 h-8 text-primary animate-pulse mr-2" />
            <span className="text-muted-foreground">{t('common.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const UserCard = ({ user }: { user: User }) => (
    <Card className="shadow-md hover:shadow-lg transition-all duration-200 animate-in fade-in-50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${getAvatarColor(user.role, user.is_active)}`}>
              {getInitials(user.full_name)}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{user.full_name}</h3>
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className={`mt-1 ${user.role === 'admin' ? 'bg-primary' : ''}`}>
                {user.role === 'admin' ? (<><Shield className="w-3 h-3 mr-1" /> {t('roles.admin')}</>) : (<><User className="w-3 h-3 mr-1" /> {t('roles.seller')}</>)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="space-y-2 text-sm mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span className="truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{t('users.createdOn')} {formatLocalizedDate(user.created_at)}</span>
          </div>
          {user.role === 'seller' && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-orange-500'}`} />
              <span className={user.is_active ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                {user.is_active ? t('common.active') : t('common.inactive')}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pt-3 border-t">
          {user.role === 'seller' && (
            <>
              <Switch checked={user.is_active} onCheckedChange={() => handleToggleActive(user.id, user.is_active)} />
              <Button size="sm" variant="outline" className="flex-1" onClick={() => loadUserCategories(user.id, user.full_name)}>
                <Settings className="w-4 h-4 mr-1" />
                {t('common.category')}
              </Button>
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={user.role === 'seller' && user.is_active} title={user.role === 'seller' && user.is_active ? t('users.deactivateFirst') : t('common.delete')}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('users.confirmDeleteTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('users.confirmDeleteDesc', { name: user.full_name })}
                  <br /><br />
                  {t('users.confirmDeleteWarning')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.full_name, user.role, user.is_active)} className="bg-destructive hover:bg-destructive/90">
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-md">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2"><Users className="h-4 w-4 text-muted-foreground" /></div>
            <div className="text-xl sm:text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">{t('users.totalUsers')}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2"><Shield className="h-4 w-4 text-primary" /></div>
            <div className="text-xl sm:text-2xl font-bold text-primary">{adminUsers}</div>
            <p className="text-xs text-muted-foreground">{t('users.administrators')}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2"><User className="h-4 w-4 text-blue-500" /></div>
            <div className="text-xl sm:text-2xl font-bold text-blue-500">{sellerUsers}</div>
            <p className="text-xs text-muted-foreground">{t('users.sellers')}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2"><Users className="h-4 w-4 text-muted-foreground" /></div>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{activeUsers}</span>
              </div>
              <span className="text-muted-foreground font-light">|</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{inactiveUsers}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">{t('users.activeInactive')}</p>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('users.title')}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="hidden sm:flex items-center gap-1 border rounded-lg p-1">
                <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="h-7 px-2">
                  <List className="w-4 h-4 mr-1" />{t('users.table')}
                </Button>
                <Button variant={viewMode === 'cards' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('cards')} className="h-7 px-2">
                  <LayoutGrid className="w-4 h-4 mr-1" />{t('users.cards')}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchUsers} title={t('common.refresh')}><RefreshCcw className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={exportToExcel} title={t('common.export')}>
                {isFreePlan ? <Lock className="w-4 h-4 mr-1" /> : <Download className="w-4 h-4 mr-1" />}
                <span className="hidden sm:inline">{t('common.export')}</span>
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90">
                    <UserPlus className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">{t('users.promoteAdmin')}</span>
                    <span className="sm:hidden">Admin</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-primary" />
                      {t('users.promoteUser')}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t('users.promoteUserDesc')}</p>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('users.userEmail')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input id="email" type="email" placeholder="user@example.com" value={emailToPromote} onChange={(e) => setEmailToPromote(e.target.value)} className="pl-10" />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('users.userMustExist')}</p>
                    </div>
                    <Button onClick={handlePromoteToAdmin} disabled={isPromoting || !emailToPromote.trim()} className="w-full">
                      <Crown className="w-4 h-4 mr-2" />
                      {isPromoting ? t('users.promoting') : t('users.promoteAdminBtn')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder={t('users.searchByNameEmail')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">{t('users.roleFilter')}:</span>
              <div className="flex items-center gap-1 border rounded-lg p-0.5">
                <Button variant={roleFilter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setRoleFilter('all')} className="h-7 px-2 text-xs">{t('common.all')}</Button>
                <Button variant={roleFilter === 'admin' ? 'default' : 'ghost'} size="sm" onClick={() => setRoleFilter('admin')} className="h-7 px-2 text-xs">
                  <Shield className="w-3 h-3 mr-1" />Admin ({adminUsers})
                </Button>
                <Button variant={roleFilter === 'seller' ? 'default' : 'ghost'} size="sm" onClick={() => setRoleFilter('seller')} className="h-7 px-2 text-xs">
                  <User className="w-3 h-3 mr-1" />{t('roles.seller')} ({sellerUsers})
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">{t('users.statusFilter')}:</span>
              <div className="flex items-center gap-1 border rounded-lg p-0.5">
                <Button variant={statusFilter === 'all' ? 'default' : 'ghost'} size="sm" onClick={() => setStatusFilter('all')} className="h-7 px-2 text-xs">{t('common.all')}</Button>
                <Button variant={statusFilter === 'active' ? 'default' : 'ghost'} size="sm" onClick={() => setStatusFilter('active')} className="h-7 px-2 text-xs">
                  <UserCheck className="w-3 h-3 mr-1" />{t('common.active')} ({activeUsers})
                </Button>
                <Button variant={statusFilter === 'inactive' ? 'default' : 'ghost'} size="sm" onClick={() => setStatusFilter('inactive')} className="h-7 px-2 text-xs">
                  <UserX className="w-3 h-3 mr-1" />{t('common.inactive')} ({inactiveUsers})
                </Button>
              </div>
            </div>
          </div>

          {effectiveViewMode === 'cards' && (
            <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                {paginatedUsers.map((user) => (<UserCard key={user.id} user={user} />))}
              </div>
            </ScrollArea>
          )}

          {effectiveViewMode === 'table' && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('common.email')}</TableHead>
                    <TableHead>{t('users.role')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('common.actions')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('users.createdOn')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(user.role, user.is_active)}`}>
                            {getInitials(user.full_name)}
                          </div>
                          <div>
                            <div className="font-medium">{user.full_name}</div>
                            <div className="text-sm text-muted-foreground sm:hidden">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className={user.role === 'admin' ? 'bg-primary' : ''}>
                          {user.role === 'admin' ? 'Admin' : t('roles.seller')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.role === 'seller' ? (
                          <div className="flex items-center gap-2">
                            <Switch checked={user.is_active} onCheckedChange={() => handleToggleActive(user.id, user.is_active)} />
                            <span className="text-sm text-muted-foreground">{user.is_active ? t('common.active') : t('common.inactive')}</span>
                          </div>
                        ) : (
                          <Badge variant="outline">Admin</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.role === 'seller' && (
                            <Button size="sm" variant="outline" onClick={() => loadUserCategories(user.id, user.full_name)}>
                              <Settings className="w-4 h-4 mr-1" />
                              <span className="hidden lg:inline">{t('common.category')}</span>
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" disabled={user.role === 'seller' && user.is_active} title={user.role === 'seller' && user.is_active ? t('users.deactivateFirst') : t('common.delete')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('users.confirmDeleteTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('users.confirmDeleteDesc', { name: user.full_name })}
                                  <br /><br />
                                  {t('users.confirmDeleteWarning')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.full_name, user.role, user.is_active)} className="bg-destructive hover:bg-destructive/90">
                                  {t('common.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatLocalizedDate(user.created_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPrevPage={prevPage} onNextPage={nextPage} hasPrevPage={hasPrevPage} hasNextPage={hasNextPage} />

          {paginatedUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('users.noUsers')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Management Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('users.manageCategories')}</DialogTitle>
            <p className="text-sm text-muted-foreground">{selectedUserCategories.userName}</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {selectedUserCategories.categories.length === 0 
                  ? t('users.allCategoriesAccess')
                  : t('users.restrictedCategories', { count: selectedUserCategories.categories.length })
                }
              </p>
            </div>
            <div className="space-y-3">
              {ALL_CATEGORIES.map(cat => (
                <div key={cat.value} className="flex items-center gap-3 p-2 hover:bg-muted rounded-md">
                  <Checkbox
                    id={`cat-${cat.value}`}
                    checked={selectedUserCategories.categories.includes(cat.value)}
                    onCheckedChange={(checked) => toggleCategory(cat.value, checked)}
                  />
                  <Label htmlFor={`cat-${cat.value}`} className="flex-1 cursor-pointer text-sm">{cat.label}</Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button onClick={saveUserCategories}>{t('common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
