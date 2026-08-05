import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

const PaymentSuccess = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const sessionId = searchParams.get('session_id');
  const plan = searchParams.get('plan') || 'basic';

  const planNames: Record<string, string> = {
    basic: 'Basic',
    pro: 'Pro',
    premium: 'Premium',
  };

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setErrorMessage(t('paymentPage.sessionNotFound'));
      return;
    }

    let attempt = 0;
    const maxAttempts = 3;

    const verify = async () => {
      attempt++;
      try {
        const { data, error } = await supabase.functions.invoke('verify-checkout-session', {
          body: { session_id: sessionId },
        });

        if (error) throw new Error(error.message);

        if (data?.success) {
          setStatus('success');
          return;
        }

        // Payment not yet processed by Stripe
        if (attempt < maxAttempts) {
          setTimeout(verify, 2500);
        } else {
          setStatus('error');
          setErrorMessage(t('paymentPage.verificationFailedFallback'));
        }
      } catch (err: any) {
        if (attempt < maxAttempts) {
          setTimeout(verify, 2500);
        } else {
          setStatus('error');
          setErrorMessage(err.message || t('paymentPage.verificationErrorFallback'));
        }
      }
    };

    verify();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {status === 'verifying' && (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <h1 className="text-xl font-bold">{t('paymentPage.verifyingTitle')}</h1>
              <p className="text-muted-foreground text-sm">
                {t('paymentPage.verifyingDescription')}
              </p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-xl font-bold">{t('paymentPage.successTitle')}</h1>
              <p className="text-muted-foreground text-sm">
                {t('paymentPage.successDescription', { plan: planNames[plan] || plan })}
              </p>
              <Button onClick={() => navigate('/')} className="gap-2 mt-4">
                {t('paymentPage.goToApp')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="text-xl font-bold">{t('paymentPage.errorTitle')}</h1>
              <p className="text-muted-foreground text-sm">{errorMessage}</p>
              <Button onClick={() => navigate('/')} variant="outline" className="gap-2 mt-4">
                {t('paymentPage.backToApp')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
