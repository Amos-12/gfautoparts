import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { getDateFnsLocale } from '@/lib/locale';

const ACTION_META: Record<string, { icon: any; color: string }> = {
  sale_created: { icon: ShoppingCart, color: 'bg-green-500' },
  sale_deleted: { icon: Trash2, color: 'bg-red-500' },
  sale_cancelled: { icon: XCircle, color: 'bg-orange-500' },
  product_added: { icon: Package, color: 'bg-blue-500' },
  product_updated: { icon: Edit, color: 'bg-yellow-500' },
  product_deactivated: { icon: Trash2, color: 'bg-red-500' },
  product_deleted: { icon: Trash2, color: 'bg-red-500' },
  stock_adjusted: { icon: Package, color: 'bg-purple-500' },
  category_created: { icon: FolderPlus, color: 'bg-green-500' },
  category_updated: { icon: Layers, color: 'bg-yellow-500' },
  category_deleted: { icon: Trash2, color: 'bg-red-500' },
  subcategory_created: { icon: FolderPlus, color: 'bg-green-500' },
  subcategory_updated: { icon: Layers, color: 'bg-yellow-500' },
  subcategory_deleted: { icon: Trash2, color: 'bg-red-500' },
  user_approved: { icon: UserCheck, color: 'bg-green-500' },
  user_deactivated: { icon: UserX, color: 'bg-red-500' },
  user_deleted: { icon: Trash2, color: 'bg-red-500' },
  user_login: { icon: UserCheck, color: 'bg-blue-500' },
  user_logout: { icon: UserX, color: 'bg-gray-500' },
  user_signup: { icon: UserCheck, color: 'bg-green-500' },
  user_update_password: { icon: Edit, color: 'bg-orange-500' },
  connection_failed: { icon: UserX, color: 'bg-red-500' },
  system_cleanup: { icon: Database, color: 'bg-gray-500' },
  settings_updated: { icon: Edit, color: 'bg-blue-500' },
};

export const ActivityLogPanel = () => {
  const { t } = useTranslation();
  const { logs, loading, totalCount, fetchActivityLogs } = useActivityLog();
  const [filters, setFilters] = useState<ActivityLogFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const pageSize = 20;

  const dateLocale = getDateFnsLocale();

  const ACTION_TYPES = useMemo(
    () => Object.keys(ACTION_META).map(value => ({
      value,
      label: t(`activityLog.actions.${value}`, value),
      ...ACTION_META[value],
    })),
    [t]
  );

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
    const meta = ACTION_META[actionType];
    if (!meta) return <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4" />;
    const Icon = meta.icon;
    return <Icon className="w-3 h-3 sm:w-4 sm:h-4" />;
  };

  const getActionBadge = (actionType: string) => {
    const meta = ACTION_META[actionType];
    const label = t(`activityLog.actions.${actionType}`, actionType);
    if (!meta) return <Badge variant="secondary" className="text-[10px] sm:text-xs">{actionType}</Badge>;
    
    return (
      <Badge className={`${meta.color} text-white text-[10px] sm:text-xs`}>
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{label.split(' ')[0]}</span>
      </Badge>
    );
  };

  const getCurrencyBadge = (log: { action_type: string; metadata?: { currency?: string } }) => {
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
            {t('activityLog.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <div className="space-y-1 sm:space-y-2">
                <label className="text-[10px] sm:text-sm font-medium">{t('activityLog.actionType')}</label>
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
                    <SelectValue placeholder={t('activityLog.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('activityLog.allTypes')}</SelectItem>
                    {ACTION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <label className="text-[10px] sm:text-sm font-medium">{t('activityLog.user')}</label>
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
                    <SelectValue placeholder={t('activityLog.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('activityLog.all')}</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <label className="text-[10px] sm:text-sm font-medium">{t('activityLog.dateFrom')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-8 sm:h-10 text-xs sm:text-sm">
                      <CalendarIcon className="mr-1 sm:mr-2 w-3 h-3 sm:w-4 sm:h-4" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yy', { locale: dateLocale }) : <span className="hidden sm:inline">{t('activityLog.select')}</span>}
                      {!dateFrom && <span className="sm:hidden">-</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <label className="text-[10px] sm:text-sm font-medium">{t('activityLog.dateTo')}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-8 sm:h-10 text-xs sm:text-sm">
                      <CalendarIcon className="mr-1 sm:mr-2 w-3 h-3 sm:w-4 sm:h-4" />
                      {dateTo ? format(dateTo, 'dd/MM/yy', { locale: dateLocale }) : <span className="hidden sm:inline">{t('activityLog.select')}</span>}
                      {!dateTo && <span className="sm:hidden">-</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      locale={dateLocale}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  placeholder={t('activityLog.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 sm:h-10 text-xs sm:text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch} className="flex-1 sm:flex-none h-8 sm:h-10 text-xs sm:text-sm">
                  <Search className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t('activityLog.search')}</span>
                </Button>
                <Button variant="outline" onClick={handleReset} className="flex-1 sm:flex-none h-8 sm:h-10 text-xs sm:text-sm">
                  <RefreshCcw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t('activityLog.reset')}</span>
                </Button>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-muted-foreground">
              {t('activityLog.resultsCount', { count: totalCount })}
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm min-w-[80px] sm:min-w-[140px]">{t('activityLog.date')}</TableHead>
                    <TableHead className="text-xs sm:text-sm min-w-[80px] sm:min-w-[150px]">{t('activityLog.user')}</TableHead>
                    <TableHead className="text-xs sm:text-sm min-w-[80px] sm:min-w-[140px]">{t('activityLog.action')}</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell min-w-[200px]">{t('activityLog.description')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 sm:py-8 text-xs sm:text-sm">
                        {t('activityLog.loading')}
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 sm:py-8 text-xs sm:text-sm">
                        {t('activityLog.noLogsFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-[10px] sm:text-sm font-mono">
                          <span className="sm:hidden">{format(new Date(log.created_at), 'dd/MM HH:mm', { locale: dateLocale })}</span>
                          <span className="hidden sm:inline">{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}</span>
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-[10px] sm:text-sm text-muted-foreground">
                  {t('activityLog.page', { current: currentPage + 1, total: totalPages })}
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
