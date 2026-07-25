import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface ComparisonData {
  label: string;
  current: number;
  previous: number;
  suffix?: string;
}

interface SellerPerformanceComparisonProps {
  comparisons: ComparisonData[];
  currency?: 'USD' | 'HTG';
}

export const SellerPerformanceComparison = ({ comparisons, currency = 'HTG' }: SellerPerformanceComparisonProps) => {
  const getChangePercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <Card className="seller-card-sales animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
            <BarChart3 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          Comparaison de Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {comparisons.map((item, index) => {
          const change = getChangePercent(item.current, item.previous);
          const isPositive = change > 0;
          const isNeutral = Math.abs(change) < 0.1;

          return (
            <div 
              key={item.label} 
              className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/40 dark:from-muted/20 dark:to-muted/5 dark:hover:from-muted/30 dark:hover:to-muted/15 transition-all duration-300 hover:shadow-sm"
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="font-bold text-lg">
                  {item.suffix ? `${formatNumber(item.current)}${item.suffix}` : (currency === 'USD' ? `$${formatNumber(item.current)}` : `${formatNumber(item.current)} HTG`)}
                </p>
              </div>
              <div className="text-right space-y-1">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                  isNeutral 
                    ? 'bg-muted text-muted-foreground' 
                    : isPositive 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                      : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                }`}>
                  {isNeutral ? (
                    <Minus className="w-3 h-3" />
                  ) : isPositive ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {isPositive ? '+' : ''}{change.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  vs {item.suffix ? `${formatNumber(item.previous)}${item.suffix}` : (currency === 'USD' ? `$${formatNumber(item.previous)}` : `${formatNumber(item.previous)} HTG`)}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
