import { useState, useRef, TouchEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, User, Calendar, CreditCard, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Sale {
  id: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  seller_id: string;
  profiles?: {
    full_name: string;
  };
  currencies?: {
    htg: number;
    usd: number;
  };
}

interface SaleCardProps {
  sale: Sale;
  isAdmin: boolean;
  onView: (saleId: string) => void;
  onDelete: (saleId: string) => void;
  showSwipeHint?: boolean;
}

const formatNumber = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCompactNumber = (amount: number): string => {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1) + 'M';
  } else if (amount >= 1000) {
    return (amount / 1000).toFixed(1) + 'K';
  }
  return formatNumber(amount);
};

export const SaleCard = ({ sale, isAdmin, onView, onDelete, showSwipeHint = false }: SaleCardProps) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    isSwiping.current = true;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping.current) return;
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    // Only allow left swipe (positive diff) up to 100px
    if (diff > 0 && diff <= 100) {
      setSwipeOffset(diff);
    } else if (diff <= 0) {
      setSwipeOffset(0);
    }
  };

  const handleTouchEnd = () => {
    isSwiping.current = false;
    // If swiped more than 60px, keep it open, otherwise close
    if (swipeOffset > 60) {
      setSwipeOffset(80);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
    setSwipeOffset(0);
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Espèce';
      case 'cheque': return 'Chèque';
      case 'virement': return 'Virement';
      default: return method;
    }
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-lg">
        {/* Delete action background */}
        {isAdmin && (
          <div 
            className="absolute inset-y-0 right-0 w-20 bg-destructive flex items-center justify-center"
            onClick={handleDelete}
          >
            <Trash2 className="w-5 h-5 text-destructive-foreground" />
          </div>
        )}
        
        {/* Card content */}
        <Card 
          className="relative transition-transform duration-200 ease-out border-0 shadow-sm"
          style={{ transform: `translateX(-${swipeOffset}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <CardContent className="p-3">
            {/* Swipe hint for first card */}
            {showSwipeHint && isAdmin && swipeOffset === 0 && (
              <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse">
                <ChevronLeft className="w-3 h-3" />
                <span>Glisser</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-2">
              {/* Left section - Main info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Customer & Date row */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{formatDate(sale.created_at)}</span>
                </div>
                
                {/* Customer name */}
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate text-sm">
                    {sale.customer_name || <span className="text-muted-foreground italic">Client anonyme</span>}
                  </span>
                </div>

                {/* Seller */}
                <p className="text-xs text-muted-foreground truncate pl-6">
                  Vendeur: {sale.profiles?.full_name || 'N/A'}
                </p>

                {/* Payment method */}
                <div className="flex items-center gap-2 pl-6">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    <CreditCard className="w-2.5 h-2.5 mr-1" />
                    {getPaymentMethodLabel(sale.payment_method)}
                  </Badge>
                </div>
              </div>

              {/* Right section - Amount & Action */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {/* Amount */}
                <div className="text-right">
                  {sale.currencies?.htg ? (
                    <p className="font-bold text-sm text-foreground">
                      {formatCompactNumber(sale.currencies.htg)} <span className="text-xs font-normal">HTG</span>
                    </p>
                  ) : null}
                  {sale.currencies?.usd ? (
                    <p className="text-xs text-muted-foreground font-medium">
                      ${formatCompactNumber(sale.currencies.usd)}
                    </p>
                  ) : null}
                  {!sale.currencies?.htg && !sale.currencies?.usd && (
                    <p className="font-bold text-sm">{formatCompactNumber(sale.total_amount)} HTG</p>
                  )}
                </div>

                {/* View button */}
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => onView(sale.id)}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">Détails</span>
                  <ChevronRight className="w-3 h-3 ml-0.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette vente ?
              Cette action est irréversible et remettra les produits en stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => onDelete(sale.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
