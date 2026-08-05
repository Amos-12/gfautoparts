import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Database, RefreshCw, Trash2, HardDrive, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DbSizeInfo {
  size_mb: number;
  max_size_mb: number;
  usage_percent: number;
  needs_cleanup: boolean;
}

interface TableCount {
  name: string;
  count: number;
}

export const SuperAdminDbMonitoring = () => {
  const { t } = useTranslation();
  const [sizeInfo, setSizeInfo] = useState<DbSizeInfo | null>(null);
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: sizeData, error: sizeError } = await supabase.rpc('check_database_size');
      if (sizeError) throw sizeError;
      setSizeInfo(sizeData as unknown as DbSizeInfo);

      const tables = ['products', 'sales', 'sale_items', 'profiles', 'activity_logs', 'stock_movements', 'companies', 'proformas'] as const;
      const counts: TableCount[] = [];

      for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (!error) counts.push({ name: table, count: count || 0 });
      }

      setTableCounts(counts.sort((a, b) => b.count - a.count));
    } catch (err) {
      console.error('Error fetching DB info:', err);
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.db_monitoring.toast_load_error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCleanup = async () => {
    try {
      setCleaning(true);
      const { error } = await supabase.rpc('cleanup_old_data');
      if (error) throw error;
      toast({ title: t('superAdmin.db_monitoring.toast_cleanup_done'), description: t('superAdmin.db_monitoring.toast_cleanup_done_desc') });
      fetchData();
    } catch (err) {
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.db_monitoring.toast_cleanup_error'), variant: 'destructive' });
    } finally {
      setCleaning(false);
    }
  };

  const getStatusColor = (percent: number) => {
    if (percent < 50) return 'text-green-600';
    if (percent < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (percent: number) => {
    if (percent < 50) return '[&>div]:bg-green-500';
    if (percent < 80) return '[&>div]:bg-yellow-500';
    return '[&>div]:bg-red-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              {t('superAdmin.db_monitoring.storage_title')}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                {t('superAdmin.db_monitoring.refresh')}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleCleanup} disabled={cleaning}>
                <Trash2 className={`w-4 h-4 mr-1 ${cleaning ? 'animate-spin' : ''}`} />
                {t('superAdmin.db_monitoring.cleanup')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading || !sizeInfo ? (
            <p className="text-center text-muted-foreground py-4">{t('superAdmin.common.loading')}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('superAdmin.db_monitoring.usage')}</span>
                <span className={`text-lg font-bold ${getStatusColor(sizeInfo.usage_percent)}`}>
                  {sizeInfo.usage_percent}%
                </span>
              </div>
              <Progress value={sizeInfo.usage_percent} className={getProgressColor(sizeInfo.usage_percent)} />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t('superAdmin.db_monitoring.mb_used', { size: sizeInfo.size_mb })}</span>
                <span>{t('superAdmin.db_monitoring.mb_max', { max: sizeInfo.max_size_mb })}</span>
              </div>
              {sizeInfo.needs_cleanup && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('superAdmin.db_monitoring.critical_threshold')}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            {t('superAdmin.db_monitoring.table_counts_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">{t('superAdmin.common.loading')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tableCounts.map(tc => (
                <div key={tc.name} className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground capitalize">{tc.name.replace(/_/g, ' ')}</p>
                  <p className="text-xl font-bold">{tc.count.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
