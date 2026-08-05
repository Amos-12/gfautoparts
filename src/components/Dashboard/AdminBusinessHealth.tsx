import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, TrendingUp, Package, Percent } from 'lucide-react';
import { formatNumber, formatCurrencyValue } from '@/lib/utils';

interface AdminBusinessHealthProps {
  revenue: number;
  revenueTarget: number;
  profitMargin: number;
  stockTurnover: number;
  lowStockCount: number;
  totalProducts: number;
  currency?: 'USD' | 'HTG';
}

export const AdminBusinessHealth = ({
  revenue,
  revenueTarget,
  profitMargin,
  stockTurnover,
  lowStockCount,
  totalProducts,
  currency = 'HTG'
}: AdminBusinessHealthProps) => {
  // Calculate health score (0-100)
  const revenueScore = Math.min((revenue / revenueTarget) * 100, 100) * 0.4;
  const marginScore = Math.min(profitMargin * 2, 40); // Max 40 points for 20%+ margin
  const stockHealthScore = Math.max(0, (1 - lowStockCount / totalProducts) * 20); // Max 20 points
  
  const healthScore = Math.round(revenueScore + marginScore + stockHealthScore);
  
  const getHealthStatus = () => {
    if (healthScore >= 80) return { label: 'Excellent', color: 'bg-admin-profit text-white', textColor: 'text-admin-profit' };
    if (healthScore >= 60) return { label: 'Bon', color: 'bg-admin-revenue text-white', textColor: 'text-admin-revenue' };
    if (healthScore >= 40) return { label: 'À surveiller', color: 'bg-admin-target text-white', textColor: 'text-admin-target' };
    return { label: 'Critique', color: 'bg-destructive text-white', textColor: 'text-destructive' };
  };

  const status = getHealthStatus();
  
  // Calculate circumference and offset for circular progress
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  return (
    <Card className="dark:admin-card-profit overflow-hidden">
      <CardHeader className="pb-1 sm:pb-2 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-admin-profit" />
            <span className="hidden sm:inline">Santé Business</span>
            <span className="sm:hidden">Santé</span>
          </CardTitle>
          <Badge className={`${status.color} text-[10px] sm:text-xs px-1.5 sm:px-2`}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6 px-3 sm:px-6">
        {/* Circular Progress */}
        <div className="flex items-center justify-center">
          <div className="relative">
            <svg className="w-28 h-28 sm:w-44 sm:h-44 transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="50%"
                cy="50%"
                r="40%"
                stroke="currentColor"
                strokeWidth="10"
                fill="none"
                className="text-muted/30"
              />
              {/* Progress circle */}
              <circle
                cx="50%"
                cy="50%"
                r="40%"
                stroke="url(#healthGradient)"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--admin-profit))" />
                  <stop offset="100%" stopColor="hsl(var(--admin-revenue))" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl sm:text-4xl font-bold ${status.textColor}`}>{healthScore}</span>
              <span className="text-[10px] sm:text-sm text-muted-foreground">/ 100</span>
            </div>
          </div>
        </div>

        {/* Mini Metrics */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          <div className="text-center p-1.5 sm:p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
            <div className="flex justify-center mb-0.5 sm:mb-1">
              <Percent className="h-3 w-3 sm:h-4 sm:w-4 text-admin-profit" />
            </div>
            <div className="text-sm sm:text-lg font-bold text-admin-profit">{profitMargin.toFixed(1)}%</div>
            <div className="text-[9px] sm:text-xs text-muted-foreground">Marge</div>
          </div>
          <div className="text-center p-1.5 sm:p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
            <div className="flex justify-center mb-0.5 sm:mb-1">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-admin-revenue" />
            </div>
            <div className="text-sm sm:text-lg font-bold text-admin-revenue">{stockTurnover.toFixed(1)}x</div>
            <div className="text-[9px] sm:text-xs text-muted-foreground">Rotation</div>
          </div>
          <div className="text-center p-1.5 sm:p-3 rounded-lg bg-muted/50 dark:bg-muted/20">
            <div className="flex justify-center mb-0.5 sm:mb-1">
              <Package className="h-3 w-3 sm:h-4 sm:w-4 text-admin-target" />
            </div>
            <div className="text-sm sm:text-lg font-bold text-admin-target">{lowStockCount}</div>
            <div className="text-[9px] sm:text-xs text-muted-foreground">Stock bas</div>
          </div>
        </div>

        {/* Revenue Progress */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex justify-between text-[10px] sm:text-sm">
            <span className="text-muted-foreground">Objectif</span>
            <span className="font-medium">{Math.round((revenue / revenueTarget) * 100)}%</span>
          </div>
          <Progress 
            value={Math.min((revenue / revenueTarget) * 100, 100)} 
            className="h-1.5 sm:h-2 bg-muted/30"
          />
          <div className="flex justify-between text-[9px] sm:text-xs text-muted-foreground">
            <span>{formatCurrencyValue(revenue, currency)}</span>
            <span>{formatCurrencyValue(revenueTarget, currency)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
