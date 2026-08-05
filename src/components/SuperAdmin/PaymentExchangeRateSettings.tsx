import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, DollarSign, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const PaymentExchangeRateSettings = () => {
  const { t } = useTranslation();
  const [rate, setRate] = useState<string>('132.00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchRate();
  }, []);

  const fetchRate = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('saas_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_exchange_rate')
        .single();

      if (error) throw error;
      
      if (data?.setting_value) {
        const rateValue = (data.setting_value as any).usd_htg_rate;
        setRate(rateValue?.toString() || '132.00');
      }
    } catch (error: any) {
      console.error('Error fetching rate:', error);
      toast({
        title: t('superAdmin.common.error'),
        description: t('superAdmin.exchange_rate.toast_load_error'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const numRate = parseFloat(rate);
    if (isNaN(numRate) || numRate <= 0) {
      toast({
        title: t('superAdmin.common.error'),
        description: t('superAdmin.exchange_rate.toast_invalid_rate'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('saas_settings')
        .update({
          setting_value: { usd_htg_rate: numRate },
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', 'payment_exchange_rate');

      if (error) throw error;

      toast({
        title: t('superAdmin.exchange_rate.toast_success'),
        description: t('superAdmin.exchange_rate.toast_updated'),
      });
    } catch (error: any) {
      console.error('Error saving rate:', error);
      toast({
        title: t('superAdmin.common.error'),
        description: error.message || t('superAdmin.exchange_rate.toast_save_error'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t('superAdmin.exchange_rate.title')}
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </CardTitle>
            <CardDescription>
              {t('superAdmin.exchange_rate.description')}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          {loading ? (
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exchange-rate">{t('superAdmin.exchange_rate.rate_label')}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('superAdmin.exchange_rate.one_usd')}</span>
                  <Input
                    id="exchange-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="max-w-[150px]"
                  />
                  <span className="text-sm text-muted-foreground">HTG</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('superAdmin.exchange_rate.explanation')}
                </p>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                <p className="font-medium">{t('superAdmin.exchange_rate.examples_title')}</p>
                <p className="text-muted-foreground">• Plan Basic ($19) → {(19 * parseFloat(rate || '0')).toFixed(2)} HTG</p>
                <p className="text-muted-foreground">• Plan Pro ($39) → {(39 * parseFloat(rate || '0')).toFixed(2)} HTG</p>
                <p className="text-muted-foreground">• Plan Premium ($59) → {(59 * parseFloat(rate || '0')).toFixed(2)} HTG</p>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('superAdmin.exchange_rate.saving')}
                  </>
                ) : (
                  t('superAdmin.exchange_rate.save')
                )}
              </Button>
            </CardContent>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
