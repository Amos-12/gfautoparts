import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface TrendDataPoint {
  date: string;
  revenue: number;
  sales: number;
}

interface SellerTrendChartProps {
  data: TrendDataPoint[];
  currency?: 'USD' | 'HTG';
}

const CustomTooltip = ({ active, payload, label, currency = 'HTG' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-xl p-3">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
            <span className="text-xs text-muted-foreground">Revenu:</span>
            <span className="text-xs font-bold text-foreground">
              {currency === 'USD' ? `$${formatNumber(payload[0]?.value)}` : `${formatNumber(payload[0]?.value)} HTG`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            <span className="text-xs text-muted-foreground">Ventes:</span>
            <span className="text-xs font-bold text-foreground">{payload[1]?.value}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const SellerTrendChart = ({ data, currency = 'HTG' }: SellerTrendChartProps) => {
  return (
    <Card className="seller-card-trend animate-fade-in-up" style={{ animationDelay: '50ms' }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          Tendance des 7 derniers jours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sellerRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="sellerSalesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160, 84%, 45%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(160, 84%, 45%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                yAxisId="revenue"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                width={40}
              />
              <YAxis 
                yAxisId="sales"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={30}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="hsl(217, 91%, 60%)"
                strokeWidth={2.5}
                fill="url(#sellerRevenueGradient)"
                animationDuration={1000}
              />
              <Area
                yAxisId="sales"
                type="monotone"
                dataKey="sales"
                stroke="hsl(160, 84%, 45%)"
                strokeWidth={2.5}
                fill="url(#sellerSalesGradient)"
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-sm" />
            <span>Revenu ({currency})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm" />
            <span>Ventes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
