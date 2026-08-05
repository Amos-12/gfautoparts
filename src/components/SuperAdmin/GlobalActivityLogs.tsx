import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Search, Activity, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/locale';

interface ActivityLog {
  id: string;
  action_type: string;
  entity_type: string;
  description: string;
  created_at: string;
  user_id: string | null;
  company_id: string | null;
  metadata: any;
}

export const GlobalActivityLogs = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [companies, setCompanies] = useState<Map<string, string>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());

  const dateLocale = getDateFnsLocale();

  const fetchLogs = async () => {
    try {
      setLoading(true);

      const [logsRes, companiesRes, profilesRes] = await Promise.all([
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('companies').select('id, name'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      if (logsRes.error) throw logsRes.error;

      setLogs(logsRes.data || []);
      setCompanies(new Map(companiesRes.data?.map(c => [c.id, c.name]) || []));
      setProfiles(new Map(profilesRes.data?.map(p => [p.user_id, p.full_name]) || []));
    } catch (err) {
      console.error('Error fetching logs:', err);
      toast({ title: t('activityLog.error'), description: t('activityLog.errorLoadLogs'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const actionTypes = [...new Set(logs.map(l => l.action_type))].sort();

  const filtered = logs.filter(l => {
    const matchSearch = l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      (l.company_id && companies.get(l.company_id)?.toLowerCase().includes(search.toLowerCase()));
    const matchType = typeFilter === 'all' || l.action_type === typeFilter;
    return matchSearch && matchType;
  });

  const getActionLabel = (action: string) => t(`activityLog.actions.${action}`, action.replace(/_/g, ' '));

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      sale_created: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      product_added: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      user_login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      user_logout: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      user_deleted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      stock_adjusted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      system_cleanup: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return <Badge className={colors[action] || 'bg-muted text-muted-foreground'}>{getActionLabel(action)}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            {t('activityLog.title')} ({filtered.length})
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {t('activityLog.refresh')}
            </Button>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t('activityLog.actionType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('activityLog.allTypes')}</SelectItem>
                {actionTypes.map(type => (
                  <SelectItem key={type} value={type}>{getActionLabel(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('activityLog.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">{t('activityLog.loading')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('activityLog.date')}</TableHead>
                  <TableHead>{t('activityLog.action')}</TableHead>
                  <TableHead>{t('activityLog.description')}</TableHead>
                  <TableHead>{t('activityLog.user')}</TableHead>
                  <TableHead>{t('activityLog.company')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: dateLocale })}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action_type)}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{log.description}</TableCell>
                    <TableCell className="text-sm">
                      {log.user_id ? profiles.get(log.user_id) || t('activityLog.unknown') : t('activityLog.system')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.company_id ? companies.get(log.company_id) || '—' : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t('activityLog.noLogsFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
