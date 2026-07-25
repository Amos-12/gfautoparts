import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export const StatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  change, 
  variant = 'default' 
}: StatsCardProps) => {
  const getIconColor = () => {
    switch (variant) {
      case 'success': return 'text-success';
      case 'warning': return 'text-warning';
      case 'destructive': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getValueColor = () => {
    switch (variant) {
      case 'success': return 'text-success';
      case 'warning': return 'text-warning';
      case 'destructive': return 'text-destructive';
      default: return 'text-foreground';
    }
  };

  return (
    <Card className="shadow-lg transition-smooth hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-5 w-5 ${getIconColor()}`} />
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div className={`text-lg font-bold ${getValueColor()} break-all`}>
            {value}
          </div>
          {change && (
            <Badge 
              variant={change.isPositive ? "default" : "destructive"}
              className="flex items-center gap-1 ml-2"
            >
              {change.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {change.value}% {change.label}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};