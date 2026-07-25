import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  icon: LucideIcon;
  currency?: 'USD' | 'HTG';
  sparklineData?: { value: number }[];
  format?: 'currency' | 'number' | 'percent';
  colorScheme?: 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'seller-revenue' | 'seller-profit' | 'seller-sales' | 'seller-average' | 'admin-revenue' | 'admin-profit' | 'admin-sales' | 'admin-target' | 'admin-inventory' | 'admin-sellers' | 'admin-orders' | 'admin-products';
  size?: 'default' | 'sm' | 'xs';
}

export const KPICard = ({
  title,
  value,
  previousValue,
  icon: Icon,
  currency = 'HTG',
  sparklineData,
  format = 'currency',
  colorScheme = 'default',
  size = 'default',
}: KPICardProps) => {
  const trend = previousValue && previousValue > 0 
    ? ((value - previousValue) / previousValue) * 100 
    : 0;
  
  const isPositive = trend > 0;
  const isNeutral = Math.abs(trend) < 0.1;

  const formatValue = () => {
    switch (format) {
      case 'currency':
        return currency === 'USD' 
          ? `$${formatNumber(value)}` 
          : `${formatNumber(value)} HTG`;
      case 'percent':
        return `${formatNumber(value)}%`;
      case 'number':
      default:
        return formatNumber(value, 0);
    }
  };

  // Get gradient icon background for light mode, solid for dark
  const getIconGradientClasses = () => {
    switch (colorScheme) {
      case 'success':
      case 'seller-profit':
      case 'admin-profit':
        return 'bg-gradient-to-br from-emerald-400/20 to-teal-500/20 dark:bg-emerald-500/20';
      case 'warning':
      case 'seller-average':
      case 'admin-orders':
        return 'bg-gradient-to-br from-amber-400/20 to-orange-500/20 dark:bg-amber-500/20';
      case 'danger':
        return 'bg-gradient-to-br from-red-400/20 to-rose-500/20 dark:bg-red-500/20';
      case 'accent':
      case 'seller-sales':
      case 'admin-sales':
        return 'bg-gradient-to-br from-violet-400/20 to-purple-500/20 dark:bg-violet-500/20';
      case 'seller-revenue':
      case 'admin-revenue':
        return 'bg-gradient-to-br from-blue-400/20 to-indigo-500/20 dark:bg-blue-500/20';
      case 'admin-target':
        return 'bg-gradient-to-br from-orange-400/20 to-amber-500/20 dark:bg-orange-500/20';
      case 'admin-inventory':
        return 'bg-gradient-to-br from-cyan-400/20 to-teal-500/20 dark:bg-cyan-500/20';
      case 'admin-sellers':
        return 'bg-gradient-to-br from-pink-400/20 to-rose-500/20 dark:bg-pink-500/20';
      case 'admin-products':
        return 'bg-gradient-to-br from-sky-400/20 to-blue-500/20 dark:bg-sky-500/20';
      default:
        return 'bg-gradient-to-br from-blue-400/20 to-indigo-500/20 dark:bg-primary/20';
    }
  };

  const getIconColorClasses = () => {
    switch (colorScheme) {
      case 'success':
      case 'seller-profit':
      case 'admin-profit':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'warning':
      case 'seller-average':
      case 'admin-orders':
        return 'text-amber-600 dark:text-amber-400';
      case 'danger':
        return 'text-red-600 dark:text-red-400';
      case 'accent':
      case 'seller-sales':
      case 'admin-sales':
        return 'text-violet-600 dark:text-violet-400';
      case 'seller-revenue':
      case 'admin-revenue':
        return 'text-blue-600 dark:text-blue-400';
      case 'admin-target':
        return 'text-orange-600 dark:text-orange-400';
      case 'admin-inventory':
        return 'text-cyan-600 dark:text-cyan-400';
      case 'admin-sellers':
        return 'text-pink-600 dark:text-pink-400';
      case 'admin-products':
        return 'text-sky-600 dark:text-sky-400';
      default:
        return 'text-blue-600 dark:text-primary';
    }
  };

  const getCardAccentClass = () => {
    // Removed colored border classes - now returns empty string
    return '';
  };

  const getSparklineColor = () => {
    switch (colorScheme) {
      case 'seller-profit':
      case 'admin-profit':
      case 'success':
        return 'hsl(160, 84%, 45%)';
      case 'seller-average':
      case 'admin-orders':
      case 'warning':
        return 'hsl(45, 100%, 55%)';
      case 'seller-sales':
      case 'admin-sales':
      case 'accent':
        return 'hsl(262, 83%, 58%)';
      case 'seller-revenue':
      case 'admin-revenue':
        return 'hsl(217, 91%, 60%)';
      case 'admin-target':
        return 'hsl(32, 95%, 44%)';
      case 'admin-inventory':
        return 'hsl(187, 92%, 50%)';
      case 'admin-sellers':
        return 'hsl(330, 81%, 60%)';
      case 'admin-products':
        return 'hsl(199, 89%, 48%)';
      case 'danger':
        return 'hsl(350, 89%, 60%)';
      default:
        return 'hsl(var(--primary))';
    }
  };

  const sparklineColor = getSparklineColor();
  
  // Créer un ID unique sans caractères spéciaux pour le gradient SVG
  const gradientId = `gradient-${title.replace(/[^a-zA-Z0-9]/g, '')}`;
  
  const isSmall = size === 'sm';
  const isXs = size === 'xs';
  const isCompact = isSmall || isXs;

  const getPadding = () => {
    if (isXs) return "p-1.5 sm:p-2";
    if (isSmall) return "p-2 sm:p-3";
    return "p-2 sm:p-4";
  };

  const getTitleSize = () => {
    if (isXs) return "text-[8px] sm:text-[9px] md:text-xs";
    if (isSmall) return "text-[9px] sm:text-[10px] md:text-xs";
    return "text-[10px] sm:text-xs md:text-sm";
  };

  const getValueSize = () => {
    if (isXs) return "text-[9px] sm:text-xs md:text-sm";
    if (isSmall) return "text-[10px] sm:text-sm md:text-base";
    return "text-xs sm:text-base md:text-xl";
  };

  const getIconPadding = () => {
    if (isXs) return "p-0.5 sm:p-1";
    if (isSmall) return "p-1 sm:p-1.5";
    return "p-1.5 sm:p-2.5";
  };

  const getIconSize = () => {
    if (isXs) return "w-2.5 h-2.5 sm:w-3 sm:h-3";
    if (isSmall) return "w-3 h-3 sm:w-4 sm:h-4";
    return "w-4 h-4 sm:w-5 sm:h-5";
  };

  return (
    <Card className={`relative overflow-hidden bg-card transition-all duration-300 ease-out hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 dark:border-border/50 dark:hover:shadow-primary/5 ${getCardAccentClass()}`}>
      <CardContent className={getPadding()}>
        <div className="flex items-start justify-between gap-1 sm:gap-2">
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-muted-foreground truncate ${getTitleSize()}`}>
              {title}
            </p>
            <p className={`font-bold text-foreground mt-0.5 truncate ${getValueSize()}`}>
              {formatValue()}
            </p>
            
            {previousValue !== undefined && !isCompact && (
              <div className="hidden sm:flex items-center gap-1 mt-2">
                {isNeutral ? (
                  <Minus className="w-3 h-3 text-muted-foreground" />
                ) : isPositive ? (
                  <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
                )}
                <span className={`text-xs font-medium ${
                  isNeutral 
                    ? 'text-muted-foreground' 
                    : isPositive 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {isPositive ? '+' : ''}{trend.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground hidden lg:inline">
                  vs précédent
                </span>
              </div>
            )}
          </div>
          
          {/* Gradient icon container for light mode */}
          <div className={`rounded-md sm:rounded-lg ${getIconGradientClasses()} shadow-sm ${getIconPadding()}`}>
            <Icon className={`${getIconSize()} ${getIconColorClasses()}`} />
          </div>
        </div>

        {sparklineData && sparklineData.length > 0 && !isCompact && (
          <div className="mt-2 sm:mt-3 h-8 sm:h-12 -mx-1 sm:-mx-2 hidden sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={sparklineColor} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
