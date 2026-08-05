import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  Package,
  Zap,
  Droplet,
  Boxes,
  Shirt,
  Cpu,
  Grid3X3,
  CircleDot,
  X,
} from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  cartQuantity: number;
  unit: string;
  category: string;
  currency: 'USD' | 'HTG';
  actualPrice?: number;
  displayUnit?: string;
  surface_par_boite?: number;
  stock_barre?: number;
  bars_per_ton?: number;
  sourceUnit?: string;
  dimension?: string;
  diametre?: string;
  specifications_techniques?: Record<string, any>;
}

interface CartSectionProps {
  cart: CartItem[];
  onContinueShopping: () => void;
  onCheckout: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onDirectQuantityChange: (id: string, value: string) => void;
  onClearCart: () => void;
  formatAmount: (amount: number, currency?: 'USD' | 'HTG' | boolean) => string;
  getTotalAmount: () => number;
  getTotalsByCurrency: () => { totalUSD: number; totalHTG: number };
  getTonnageLabel: (tonnage: number) => string;
  barresToTonnage: (barres: number, barsPerTon: number) => number;
  companySettings?: {
    usd_htg_rate?: number;
    default_display_currency?: string;
  } | null;
}

const getCategoryIcon = (category: string) => {
  const icons: Record<string, React.ReactNode> = {
    ceramique: <Grid3X3 className="w-4 h-4" />,
    fer: <CircleDot className="w-4 h-4" />,
    energie: <Zap className="w-4 h-4" />,
    blocs: <Boxes className="w-4 h-4" />,
    vetements: <Shirt className="w-4 h-4" />,
    electronique: <Cpu className="w-4 h-4" />,
    electromenager: <Droplet className="w-4 h-4" />,
    boissons: <Droplet className="w-4 h-4" />,
  };
  return icons[category] || <Package className="w-4 h-4" />;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    ceramique: 'bg-blue-500/10 text-blue-600',
    fer: 'bg-orange-500/10 text-orange-600',
    energie: 'bg-yellow-500/10 text-yellow-600',
    blocs: 'bg-stone-500/10 text-stone-600',
    vetements: 'bg-purple-500/10 text-purple-600',
    electronique: 'bg-cyan-500/10 text-cyan-600',
    electromenager: 'bg-indigo-500/10 text-indigo-600',
    boissons: 'bg-emerald-500/10 text-emerald-600',
  };
  return colors[category] || 'bg-muted text-muted-foreground';
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    ceramique: 'Céramique',
    fer: 'Fer',
    energie: 'Énergie',
    blocs: 'Blocs',
    vetements: 'Vêtements',
    electronique: 'Électronique',
    electromenager: 'Électroménager',
    boissons: 'Boissons',
    alimentaires: 'Alimentaire',
    gazeuses: 'Gazeuses',
    autres: 'Autres',
  };
  return labels[category] || category;
};

const getCartItemSpecs = (item: CartItem): string[] => {
  const specs: string[] = [];
  if (item.category === 'ceramique' && item.dimension) specs.push(item.dimension);
  if (item.category === 'fer' && item.diametre) specs.push(`Ø${item.diametre}`);
  if (item.specifications_techniques) {
    const entries = Object.entries(item.specifications_techniques);
    for (const [, value] of entries.slice(0, 2)) {
      if (value) specs.push(String(value).substring(0, 15));
    }
  }
  return specs.slice(0, 3);
};

export const CartSection: React.FC<CartSectionProps> = ({
  cart,
  onContinueShopping,
  onCheckout,
  onRemoveItem,
  onUpdateQuantity,
  onDirectQuantityChange,
  onClearCart,
  formatAmount,
  getTotalsByCurrency,
  getTonnageLabel,
  barresToTonnage,
  companySettings,
}) => {
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const totalItems = cart.reduce((sum, item) => sum + item.cartQuantity, 0);
  const distinctProducts = cart.length;
  const { totalUSD, totalHTG } = getTotalsByCurrency();
  const rate = companySettings?.usd_htg_rate || 132;
  const displayCurrency = (companySettings?.default_display_currency || 'HTG') as 'USD' | 'HTG';
  const unifiedTotal = displayCurrency === 'HTG' 
    ? totalHTG + (totalUSD * rate)
    : totalUSD + (totalHTG / rate);

  if (cart.length === 0) {
    return (
      <Card className="shadow-lg border-2 border-dashed h-full flex items-center justify-center">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Panier vide</h3>
          <p className="text-muted-foreground text-sm mb-4">Ajoutez des produits pour commencer</p>
          <Button onClick={onContinueShopping} variant="default" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Parcourir les produits
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
      {/* Compact Header */}
      <CardHeader className="bg-muted/30 border-b py-3 px-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Panier</CardTitle>
            <Badge variant="secondary" className="text-xs">{distinctProducts}</Badge>
            <Badge variant="outline" className="text-xs">{Math.round(totalItems)} u.</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-success text-sm">{formatAmount(unifiedTotal, displayCurrency)}</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Vider le panier ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Supprimer tous les {distinctProducts} produit{distinctProducts > 1 ? 's' : ''} du panier ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearCart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Vider
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      {/* Scrollable Items - Takes all available space */}
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.map((item) => {
          const itemTotal = item.actualPrice !== undefined ? item.actualPrice : (item.price * item.cartQuantity);
          const displayQty = item.category === 'ceramique' ? item.cartQuantity.toFixed(2) : item.cartQuantity;
          const maxStock = item.category === 'fer' ? (item.stock_barre || 0) : item.quantity;
          const specs = getCartItemSpecs(item);
          const isDeleting = deletingItemId === item.id;

          const qtyLabel = item.category === 'fer' && item.bars_per_ton 
            ? item.cartQuantity % item.bars_per_ton === 0
              ? `${item.cartQuantity / item.bars_per_ton}T`
              : `${item.cartQuantity} barres`
            : item.category === 'ceramique'
              ? `${displayQty} m²`
              : `${displayQty} ${item.unit}`;

          return (
            <div 
              key={item.id} 
              className={`group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border rounded-lg bg-card hover:border-primary/30 transition-all ${isDeleting ? 'opacity-0 scale-95' : ''}`}
            >
              {/* Mobile: Line 1 - Icon, Name, Total Price */}
              <div className="flex items-center gap-2 w-full sm:contents">
                {/* Icon */}
                <div className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${getCategoryColor(item.category)}`}>
                  {getCategoryIcon(item.category)}
                </div>

                {/* Info - Mobile: just name, Desktop: name + details */}
                <div className="flex-1 min-w-0 sm:flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h4 className="font-medium text-sm truncate">{item.name}</h4>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0 hidden sm:inline-flex">
                      {specs[0] || getCategoryLabel(item.category)}
                    </Badge>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{getCategoryLabel(item.category)}</span>
                    <span>•</span>
                    <span>{formatAmount(item.price, item.currency)}/{item.category === 'ceramique' ? 'm²' : item.unit}</span>
                  </div>
                </div>

                {/* Mobile: Total price aligned right */}
                <span className="font-bold text-sm text-success sm:hidden">{formatAmount(itemTotal, item.currency)}</span>
              </div>

              {/* Mobile: Line 2 - Category, Specs */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden pl-10">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {getCategoryLabel(item.category)}
                </Badge>
                {specs[0] && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {specs[0]}
                  </Badge>
                )}
                <span className="text-[10px]">• {formatAmount(item.price, item.currency)}/{item.category === 'ceramique' ? 'm²' : item.unit}</span>
              </div>

              {/* Mobile: Line 3 - Quantity Controls + Delete | Desktop: inline */}
              <div className="flex items-center justify-between w-full sm:w-auto sm:contents pl-10 sm:pl-0">
                {/* Quantity Controls */}
                <div className="shrink-0 flex items-center">
                  {item.category === 'ceramique' ? (
                    <span className="text-xs sm:text-sm font-medium bg-muted px-2 py-1 rounded">{qtyLabel}</span>
                  ) : (
                    <div className="flex items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-l-lg rounded-r-none border-r-0"
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        disabled={item.cartQuantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        max={maxStock}
                        value={item.cartQuantity}
                        onChange={(e) => onDirectQuantityChange(item.id, e.target.value)}
                        className="h-7 sm:h-8 w-10 sm:w-12 text-center text-xs sm:text-sm font-medium rounded-none border-x-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-r-lg rounded-l-none border-l-0"
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        disabled={item.cartQuantity >= maxStock}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Desktop: Price + Delete | Mobile: just Delete */}
                <div className="shrink-0 flex items-center gap-2">
                  <span className="font-bold text-sm text-success hidden sm:inline">{formatAmount(itemTotal, item.currency)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
                    onClick={() => {
                      setDeletingItemId(item.id);
                      setTimeout(() => onRemoveItem(item.id), 200);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Minimal Footer - Buttons Only */}
      <div className="border-t p-3 flex gap-3 shrink-0 bg-background">
        <Button variant="outline" className="flex-1 gap-2" onClick={onContinueShopping}>
          <ArrowLeft className="w-4 h-4" />
          Continuer
        </Button>
        <Button className="flex-1 gap-2" onClick={onCheckout}>
          Finaliser
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};

export default CartSection;
