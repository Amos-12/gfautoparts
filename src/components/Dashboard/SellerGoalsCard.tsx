import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Target, TrendingUp, Flame } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface SellerGoalsCardProps {
  todaySales: number;
  todayRevenue: number;
  averageDailySales: number;
  averageDailyRevenue: number;
  currency?: 'USD' | 'HTG';
}

export const SellerGoalsCard = ({
  todaySales,
  todayRevenue,
  averageDailySales,
  averageDailyRevenue,
  currency = 'HTG',
}: SellerGoalsCardProps) => {
  // Goals based on average + 20% stretch target
  const salesGoal = Math.max(Math.ceil(averageDailySales * 1.2), 1);
  const revenueGoal = Math.max(averageDailyRevenue * 1.2, 1000);
  
  const salesProgress = Math.min((todaySales / salesGoal) * 100, 100);
  const revenueProgress = Math.min((todayRevenue / revenueGoal) * 100, 100);
  
  const salesAchieved = todaySales >= salesGoal;
  const revenueAchieved = todayRevenue >= revenueGoal;

  return (
    <Card className="seller-card-goal animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-500/20">
            <Target className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          </div>
          Objectifs du Jour
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sales Goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Ventes</span>
            <div className="flex items-center gap-2">
              {salesAchieved && (
                <Trophy className="w-4 h-4 text-amber-500 animate-pulse drop-shadow-md" />
              )}
              <span className="text-sm font-bold">
                {todaySales} / {salesGoal}
              </span>
            </div>
          </div>
          {/* Custom progress bar with gradient */}
          <div className="relative h-3 bg-muted/50 dark:bg-muted/30 rounded-full overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                salesAchieved 
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500' 
                  : 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500'
              }`}
              style={{ width: `${salesProgress}%` }}
            />
            {salesProgress > 50 && (
              <Flame className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-white/80" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {salesAchieved 
              ? '🎉 Objectif atteint !' 
              : `${salesGoal - todaySales} vente${salesGoal - todaySales > 1 ? 's' : ''} restante${salesGoal - todaySales > 1 ? 's' : ''}`
            }
          </p>
        </div>

        {/* Revenue Goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Revenu</span>
            <div className="flex items-center gap-2">
              {revenueAchieved && (
                <Trophy className="w-4 h-4 text-amber-500 animate-pulse drop-shadow-md" />
              )}
              <span className="text-sm font-bold">
                {currency === 'USD' ? `$${formatNumber(todayRevenue)} / $${formatNumber(revenueGoal)}` : `${formatNumber(todayRevenue)} / ${formatNumber(revenueGoal)} HTG`}
              </span>
            </div>
          </div>
          {/* Custom progress bar with gradient */}
          <div className="relative h-3 bg-muted/50 dark:bg-muted/30 rounded-full overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                revenueAchieved 
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500' 
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
              }`}
              style={{ width: `${revenueProgress}%` }}
            />
            {revenueProgress > 50 && (
              <Flame className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-white/80" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {revenueAchieved 
              ? '🎉 Objectif atteint !' 
              : currency === 'USD' 
                ? `$${formatNumber(revenueGoal - todayRevenue)} restants`
                : `${formatNumber(revenueGoal - todayRevenue)} HTG restants`
            }
          </p>
        </div>

        {/* Motivation */}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            <span>Objectifs basés sur votre moyenne +20%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
