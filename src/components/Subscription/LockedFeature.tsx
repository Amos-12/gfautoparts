import { Lock, ArrowUpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

interface LockedFeatureProps {
  title?: string;
  description?: string;
  requiredPlan?: string;
}

export const LockedFeature = ({ 
  title,
  description,
  requiredPlan = "Pro"
}: LockedFeatureProps) => {
  const { t } = useTranslation();
  const finalTitle = title ?? t('subscription.locked.default_title');
  const finalDesc = description ?? t('subscription.locked.default_desc');
  return (
    <Card className="border-dashed border-2 border-muted-foreground/20">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{finalTitle}</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {finalDesc}
        </p>
        <Button variant="outline" className="gap-2" asChild>
          <a href="mailto:support@stockmanagement.app?subject=Upgrade%20to%20Pro">
            <ArrowUpCircle className="w-4 h-4" />
            {t('subscription.locked.upgrade_to', { plan: requiredPlan })}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
};
