import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Crown, CreditCard, Smartphone, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Trans } from 'react-i18next';

interface ExpiredScreenProps {
  companyName: string;
  currentPlan: string;
  onLogout: () => void;
}

export const ExpiredScreen = ({ companyName, currentPlan, onLogout }: ExpiredScreenProps) => {
  const { t } = useTranslation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'moncash'>('stripe');

  const plans = [
    { id: 'basic', name: 'Basic', price: 19, features: [t('subscription.expired.feature_users_5'), t('subscription.expired.feature_products_200'), t('subscription.expired.feature_support_email')] },
    { id: 'pro', name: 'Pro', price: 39, features: [t('subscription.expired.feature_users_15'), t('subscription.expired.feature_products_1000'), t('subscription.expired.feature_support_priority')] },
    { id: 'premium', name: 'Premium', price: 59, features: [t('subscription.expired.feature_users_unlimited'), t('subscription.expired.feature_products_unlimited'), t('subscription.expired.feature_support_dedicated')] },
  ];

  const handleCheckout = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          toast({
            title: t('subscription.expired.session_expired'),
            description: t('subscription.expired.session_expired_desc'),
            variant: 'destructive',
          });
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan_id: planId, payment_method: selectedMethod },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast({
        title: t('subscription.expired.error'),
        description: err.message || t('subscription.expired.checkout_error'),
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-3xl w-full space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">
            {currentPlan === 'trial' ? t('subscription.expired.title_trial') : t('subscription.expired.title_subscription')}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            <Trans
              i18nKey="subscription.expired.subtitle"
              values={{ company: companyName }}
              components={{ 1: <span className="font-semibold" /> }}
            />
          </p>
        </div>

        <div className="flex justify-center gap-3">
          <Button
            variant={selectedMethod === 'stripe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMethod('stripe')}
            className="gap-2"
          >
            <CreditCard className="w-4 h-4" />
            {t('subscription.expired.method_card')}
          </Button>
          <Button
            variant={selectedMethod === 'moncash' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMethod('moncash')}
            className="gap-2"
          >
            <Smartphone className="w-4 h-4" />
            {t('subscription.expired.method_moncash')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className={plan.id === 'pro' ? 'border-primary shadow-lg ring-1 ring-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.id === 'pro' && (
                    <Badge className="bg-primary text-primary-foreground">
                      <Crown className="w-3 h-3 mr-1" />
                      {t('subscription.expired.popular')}
                    </Badge>
                  )}
                </div>
                <p className="text-3xl font-bold">${plan.price}<span className="text-sm text-muted-foreground font-normal">{t('subscription.expired.per_month')}</span></p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full gap-2"
                  variant={plan.id === 'pro' ? 'default' : 'outline'}
                  onClick={() => handleCheckout(plan.id)}
                  disabled={!!loadingPlan}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {selectedMethod === 'stripe' ? <CreditCard className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                      {t('subscription.expired.choose', { plan: plan.name })}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button variant="outline" onClick={onLogout}>
            {t('subscription.expired.logout')}
          </Button>
        </div>
      </div>
    </div>
  );
};
