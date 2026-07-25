import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  ClipboardList, 
  Search, 
  RefreshCcw, 
  Calendar as CalendarIcon,
  ShoppingCart,
  Package,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  XCircle,
  FolderPlus,
  Database,
  Layers
} from 'lucide-react';
import { useActivityLog, ActivityLogFilter } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ACTION_TYPES = [
  { value: 'sale_created', label: 'Vente créée', icon: ShoppingCart, color: 'bg-green-500' },
  { value: 'sale_deleted', label: 'Vente supprimée', icon: Trash2, color: 'bg-red-500' },
  { value: 'sale_cancelled', label: 'Vente annulée', icon: XCircle, color: 'bg-orange-500' },
  { value: 'product_added', label: 'Produit ajouté', icon: Package, color: 'bg-blue-500' },
  { value: 'product_updated', label: 'Produit modifié', icon: Edit, color: 'bg-yellow-500' },
  { value: 'product_deactivated', label: 'Produit désactivé', icon: Trash2, color: 'bg-red-500' },
  { value: 'product_deleted', label: 'Produit supprimé', icon: Trash2, color: 'bg-red-500' },
  { value: 'stock_adjusted', label: 'Stock ajusté', icon: Package, color: 'bg-purple-500' },
  { value: 'category_created', label: 'Catégorie créée', icon: FolderPlus, color: 'bg-green-500' },
  { value: 'category_updated', label: 'Catégorie modifiée', icon: Layers, color: 'bg-yellow-500' },
  { value: 'category_deleted', label: 'Catégorie supprimée', icon: Trash2, color: 'bg-red-500' },
  { value: 'subcategory_created', label: 'Sous-cat. créée', icon: FolderPlus, color: 'bg-green-500' },
  { value: 'subcategory_updated', label: 'Sous-cat. modifiée', icon: Layers, color: 'bg-yellow-500' },
  { value: 'subcategory_deleted', label: 'Sous-cat. supprimée', icon: Trash2, color: 'bg-red-500' },
  { value: 'user_approved', label: 'Utilisateur approuvé', icon: UserCheck, color: 'bg-green-500' },
  { value: 'user_deactivated', label: 'Utilisateur désactivé', icon: UserX, color: 'bg-red-500' },
  { value: 'user_deleted', label: 'Utilisateur supprimé', icon: Trash2, color: 'bg-red-500' },
  { value: 'user_login', label: 'Connexion', icon: UserCheck, color: 'bg-blue-500' },
  { value: 'user_logout', label: 'Déconnexion', icon: UserX, color: 'bg-gray-500' },
  { value: 'user_signup', label: 'Inscription', icon: UserCheck, color: 'bg-green-500' },
  { value: 'user_update_password', label: 'Changement mot de passe', icon: Edit, color: 'bg-orange-500' },
  { value: 'connection_failed', label: 'Échec connexion', icon: UserX, color: 'bg-red-500' },
  { value: 'system_cleanup', label: 'Nettoyage système', icon: Database, color: 'bg-gray-500' },
  { value: 'settings_updated', label: 'Paramètres modifiés', icon: Edit, color: 'bg-blue-500' },
];

export const ActivityLogPanel = () => {
  const { logs, loading, totalCount, fetchActivityLogs } = useActivityLog();
  const [filters, setFilters] = useState<ActivityLogFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const pageSize = 20;

  useEffect(() => {
    loadLogs();
    loadUsers();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters, currentPage]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name');
    
    if (data) {
      setUsers(data.map(p => ({ id: p.user_id, full_name: p.full_name })));
    }
  };

  const loadLogs = async () => {
    await fetchActivityLogs(filters, currentPage, pageSize);
  };

  const handleSearch = () => {
    setFilters({
      ...filters,
      search: searchTerm || undefined,
      date_from: dateFrom?.toISOString(),
      date_to: dateTo?.toISOString()
    });
    setCurrentPage(0);
  };

  const handleReset = () => {
    setFilters({});
    setSearchTerm('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(0);
  };

  const getActionIcon = (actionType: string) => {
    const action = ACTION_TYPES.find(a => a.value === actionType);
    if (!action) return <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4" />;
    const Icon = action.icon;
    return <Icon className="w-3 h-3 sm:w-4 sm:h-4" />;
  };

  const getActionBadge = (actionType: string) => {
    const action = ACTION_TYPES.find(a => a.value === actionType);
    if (!action) return <Badge variant="secondary" className="text-[10px] sm:text-xs">{actionType}</Badge>;
    
    return (
      <Badge className={`${action.color} text-white text-[10px] sm:text-xs`}>
        <span className="hidden sm:inline">{action.label}</span>
        <span className="sm:hidden">{action.label.split(' ')[0]}</span>
      </Badge>
    );
  };

  const getCurrencyBadge = (log: { action_type: string; metadata?: { currency?: string } }) => {
    // Only show for sale transactions
    if (!['sale_created', 'sale_deleted', 'sale_cancelled'].includes(log.action_type)) {
      return null;
    }
    
    const currency = log.metadata?.currency;
    if (!currency) return null;
    
    const isUSD = currency === 'USD';
    return (
      <Badge 
        variant="outline"
        className={`text-[10px] sm:text-xs ${
          isUSD 
            ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' 
            : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
        }`}
      >
        {isUSD ? '$ USD' : 'G HTG'}
      </Badge>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
            Logs d'activité
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="space-y-3 sm:space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[10px] sm:text-sm font-medium">Type d'action</label>
                <Select
                  value={filters.action_type || 'all'}
                  onValueChange={(value) => {
                    setFilters({
                      ...filters,
                      action_type: value === 'all' ? undefined : value
                    });
                    setCurrentPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {ACTION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <label className="text-[10px] sm:text-sm font-medium">Utilisateur</label>
                <Select
                  value={filters.user_id || 'all'}
                  onValueChange={(value) => {
                    setFilters({
                      ...filters,
                      user_id: value === 'all' ? undefined : value
                    });
                    setCurrentPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <label className="text-[10px] sm:text-sm font-medium">Date début</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-8 sm:h-10 text-xs sm:text-sm">
                      <CalendarIcon className="mr-1 sm:mr-2 w-3 h-3 sm:w-4 sm:h-4" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yy', { locale: fr }) : <span className="hidden sm:inline">Sélectionner</span>}
                      {!dateFrom && <span className="sm:hidden">-</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <label className="text-[10px] sm:text-sm font-medium">Date fin</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-8 sm:h-10 text-xs sm:text-sm">
                      <CalendarIcon className="mr-1 sm:mr-2 w-3 h-3 sm:w-4 sm:h-4" />
                      {dateTo ? format(dateTo, 'dd/MM/yy', { locale: fr }) : <span className="hidden sm:inline">Sélectionner</span>}
                      {!dateTo && <span className="sm:hidden">-</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Search and actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="flex-1 sm:flex-none h-8 sm:h-10 text-xs sm:text-sm">
                  <Search className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Rechercher</span>
                </Button>
                <Button variant="outline" onClick={handleReset} className="flex-1 sm:flex-none h-8 sm:h-10 text-xs sm:text-sm">
                  <RefreshCcw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Réinitialiser</span>
                </Button>
              </div>
            </div>

            {/* Results count */}
            <div className="text-xs sm:text-sm text-muted-foreground">
              {totalCount} résultat{totalCount > 1 ? 's' : ''}
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm min-w-[80px] sm:min-w-[140px]">Date</TableHead>
                    <TableHead className="text-xs sm:text-sm min-w-[80px] sm:min-w-[150px]">Utilisateur</TableHead>
                    <TableHead className="text-xs sm:text-sm min-w-[80px] sm:min-w-[140px]">Action</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell min-w-[200px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 sm:py-8 text-xs sm:text-sm">
                        Chargement...
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 sm:py-8 text-xs sm:text-sm">
                        Aucun log trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-[10px] sm:text-sm font-mono">
                          <span className="sm:hidden">{format(new Date(log.created_at), 'dd/MM HH:mm', { locale: fr })}</span>
                          <span className="hidden sm:inline">{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium truncate max-w-[80px] sm:max-w-none">{log.user?.full_name || 'N/A'}</span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{log.user?.email || ''}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            <span className="hidden sm:inline">{getActionIcon(log.action_type)}</span>
                            {getActionBadge(log.action_type)}
                            {getCurrencyBadge(log)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md hidden sm:table-cell">
                          <div className="text-xs sm:text-sm truncate">{log.description}</div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-[10px] sm:text-sm text-muted-foreground">
                  Page {currentPage + 1}/{totalPages}
                </div>
                <div className="flex gap-1 sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="h-7 sm:h-8 w-7 sm:w-8 p-0"
                  >
                    <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="h-7 sm:h-8 w-7 sm:w-8 p-0"
                  >
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
