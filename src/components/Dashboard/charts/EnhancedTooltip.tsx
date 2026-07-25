import { formatNumber } from '@/lib/utils';

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
  payload: Record<string, unknown>;
}

interface EnhancedTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  showComparison?: boolean;
  currency?: string;
}

export const EnhancedTooltip = ({ 
  active, 
  payload, 
  label, 
  showComparison = false,
  currency = 'HTG'
}: EnhancedTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  const revenue = payload.find(p => p.dataKey === 'revenue')?.value || 0;
  const profit = payload.find(p => p.dataKey === 'profit')?.value || 0;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-card/95 backdrop-blur-sm p-4 rounded-lg shadow-xl border border-border text-card-foreground">
      <p className="font-semibold mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">{entry.name}:</span>
            </span>
            <span className="font-medium text-foreground">
              {formatNumber(entry.value)} {currency}
            </span>
          </div>
        ))}
      </div>
      
      {revenue > 0 && profit > 0 && (
        <div className="mt-3 pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Marge: <span className="font-medium text-foreground">{margin}%</span>
          </p>
        </div>
      )}

      {showComparison && data?.previousValue !== undefined && (
        <div className="mt-2 text-xs text-muted-foreground">
          vs période précédente: 
          <span className={`ml-1 font-medium ${
            (data.previousValue as number) < revenue ? 'text-green-500' : 'text-red-500'
          }`}>
            {revenue > (data.previousValue as number) ? '+' : ''}
            {(((revenue - (data.previousValue as number)) / (data.previousValue as number)) * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

export const SimpleTooltip = ({ 
  active, 
  payload, 
  label,
  valueFormatter = (v: number) => formatNumber(v)
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  valueFormatter?: (value: number) => string;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-border text-card-foreground">
      <p className="font-medium text-sm mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {valueFormatter(entry.value)}
        </p>
      ))}
    </div>
  );
};
