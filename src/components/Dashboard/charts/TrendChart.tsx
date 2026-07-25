import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Legend,
} from 'recharts';
import { EnhancedTooltip } from './EnhancedTooltip';
import { formatNumber } from '@/lib/utils';

interface TrendDataPoint {
  date: string;
  revenue: number;
  profit: number;
  salesCount?: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  title?: string;
  showBrush?: boolean;
  height?: number;
  currency?: 'USD' | 'HTG';
}

export const TrendChart = ({ 
  data, 
  title = "Tendance des ventes",
  showBrush = true,
  height = 300,
  currency = 'HTG',
}: TrendChartProps) => {
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[200px] sm:h-[280px]" style={{ minHeight: height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 5, left: -10, bottom: showBrush ? 30 : 10 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
                stroke="hsl(var(--foreground))"
                tickLine={false}
                axisLine={false}
              />
              
              <YAxis 
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
                stroke="hsl(var(--foreground))"
                tickLine={false}
                axisLine={false}
                width={40}
              />
              
              <Tooltip content={<EnhancedTooltip currency={currency} />} />
              
              <Legend 
                verticalAlign="top" 
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
              
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenus"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                animationDuration={800}
                animationBegin={0}
              />
              
              <Area
                type="monotone"
                dataKey="profit"
                name="Bénéfices"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={2}
                fill="url(#profitGradient)"
                animationDuration={800}
                animationBegin={200}
              />
              
              {showBrush && (
                <Brush 
                  dataKey="date" 
                  height={25} 
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--muted))"
                  tickFormatter={(value) => value}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
