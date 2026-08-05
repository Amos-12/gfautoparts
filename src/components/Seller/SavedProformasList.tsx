import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  ShoppingCart, 
  Trash2, 
  Eye,
  Clock,
  User,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format, isPast, differenceInDays } from 'date-fns';
import { getDateFnsLocale, getCurrentLocale } from '@/lib/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedProforma {
  id: string;
  proforma_number: string;
  customer_name: string | null;
  validity_days: number;
  expires_at: string;
  subtotal_ht: number;
  tva_amount: number;
  total_ttc: number;
  display_currency: string;
  items: any[];
  status: 'active' | 'converted' | 'expired';
  created_at: string;
}

interface SavedProformasListProps {
  onConvertToSale: (proforma: SavedProforma) => void;
  onViewProforma: (proforma: SavedProforma) => void;
}

export const SavedProformasList = ({ onConvertToSale, onViewProforma }: SavedProformasListProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [proformas, setProformas] = useState<SavedProforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proformaToDelete, setProformaToDelete] = useState<SavedProforma | null>(null);

  const dateLocale = getDateFnsLocale();
  const numberLocale = getCurrentLocale();

  useEffect(() => {
    if (user) {
      fetchProformas();
    }
  }, [user]);

  const fetchProformas = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proformas')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedData = (data || []).map(p => ({
        ...p,
        items: p.items as any[]
      })) as SavedProforma[];

      setProformas(typedData);
    } catch (error) {
      console.error('Error fetching proformas:', error);
      toast({
        title: t('common.error'),
        description: t('seller.proforma.errorLoad'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!proformaToDelete) return;

    try {
      const { error } = await supabase
        .from('proformas')
        .delete()
        .eq('id', proformaToDelete.id);

      if (error) throw error;

      setProformas(prev => prev.filter(p => p.id !== proformaToDelete.id));
      toast({
        title: t('seller.proforma.deletedTitle'),
        description: t('seller.proforma.deletedDesc', { number: proformaToDelete.proforma_number })
      });
    } catch (error) {
      console.error('Error deleting proforma:', error);
      toast({
        title: t('common.error'),
        description: t('seller.proforma.errorDelete'),
        variant: "destructive"
      });
    } finally {
      setDeleteDialogOpen(false);
      setProformaToDelete(null);
    }
  };

  const getStatusBadge = (proforma: SavedProforma) => {
    if (proforma.status === 'converted') {
      return <Badge variant="default" className="bg-success text-success-foreground">{t('seller.proforma.statusConverted')}</Badge>;
    }
    
    const isExpired = isPast(new Date(proforma.expires_at));
    if (isExpired || proforma.status === 'expired') {
      return <Badge variant="secondary" className="bg-destructive/10 text-destructive">{t('seller.proforma.statusExpired')}</Badge>;
    }
    
    const daysLeft = differenceInDays(new Date(proforma.expires_at), new Date());
    if (daysLeft <= 2) {
      return <Badge variant="outline" className="border-warning text-warning">{t('seller.proforma.statusExpiringSoon')}</Badge>;
    }
    
    return <Badge variant="outline" className="border-success text-success">{t('seller.proforma.statusActive')}</Badge>;
  };

  const formatAmount = (amount: number, currency: string) => {
    const formatted = amount.toLocaleString(numberLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return currency === 'USD' ? `$${formatted}` : `${formatted} HTG`;
  };

  const canConvert = (proforma: SavedProforma) => {
    return proforma.status === 'active' && !isPast(new Date(proforma.expires_at));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="text-muted-foreground">{t('seller.proforma.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (proformas.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t('seller.proforma.savedEmpty')}</p>
            <p className="text-xs mt-1">{t('seller.proforma.savedEmptyHint')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 px-3 sm:px-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('seller.proforma.savedTitle')} ({proformas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="space-y-3">
            {proformas.map((proforma) => (
              <div 
                key={proforma.id}
                className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-medium">
                        {proforma.proforma_number}
                      </span>
                      {getStatusBadge(proforma)}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="truncate">{proforma.customer_name || t('seller.proforma.anonymousCustomer')}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm sm:text-base text-primary">
                      {formatAmount(proforma.total_ttc, proforma.display_currency)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      {t('seller.proforma.itemsCount', { count: proforma.items.length })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mb-3">
                  <Clock className="w-3 h-3" />
                  <span>
                    {t('seller.proforma.createdOn', { date: format(new Date(proforma.created_at), 'dd MMM yyyy', { locale: dateLocale }) })}
                  </span>
                  <span>•</span>
                  <span>
                    {t('seller.proforma.expiresOn', { date: format(new Date(proforma.expires_at), 'dd MMM yyyy', { locale: dateLocale }) })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 h-8 text-xs"
                    onClick={() => onViewProforma(proforma)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {t('seller.proforma.view')}
                  </Button>
                  
                  {canConvert(proforma) && (
                    <Button 
                      size="sm" 
                      className="flex-1 h-8 text-xs"
                      onClick={() => onConvertToSale(proforma)}
                    >
                      <ShoppingCart className="w-3 h-3 mr-1" />
                      {t('seller.proforma.convertToSale')}
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={() => {
                      setProformaToDelete(proforma);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              {t('seller.proforma.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('seller.proforma.deleteDesc', { number: proformaToDelete?.proforma_number || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('seller.proforma.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('seller.proforma.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
