import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatNumber } from '@/lib/utils';

interface ComparisonDataPoint {
  label: string;
  current: number;
  previous: number;
}

interface ComparisonChartProps {
  data: ComparisonDataPoint[];
  title?: string;
  height?: number;
  currentLabel?: string;
  previousLabel?: string;
  currency?: 'USD' | 'HTG';
}

export const ComparisonChart = ({ 
  data, 
  title = "Comparaison des périodes",
  height = 300,
  currentLabel = "Période actuelle",
  previousLabel = "Période précédente",
  currency = 'HTG',
}: ComparisonChartProps) => {
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null;

    const current = payload.find(p => p.name === currentLabel)?.value || 0;
    const previous = payload.find(p => p.name === previousLabel)?.value || 0;
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

    const currencySymbol = currency === 'USD' ? '$' : '';
    const currencySuffix = currency === 'HTG' ? ' HTG' : '';

    return (
      <div className="bg-card/95 backdrop-blur-sm p-2 sm:p-3 rounded-lg shadow-xl border border-border text-card-foreground">
        <p className="font-medium text-xs sm:text-sm mb-1.5 sm:mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-[10px] sm:text-sm" style={{ color: entry.color }}>
            {entry.name}: {currencySymbol}{formatNumber(entry.value)}{currencySuffix}
          </p>
        ))}
        <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-border">
          <p className={`text-[10px] sm:text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}% variation
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[200px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 5, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              
              <XAxis 
                dataKey="label" 
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
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                verticalAlign="top" 
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
              
              <Line
                type="monotone"
                dataKey="current"
                name={currentLabel}
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                animationDuration={800}
              />
              
              <Line
                type="monotone"
                dataKey="previous"
                name={previousLabel}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                animationDuration={800}
                animationBegin={200}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
