import { useState } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface PeriodRange {
  preset: PeriodPreset;
  from?: Date;
  to?: Date;
}

export const periodPresetLabels: Record<PeriodPreset, string> = {
  all: 'Tout',
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  custom: 'Personnalisé',
};

/** Convertit un preset en bornes de dates concrètes. */
export function resolvePeriodRange(range: PeriodRange): { from?: Date; to?: Date } {
  const now = new Date();
  switch (range.preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'month':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'custom':
      return {
        from: range.from ? startOfDay(range.from) : undefined,
        to: range.to ? endOfDay(range.to) : range.from ? endOfDay(range.from) : undefined,
      };
    default:
      return {};
  }
}

/** Libellé lisible de la période (pour les en-têtes / PDF). */
export function periodRangeLabel(range: PeriodRange): string {
  if (range.preset !== 'custom') return periodPresetLabels[range.preset];
  const { from, to } = resolvePeriodRange(range);
  if (!from) return 'Personnalisé';
  const fmt = (d: Date) => format(d, 'dd/MM/yyyy', { locale: fr });
  return to && fmt(to) !== fmt(from) ? `Du ${fmt(from)} au ${fmt(to)}` : `Le ${fmt(from)}`;
}

/** Filtre une date selon la période sélectionnée. */
export function isInPeriod(date: Date, range: PeriodRange): boolean {
  const { from, to } = resolvePeriodRange(range);
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

interface PeriodRangeFilterProps {
  value: PeriodRange;
  onChange: (value: PeriodRange) => void;
  className?: string;
  presets?: PeriodPreset[];
  allLabel?: string;
}

export const PeriodRangeFilter = ({
  value,
  onChange,
  className,
  presets = ['all', 'today', 'week', 'month', 'custom'],
  allLabel,
}: PeriodRangeFilterProps) => {
  const [open, setOpen] = useState(false);

  const handlePresetChange = (preset: PeriodPreset) => {
    if (preset === 'custom') {
      onChange({ preset, from: value.from, to: value.to });
      setOpen(true);
    } else {
      onChange({ preset });
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Select value={value.preset} onValueChange={(v) => handlePresetChange(v as PeriodPreset)}>
        <SelectTrigger className="w-full sm:w-40 h-9 text-xs">
          <CalendarIcon className="w-3.5 h-3.5 mr-1 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          {presets.map((p) => (
            <SelectItem key={p} value={p}>
              {p === 'all' && allLabel ? allLabel : periodPresetLabels[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === 'custom' && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 justify-start text-left font-normal text-xs',
                !value.from && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5 mr-1" />
              {value.from
                ? value.to
                  ? `${format(value.from, 'dd/MM/yy', { locale: fr })} → ${format(value.to, 'dd/MM/yy', { locale: fr })}`
                  : format(value.from, 'dd/MM/yy', { locale: fr })
                : 'Choisir les dates'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
            <Calendar
              mode="range"
              selected={{ from: value.from, to: value.to }}
              onSelect={(r: any) => onChange({ preset: 'custom', from: r?.from, to: r?.to })}
              numberOfMonths={1}
              locale={fr}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
