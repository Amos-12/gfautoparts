import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { formatNumber, formatCurrencyValue } from '@/lib/utils';

interface SellerData {
  name: string;
  sales: number;
  revenue: number;
}

interface AdminTopSellersChartProps {
  sellers: SellerData[];
  maxRevenue?: number;
  currency?: 'USD' | 'HTG';
}

export const AdminTopSellersChart = ({ sellers, maxRevenue, currency = 'HTG' }: AdminTopSellersChartProps) => {
  const max = maxRevenue || (sellers.length > 0 ? Math.max(...sellers.map(s => s.revenue)) : 1);
  const totalRevenue = sellers.reduce((sum, s) => sum + s.revenue, 0);
  
  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-5 w-5 text-yellow-500 drop-shadow-md" />;
      case 1: return <Medal className="h-5 w-5 text-slate-400 drop-shadow-md" />;
      case 2: return <Award className="h-5 w-5 text-amber-600 drop-shadow-md" />;
      default: return null;
    }
  };

  const getRankBadgeColor = (index: number) => {
    switch (index) {
      case 0: return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0 shadow-md shadow-yellow-500/30';
      case 1: return 'bg-gradient-to-r from-slate-300 to-slate-500 text-white border-0 shadow-md shadow-slate-400/30';
      case 2: return 'bg-gradient-to-r from-amber-500 to-amber-700 text-white border-0 shadow-md shadow-amber-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getProgressGradient = (index: number) => {
    switch (index) {
      case 0: return 'bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500';
      case 1: return 'bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500';
      case 2: return 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600';
      default: return 'bg-gradient-to-r from-pink-500 to-rose-500';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 shadow-lg shadow-yellow-500/40',
      'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 shadow-lg shadow-slate-400/40',
      'bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 shadow-lg shadow-amber-500/40',
      'bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30',
      'bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/30',
    ];
    return colors[index] || colors[colors.length - 1];
  };

  return (
    <Card className="admin-card-sellers h-full">
      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-pink-600 dark:text-pink-400" />
          </div>
          Top 5 Vendeurs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6">
        {sellers.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-muted-foreground">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
            <p className="text-sm sm:text-base">Aucune donnée disponible</p>
          </div>
        ) : (
          sellers.map((seller, index) => {
            const percent = totalRevenue > 0 ? ((seller.revenue / totalRevenue) * 100).toFixed(1) : '0';
            return (
              <div 
                key={index} 
                className="group relative p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/40 dark:from-muted/20 dark:to-muted/5 dark:hover:from-muted/30 dark:hover:to-muted/15 transition-all duration-300 animate-fade-in hover:shadow-md"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Avatar with initials - smaller on mobile */}
                  <div className={`relative flex-shrink-0 w-9 h-9 sm:w-12 sm:h-12 rounded-full ${getAvatarColor(index)} flex items-center justify-center text-white font-bold text-xs sm:text-sm`}>
                    {getInitials(seller.name)}
                    {/* Medal overlay for top 3 */}
                    {index < 3 && (
                      <div className={`absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 ${index === 0 ? 'animate-pulse' : ''}`}>
                        {getMedalIcon(index)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 sm:mb-1.5 gap-1">
                      <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <Badge className={`${getRankBadgeColor(index)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5 flex-shrink-0`}>
                          #{index + 1}
                        </Badge>
                        <span className="font-semibold text-foreground truncate text-xs sm:text-sm">{seller.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-background/50 px-1 sm:px-2 flex-shrink-0">
                        {percent}%
                      </Badge>
                    </div>
                    
                    {/* Progress bar with gradient */}
                    <div className="relative h-2 sm:h-2.5 bg-muted/50 dark:bg-muted/30 rounded-full overflow-hidden">
                      <div 
                        className={`absolute inset-y-0 left-0 ${getProgressGradient(index)} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${(seller.revenue / max) * 100}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between mt-1 sm:mt-1.5 text-[10px] sm:text-xs">
                      <span className="text-muted-foreground flex items-center gap-0.5 sm:gap-1">
                        <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {seller.sales} vente{seller.sales > 1 ? 's' : ''}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrencyValue(seller.revenue, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
