import { useState } from 'react';
import { Crown, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export const UpgradeBanner = () => {
  const { t } = useTranslation();
  const { isFreePlan, daysRemaining, loading } = useSubscription();
  const [upgrading, setUpgrading] = useState(false);

  if (loading || !isFreePlan) return null;

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          toast({ title: t('subscription.upgrade_banner.session_expired'), description: t('subscription.upgrade_banner.session_expired_desc'), variant: 'destructive' });
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan_id: 'pro', payment_method: 'stripe' },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast({
        title: t('subscription.upgrade_banner.error'),
        description: err.message || t('subscription.upgrade_banner.checkout_error'),
        variant: 'destructive',
      });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 px-3 py-2 mb-4">
      <div className="flex items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-xs text-foreground truncate">
              {t('subscription.upgrade_banner.trial_label')}
              <span className="text-muted-foreground font-normal ml-1.5">
                {daysRemaining > 0
                  ? t('subscription.upgrade_banner.days_remaining', { count: daysRemaining })
                  : t('subscription.upgrade_banner.expired')}
              </span>
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1 flex-shrink-0 h-7 text-xs px-2.5"
          onClick={handleUpgrade}
          disabled={upgrading}
        >
          {upgrading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <Crown className="w-3 h-3" />
              {t('subscription.upgrade_banner.upgrade')}
              <ArrowRight className="w-3 h-3" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
