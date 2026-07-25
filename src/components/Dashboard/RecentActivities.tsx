import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  ShoppingCart, 
  Package, 
  UserCheck, 
  Settings, 
  LogIn,
  Trash2,
  Edit,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  action_type: string;
  description: string;
  entity_type: string;
  created_at: string;
  user_name?: string;
}

const getActivityIcon = (actionType: string) => {
  switch (actionType) {
    case 'sale_created':
    case 'sale_deleted':
    case 'sale_cancelled':
      return <ShoppingCart className="h-4 w-4" />;
    case 'product_added':
    case 'product_updated':
    case 'product_deleted':
    case 'product_deactivated':
      return <Package className="h-4 w-4" />;
    case 'user_approved':
    case 'user_deactivated':
    case 'user_deleted':
    case 'user_login':
    case 'user_logout':
    case 'user_signup':
      return <UserCheck className="h-4 w-4" />;
    case 'settings_updated':
      return <Settings className="h-4 w-4" />;
    case 'stock_adjusted':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getActivityColor = (actionType: string): string => {
  if (actionType.includes('delete') || actionType.includes('deactivate') || actionType.includes('cancelled')) {
    return 'bg-red-500/10 text-red-600 dark:text-red-400';
  }
  if (actionType.includes('created') || actionType.includes('added') || actionType.includes('approved')) {
    return 'bg-green-500/10 text-green-600 dark:text-green-400';
  }
  if (actionType.includes('updated') || actionType.includes('adjusted')) {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }
  if (actionType.includes('login') || actionType.includes('signup')) {
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
  }
  return 'bg-muted text-muted-foreground';
};

const getActivityLabel = (actionType: string): string => {
  const labels: Record<string, string> = {
    'sale_created': 'Vente',
    'sale_deleted': 'Suppression',
    'sale_cancelled': 'Annulation',
    'product_added': 'Ajout',
    'product_updated': 'Modification',
    'product_deleted': 'Suppression',
    'product_deactivated': 'Désactivation',
    'user_approved': 'Approbation',
    'user_deactivated': 'Désactivation',
    'user_deleted': 'Suppression',
    'user_login': 'Connexion',
    'user_logout': 'Déconnexion',
    'user_signup': 'Inscription',
    'stock_adjusted': 'Stock',
    'settings_updated': 'Paramètres',
    'category_created': 'Catégorie',
    'category_updated': 'Catégorie',
    'category_deleted': 'Catégorie',
    'subcategory_created': 'Sous-cat.',
    'subcategory_updated': 'Sous-cat.',
    'subcategory_deleted': 'Sous-cat.',
    'system_cleanup': 'Système',
  };
  return labels[actionType] || actionType;
};

export const RecentActivities = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id,
          action_type,
          description,
          entity_type,
          created_at,
          user_id
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set(data?.map(a => a.user_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        profilesMap = profiles?.reduce((acc, p) => {
          acc[p.user_id] = p.full_name;
          return acc;
        }, {} as Record<string, string>) || {};
      }

      const activitiesWithNames = data?.map(a => ({
        ...a,
        user_name: a.user_id ? profilesMap[a.user_id] || 'Utilisateur' : 'Système'
      })) || [];

      setActivities(activitiesWithNames);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full animate-fade-in" style={{ animationDelay: '700ms' }}>
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
          <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="hidden sm:inline">Activités Récentes</span>
          <span className="sm:hidden">Activités</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <ScrollArea className="h-[250px] sm:h-[350px] pr-2 sm:pr-4">
          {loading ? (
            <div className="space-y-2 sm:space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1 sm:space-y-2">
                    <div className="h-3 sm:h-4 bg-muted rounded w-3/4" />
                    <div className="h-2 sm:h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Activity className="h-8 w-8 sm:h-12 sm:w-12 mb-2 opacity-50" />
              <p className="text-xs sm:text-sm">Aucune activité récente</p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {activities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-1.5 sm:p-2 rounded-full ${getActivityColor(activity.action_type)}`}>
                    {getActivityIcon(activity.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                      <Badge 
                        variant="secondary" 
                        className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5 ${getActivityColor(activity.action_type)}`}
                      >
                        {getActivityLabel(activity.action_type)}
                      </Badge>
                      <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {activity.user_name}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground line-clamp-2">
                      {activity.description}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                      {formatDistanceToNow(new Date(activity.created_at), { 
                        addSuffix: true,
                        locale: fr 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
