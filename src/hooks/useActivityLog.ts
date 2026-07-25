import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  description: string;
  metadata?: any;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

export interface ActivityLogFilter {
  action_type?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export const useActivityLog = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchActivityLogs = async (filters: ActivityLogFilter = {}, page = 0, pageSize = 20) => {
    try {
      setLoading(true);

      let query = supabase
        .from('activity_logs' as any)
        .select(`
          *,
          profiles!activity_logs_user_id_fkey (
            full_name,
            email
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      // Apply filters
      if (filters.action_type) {
        query = query.eq('action_type', filters.action_type);
      }
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }
      if (filters.search) {
        query = query.ilike('description', `%${filters.search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Map the data to include user info
      const logsWithUsers = (data || []).map((log: any) => ({
        id: log.id,
        user_id: log.user_id,
        action_type: log.action_type,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        description: log.description,
        metadata: log.metadata,
        created_at: log.created_at,
        user: log.profiles ? {
          full_name: log.profiles.full_name,
          email: log.profiles.email
        } : undefined
      }));

      setLogs(logsWithUsers);
      setTotalCount(count || 0);

      return { logs: logsWithUsers, count: count || 0 };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les logs d'activité",
        variant: "destructive"
      });
      return { logs: [], count: 0 };
    } finally {
      setLoading(false);
    }
  };

  const createActivityLog = async (logData: {
    action_type: string;
    entity_type: string;
    entity_id?: string;
    description: string;
    metadata?: any;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('activity_logs' as any)
        .insert([{
          user_id: user.id,
          ...logData
        }]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error creating activity log:', error);
      return { success: false, error };
    }
  };

  return {
    logs,
    loading,
    totalCount,
    fetchActivityLogs,
    createActivityLog
  };
};